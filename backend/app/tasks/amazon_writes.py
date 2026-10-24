"""Amazon SP-API write outbox consumer daemon.

Consumes staged ``amazon_write_outbox`` rows routed to ``amzsphere.catalog_writes``
and executes them against the SP-API Listings Items API using an asynchronous
httpx client. Multiple workers can poll the same table safely thanks to
``SELECT ... FOR UPDATE SKIP LOCKED``.
"""

from __future__ import annotations

import logging
import hmac
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from celery import shared_task
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy import select

from backend.app.config import get_settings
from backend.app.db import SessionLocal
from backend.app.models import AmazonWriteOutbox, ListingHealthEvent, Seller
from backend.app.tasks.runtime import run_async

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/amazon-writes", tags=["Amazon Writes"])


class OutboxExecuteResponse(BaseModel):
    processed: int
    published: int
    rescheduled: int
    batch_limit: int
    broker_url: str
    message: str

ROUTING_TARGET_CATALOG_WRITES = "amzsphere.catalog_writes"
LISTINGS_API_PATH = "/listings/{api_version}/items/{seller_id}/{sku}"

MAX_ATTEMPTS = 10


def _exponential_backoff_seconds(attempt_count: int, settings) -> int:
    base = settings.amazon_write_outbox_base_backoff_seconds
    cap = settings.amazon_write_outbox_max_backoff_seconds
    return min(base * (2 ** attempt_count), cap)


def _build_listings_patch_payload(
    action_type: str, payload: dict[str, Any], event: ListingHealthEvent
) -> dict[str, Any]:
    """Construct the SP-API Listings Items request body from a staged outbox row."""
    product_type = (event.raw_payload or {}).get("productType", "UNKNOWN")
    attributes: dict[str, Any] = {}

    if action_type == "UPDATE_PRICE":
        standard_price = payload.get("standard_price")
        if standard_price is None:
            raise ValueError("UPDATE_PRICE requires a standard_price in the payload")
        attributes["standard_price"] = [
            {"currency": "USD", "value": str(standard_price)}
        ]

    elif action_type == "PATCH_CATALOG":
        attributes = payload.get("attributes", {}) or {}
        if payload.get("bullet_points"):
            attributes["bullet_points"] = [
                {"value": point, "language_tag": "en-US"}
                for point in payload["bullet_points"]
            ]
        if payload.get("product_title"):
            attributes["product_title"] = [
                {"value": payload["product_title"], "language_tag": "en-US"}
            ]

    else:
        raise ValueError(f"Unsupported action_type: {action_type!r}")

    return {
        "productType": product_type,
        "attributes": attributes,
    }


def _resolve_access_token(settings) -> str:
    """Placeholder resolver for the SP-API bearer access token.

    Production should exchange the encrypted LWA refresh token via the token
    endpoint and cache the result. Returns a placeholder here so the scaffold
    compiles and can be unit-tested without live credentials.
    """
    if settings.sp_api_access_token:
        return settings.sp_api_access_token.get_secret_value()
    return "PLACEHOLDER_SP_API_ACCESS_TOKEN"


def _build_auth_headers(settings) -> dict[str, str]:
    """Build SP-API request headers including AWS IAM and bearer token placeholders."""
    token = _resolve_access_token(settings)
    headers: dict[str, str] = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {token}",
        "x-amz-access-token": token,
        # AWS IAM signature placeholders; production signs with AWS SigV4.
        "x-amz-date": datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ"),
        "x-amz-target": "com.amazonaws.spapi.ListingsItems.PutListingsItem",
    }
    if settings.aws_access_key_id:
        headers["x-amz-aws-access-key-id"] = settings.aws_access_key_id.get_secret_value()
    return headers


async def _execute_single_outbox_row(
    session,
    outbox: AmazonWriteOutbox,
    event: ListingHealthEvent,
    seller: Seller,
    settings,
    client: httpx.AsyncClient,
) -> None:
    """Execute one outbox row against SP-API and evolve its status atomically."""
    url = (
        f"{settings.sp_api_endpoint}"
        f"{LISTINGS_API_PATH.format(
            api_version=settings.sp_api_listings_api_version,
            seller_id=seller.merchant_id,
            sku=event.sku,
        )}"
    )
    body = _build_listings_patch_payload(outbox.action_type, outbox.payload, event)
    headers = _build_auth_headers(settings)

    try:
        response = await client.patch(url, json=body, headers=headers)
    except (httpx.RequestError, httpx.HTTPStatusError) as error:
        logger.exception(
            "SP-API request failed for outbox entry",
            extra={
                "outbox_id": str(outbox.id),
                "event_id": str(outbox.event_id),
                "error": str(error),
            },
        )
        _mark_outbox_pending_retry(session, outbox, str(error))
        return

    if response.status_code == 429:
        logger.warning(
            "SP-API throttled outbox entry; rescheduling with backoff",
            extra={
                "outbox_id": str(outbox.id),
                "event_id": str(outbox.event_id),
                "attempt_count": outbox.attempt_count,
            },
        )
        _mark_outbox_pending_retry(session, outbox, f"HTTP 429: {response.status_code}")
        return

    if response.status_code >= 400:
        logger.error(
            "SP-API returned error for outbox entry",
            extra={
                "outbox_id": str(outbox.id),
                "event_id": str(outbox.event_id),
                "status_code": response.status_code,
                "body": response.text[:500],
            },
        )
        _mark_outbox_pending_retry(session, outbox, f"HTTP {response.status_code}: {response.text[:200]}")
        return

    outbox.status = "published"
    outbox.published_at = datetime.now(timezone.utc)
    outbox.last_error = None
    logger.info(
        "SP-API outbox entry published successfully",
        extra={
            "outbox_id": str(outbox.id),
            "event_id": str(outbox.event_id),
            "action_type": outbox.action_type,
        },
    )


