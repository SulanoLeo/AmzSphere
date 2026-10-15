import gzip
import hashlib
import json
import uuid

import httpx
from celery import shared_task
from redis.asyncio import Redis
from sqlalchemy import select

from backend.app.config import get_settings
from backend.app.db import SessionLocal
from backend.app.models import AgentOperation, AmazonFeed, Seller
from backend.app.services.encryption import decrypt_refresh_token
from backend.app.services.lwa import LwaTokenProvider
from backend.app.services.rate_limiter import RedisTokenBucket
from backend.app.services.sp_api import SpApiClient
from backend.app.tasks.runtime import run_async


def normalize_feed_notification(envelope: dict) -> dict:
    notification_type = envelope.get("notificationType")
    payload = envelope.get("payload", {})
    notification = payload.get("feedProcessingFinishedNotification", payload)
    if notification_type not in (None, "FEED_PROCESSING_FINISHED"):
        raise ValueError("Unsupported Amazon notification type")
    required = ("sellerId", "feedId", "processingStatus")
    if any(not notification.get(field) for field in required):
        raise ValueError("Feed notification is missing required identifiers")
    stable = envelope.get("notificationId") or json.dumps(envelope, sort_keys=True, separators=(",", ":"))
    return {
        "notification_id": str(envelope.get("notificationId") or hashlib.sha256(stable.encode()).hexdigest()),
        "seller_id": notification["sellerId"],
        "feed_id": notification["feedId"],
        "processing_status": notification["processingStatus"],
        "result_feed_document_id": notification.get("resultFeedDocumentId"),
        "feed_type": notification.get("feedType"),
    }


def summarize_processing_report(payload) -> dict | None:
    if isinstance(payload, dict) and isinstance(payload.get("summary"), dict):
        summary = payload["summary"]
        if "errors" in summary or "warnings" in summary:
            return {"errors": int(summary.get("errors", 0) or 0), "warnings": int(summary.get("warnings", 0) or 0)}
    if isinstance(payload, dict) and isinstance(payload.get("issues"), list):
        issues = payload["issues"]
        return {
            "errors": sum(1 for issue in issues if str(issue.get("severity", "")).upper() == "ERROR"),
            "warnings": sum(1 for issue in issues if str(issue.get("severity", "")).upper() == "WARNING"),
        }
    if isinstance(payload, list):
        return {
            "errors": sum(1 for issue in payload if isinstance(issue, dict) and str(issue.get("severity", "")).upper() == "ERROR"),
            "warnings": sum(1 for issue in payload if isinstance(issue, dict) and str(issue.get("severity", "")).upper() == "WARNING"),
        }
    return None


async def _handle_feed_notification(envelope: dict) -> dict:
    event = normalize_feed_notification(envelope)
    async with SessionLocal() as session:
        feed = await session.scalar(
            select(AmazonFeed).join(Seller, Seller.id == AmazonFeed.seller_id).where(
                AmazonFeed.feed_id == event["feed_id"],
                Seller.merchant_id == event["seller_id"],
            )
        )
        if feed is None:
            return {"accepted": False, "reason": "unknown_feed"}
        if feed.notification_id == event["notification_id"]:
            return {"accepted": True, "duplicate": True}
        feed.notification_id = event["notification_id"]
        feed.processing_status = event["processing_status"]
        feed.result_document_id = event["result_feed_document_id"]
        operation = await session.get(AgentOperation, feed.operation_id)
        if operation:
            operation.status = "feed_report_pending" if event["processing_status"] == "DONE" else "failed"
            if event["processing_status"] == "DONE" and not event["result_feed_document_id"]:
                operation.status = "needs_review"
                operation.error_code = "AMAZON_FEED_REPORT_MISSING"
                operation.error_message = "Amazon marked the feed done without a result document; verify the listing before retrying."
            if event["processing_status"] != "DONE":
                operation.error_code = "AMAZON_FEED_" + str(event["processing_status"])
                operation.error_message = "Amazon reported that feed processing did not complete successfully."
        await session.commit()
        feed_id = str(feed.id)
    if event["processing_status"] in {"DONE", "FATAL"} and event["result_feed_document_id"]:
        fetch_feed_processing_report.delay(feed_id)
    return {"accepted": True, "feed_record_id": feed_id}


