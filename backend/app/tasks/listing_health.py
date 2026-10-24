"""Asynchronous background processor for AmzSphere Listing Suppression Guard.

Defines a Celery task that drains the ``listing_health_events`` staging table,
evaluates each pending row for critical listing issues (active suppression or
pricing block), constructs a structural notification dictionary, and evolves
the row status to ``processed`` or ``failed`` atomically.

The task uses ``SELECT ... FOR UPDATE SKIP LOCKED`` so multiple Celery workers
can consume the same table without contending on already-locked rows.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from celery import shared_task
from sqlalchemy import select

from backend.app.config import get_settings
from backend.app.db import SessionLocal
from backend.app.models import ListingHealthEvent
from backend.app.tasks.runtime import run_async

logger = logging.getLogger(__name__)

# Listing statuses that indicate a critical, customer-facing suppression.
CRITICAL_LISTING_STATUSES = frozenset(
    {"NOT_BUYABLE", "SUPPRESSED", "INACTIVE", "SEARCH_SUPPRESSED", "DISCOVERABLE_SUPPRESSED"}
)

# Default batch size for a single drain cycle to avoid long transactions.
DEFAULT_BATCH_LIMIT = 100


def _is_critical_listing_issue(event: ListingHealthEvent) -> bool:
    """Return True when the event represents an active suppression or pricing block."""
    if bool(event.is_suppressed):
        return True
    status = (event.listing_status or "").strip().upper()
    if status in CRITICAL_LISTING_STATUSES:
        return True
    if event.error_codes:
        return True
    return False


def _build_structural_notification(event: ListingHealthEvent) -> dict[str, Any]:
    """Construct a structural notification dictionary from a health event row.

    The dictionary is intentionally free of SQLAlchemy instances so it can be
    serialized to JSON and handed off to downstream alerting or remediation
    systems without leaking ORM state.
    """
    return {
        "event_id": str(event.id),
        "seller_id": str(event.seller_id),
        "notification_id": event.notification_id,
        "notification_type": event.notification_type,
        "asin": event.asin,
        "sku": event.sku,
        "marketplace_id": event.marketplace_id,
        "listing_status": event.listing_status,
        "error_codes": list(event.error_codes or []),
        "error_messages": list(event.error_messages or []),
        "is_suppressed": bool(event.is_suppressed),
        "received_at": event.received_at.isoformat() if event.received_at else None,
        "raw_payload": event.raw_payload or {},
    }


async def _drain_pending_events(limit: int = DEFAULT_BATCH_LIMIT) -> dict[str, Any]:
    """Query, evaluate, and evolve pending listing health events in one transaction.

    Uses ``SELECT ... FOR UPDATE SKIP LOCKED`` so concurrent workers skip rows
    already locked by another transaction instead of blocking.
    """
    settings = get_settings()
    processed = 0
    failed = 0
    critical_notifications: list[dict[str, Any]] = []

    async with SessionLocal() as session:
        events = (
            await session.scalars(
                select(ListingHealthEvent)
                .where(ListingHealthEvent.status == "pending_review")
                .order_by(ListingHealthEvent.received_at.asc())
                .with_for_update(skip_locked=True)
                .limit(limit)
            )
        ).all()

        for event in events:
            try:
                notification = _build_structural_notification(event)
                if _is_critical_listing_issue(event):
                    critical_notifications.append(notification)
                    logger.info(
                        "Critical listing health event staged for review",
                        extra={
                            "event_id": str(event.id),
                            "asin": event.asin,
                            "sku": event.sku,
                            "marketplace_id": event.marketplace_id,
                            "listing_status": event.listing_status,
                            "is_suppressed": bool(event.is_suppressed),
                            "error_codes": list(event.error_codes or []),
                        },
                    )

                event.status = "processed"
                event.processed_at = datetime.now(timezone.utc)
                processed += 1
            except Exception as error:  # noqa: BLE001 - resilient evolution to failed
                logger.exception(
                    "Failed to process listing health event; marking failed",
                    extra={"event_id": str(event.id), "error": str(error)},
                )
                event.status = "failed"
                event.processed_at = datetime.now(timezone.utc)
                failed += 1

        await session.commit()

    return {
        "processed": processed,
        "failed": failed,
        "critical_notifications": critical_notifications,
        "broker_url": settings.celery_broker,
    }


@shared_task(
    name="backend.app.tasks.listing_health.process_listing_health_events",
    bind=True,
    max_retries=3,
)
def process_listing_health_events(self) -> dict[str, Any]:
    """Celery task: process pending listing_health_events rows asynchronously.

    Runs on a periodic beat schedule (every 60 seconds) or can be triggered
    directly by the outbox publisher. Drains ``listing_health_events`` where
    ``status = 'pending_review'`` using ``FOR UPDATE SKIP LOCKED`` to prevent
    worker race conditions.
    """
    try:
        return run_async(_drain_pending_events())
    except Exception as error:
        countdown = min(2 ** self.request.retries, 300)
        raise self.retry(exc=error, countdown=countdown)