def _mark_outbox_pending_retry(
    session, outbox: AmazonWriteOutbox, error_message: str
) -> None:
    outbox.attempt_count += 1
    outbox.last_error = error_message[:160] if error_message else None
    settings = get_settings()
    backoff = _exponential_backoff_seconds(outbox.attempt_count, settings)
    outbox.available_at = datetime.now(timezone.utc) + timedelta(seconds=backoff)
    # Status remains "pending"; the row becomes visible again at available_at.


async def _drain_outbox(limit: int = 50) -> dict[str, Any]:
    """Fetch, execute, and evolve pending catalog write outbox rows."""
    settings = get_settings()
    processed = 0
    published = 0
    rescheduled = 0

    async with SessionLocal() as session:
        rows = (
            await session.scalars(
                select(AmazonWriteOutbox)
                .where(
                    AmazonWriteOutbox.status == "pending",
                    AmazonWriteOutbox.routing_target == ROUTING_TARGET_CATALOG_WRITES,
                    AmazonWriteOutbox.available_at <= datetime.now(timezone.utc),
                )
                .order_by(AmazonWriteOutbox.available_at.asc())
                .with_for_update(skip_locked=True)
                .limit(limit)
            )
        ).all()

        async with httpx.AsyncClient(
            timeout=httpx.Timeout(30.0),
            headers={"User-Agent": settings.sp_api_user_agent},
        ) as client:
            for outbox in rows:
                event = await session.get(ListingHealthEvent, outbox.event_id)
                if event is None:
                    logger.warning(
                        "Outbox entry references missing listing health event; skipping",
                        extra={"outbox_id": str(outbox.id), "event_id": str(outbox.event_id)},
                    )
                    outbox.status = "published"
                    outbox.published_at = datetime.now(timezone.utc)
                    outbox.last_error = "referenced_event_missing"
                    processed += 1
                    continue

                seller = await session.get(Seller, event.seller_id)
                if seller is None:
                    logger.warning(
                        "Outbox entry references missing seller; skipping",
                        extra={
                            "outbox_id": str(outbox.id),
                            "seller_id": str(event.seller_id),
                        },
                    )
                    outbox.status = "published"
                    outbox.published_at = datetime.now(timezone.utc)
                    outbox.last_error = "referenced_seller_missing"
                    processed += 1
                    continue

                if outbox.attempt_count >= settings.amazon_write_outbox_max_attempts:
                    logger.error(
                        "Outbox entry exceeded max attempts; dead-lettering",
                        extra={
                            "outbox_id": str(outbox.id),
                            "event_id": str(outbox.event_id),
                            "attempt_count": outbox.attempt_count,
                        },
                    )
                    outbox.status = "dead_letter"
                    outbox.last_error = "max_attempts_exceeded"
                    processed += 1
                    continue

                before_status = outbox.status
                await _execute_single_outbox_row(
                    session, outbox, event, seller, settings, client
                )
                processed += 1
                if outbox.status == "published":
                    published += 1
                elif outbox.status == "pending" and before_status == "pending":
                    rescheduled += 1

        await session.commit()

    return {
        "processed": processed,
        "published": published,
        "rescheduled": rescheduled,
        "broker_url": settings.celery_broker,
    }


@router.post(
    "/execute",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=OutboxExecuteResponse,
)
async def execute_outbox_payloads(
    x_admin_secret: str | None = Header(default=None, alias="x-admin-secret"),
) -> OutboxExecuteResponse:
    """HTTP-triggered endpoint for serverless outbox execution.

    Designed for Vercel Cron invocation (no persistent Celery worker required).
    Verifies the admin webhook secret, then drains pending catalog write
    outbox rows directly via the async SQLAlchemy session.
    """
    from backend.app.config import get_settings

    settings = get_settings()
    configured = settings.admin_webhook_secret
    if configured is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_WEBHOOK_SECRET is not configured",
        )
    expected = configured.get_secret_value()
    if not x_admin_secret or not hmac.compare_digest(x_admin_secret, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin webhook secret",
        )

    result = await _drain_outbox(settings.amazon_write_outbox_batch_limit)
    return OutboxExecuteResponse(
        processed=result["processed"],
        published=result["published"],
        rescheduled=result["rescheduled"],
        batch_limit=settings.amazon_write_outbox_batch_limit,
        broker_url=result["broker_url"],
        message=(
            f"Processed {result['processed']} outbox row(s), "
            f"published {result['published']}, rescheduled {result['rescheduled']}."
        ),
    )


@shared_task(
    name="backend.app.tasks.amazon_writes.execute_amazon_write_outbox_payloads",
    bind=True,
    max_retries=3,
)
def execute_amazon_write_outbox_payloads(self) -> dict[str, Any]:
    """Celery task: drain and execute pending Amazon write outbox payloads.

    Polls ``amazon_write_outbox`` for ``status = 'pending'`` rows routed to
    ``amzsphere.catalog_writes`` using ``FOR UPDATE SKIP LOCKED`` so multiple
    workers can consume concurrently without contention. Executes each payload
    against the SP-API Listings Items API via ``httpx.AsyncClient`` and
    evolves row status to ``published`` on success or reschedules with
    exponential backoff on throttling / API error.
    """
    try:
        return run_async(_drain_outbox(settings.amazon_write_outbox_batch_limit))
    except Exception as error:
        countdown = min(2 ** self.request.retries, 300)
        raise self.retry(exc=error, countdown=countdown)