async def _download_and_reconcile(feed_record_id: str) -> dict:
    settings = get_settings()
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        async with SessionLocal() as session:
            feed = await session.get(AmazonFeed, uuid.UUID(feed_record_id))
            if feed is None or not feed.result_document_id:
                raise LookupError("Completed feed result document not found")
            seller = await session.get(Seller, feed.seller_id)
            operation = await session.get(AgentOperation, feed.operation_id)
            if seller is None or operation is None:
                raise LookupError("Feed is missing its seller or operation")
            client_id = settings.lwa_client_id
            client_secret = settings.lwa_client_secret
            if client_id is None or client_secret is None:
                raise RuntimeError("LWA credentials are not configured")
            provider = LwaTokenProvider(
                redis,
                client_id.get_secret_value(),
                client_secret.get_secret_value(),
                settings.access_token_skew_seconds,
            )
            sp_api = SpApiClient(
                seller.merchant_id,
                seller.marketplace_id,
                seller.region,
                seller.endpoint,
                decrypt_refresh_token(seller.lwa_refresh_token_encrypted),
                redis,
                provider,
                RedisTokenBucket(redis),
                settings,
            )
            document = await sp_api.get_feed_document(feed.result_document_id)
            async with httpx.AsyncClient(timeout=httpx.Timeout(40)) as client:
                response = await client.get(document["url"])
                response.raise_for_status()
            report_bytes = response.content
            if document.get("compressionAlgorithm") == "GZIP":
                report_bytes = gzip.decompress(report_bytes)
            report_text = report_bytes.decode("utf-8", errors="replace")
            try:
                report_payload = json.loads(report_text)
            except json.JSONDecodeError:
                report_payload = None
            summary = summarize_processing_report(report_payload)
            feed.completed_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
            if summary is None:
                feed.processing_summary = {"review_required": True, "reason": "unrecognized_report_format"}
                feed.processing_status = "DONE_NEEDS_REVIEW"
                operation.status = "needs_review"
                operation.error_code = "AMAZON_FEED_REPORT_UNRECOGNIZED"
                operation.error_message = "Amazon feed completed, but its report format could not be safely interpreted."
                await session.commit()
                return {"feed_id": feed.feed_id, "status": operation.status, "needs_review": True}

            errors = summary["errors"]
            warnings = summary["warnings"]
            feed.processing_summary = summary
            operation.result_payload = {**(operation.result_payload or {}), "feed_processing_summary": summary}
            if errors:
                operation.status = "failed"
                operation.error_code = "AMAZON_FEED_ITEM_ERRORS"
                operation.error_message = "Amazon accepted the feed but reported item-level errors. Review the processing report."
                feed.processing_status = "DONE_WITH_ERRORS"
            elif feed.processing_status == "FATAL":
                operation.status = "failed"
                operation.error_code = "AMAZON_FEED_FATAL"
                operation.error_message = "Amazon stopped feed processing. Review the processing report before retrying."
            else:
                operation.status = "succeeded"
                operation.error_code = None
                operation.error_message = None
                feed.processing_status = "DONE"
            await session.commit()
            return {"feed_id": feed.feed_id, "status": operation.status, "warnings": warnings, "errors": errors}
    finally:
        await redis.aclose()


@shared_task(name="backend.app.tasks.notifications.handle_feed_processing_finished", bind=True, max_retries=5)
def handle_feed_processing_finished(self, envelope: dict) -> dict:
    try:
        return run_async(_handle_feed_notification(envelope))
    except Exception as error:
        raise self.retry(exc=error, countdown=min(2**self.request.retries, 300))


@shared_task(name="backend.app.tasks.notifications.fetch_feed_processing_report", bind=True, max_retries=5)
def fetch_feed_processing_report(self, feed_record_id: str) -> dict:
    try:
        return run_async(_download_and_reconcile(feed_record_id))
    except Exception as error:
        raise self.retry(exc=error, countdown=min(2**self.request.retries, 300))