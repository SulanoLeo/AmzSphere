import uuid

from celery import shared_task
from redis.asyncio import Redis
from sqlalchemy import select

from backend.app.config import get_settings
from backend.app.db import SessionLocal
from backend.app.models import AgentOperation, AmazonFeed, CatalogItem, KeywordObservation, Seller
from backend.app.services.catalog_agent import (
    build_json_listings_feed,
    fetch_keyword_observations,
    optimize_copy,
    text_attribute,
)
from backend.app.services.encryption import decrypt_refresh_token
from backend.app.services.lwa import LwaTokenProvider
from backend.app.services.rate_limiter import RedisTokenBucket
from backend.app.services.sp_api import SpApiClient
from backend.app.tasks.runtime import run_async


async def _make_client(seller: Seller, redis: Redis) -> SpApiClient:
    settings = get_settings()
    if settings.lwa_client_id is None or settings.lwa_client_secret is None:
        raise RuntimeError("LWA client credentials are not configured")
    token_provider = LwaTokenProvider(
        redis,
        settings.lwa_client_id.get_secret_value(),
        settings.lwa_client_secret.get_secret_value(),
        settings.access_token_skew_seconds,
    )
    return SpApiClient(
        seller_id=seller.merchant_id,
        marketplace_id=seller.marketplace_id,
        region=seller.region,
        endpoint=seller.endpoint,
        refresh_token=decrypt_refresh_token(seller.lwa_refresh_token_encrypted),
        redis=redis,
        token_provider=token_provider,
        limiter=RedisTokenBucket(redis),
        settings=settings,
    )


async def _set_operation_failed(operation_id: uuid.UUID, error: Exception) -> None:
    async with SessionLocal() as session:
        operation = await session.get(AgentOperation, operation_id)
        if operation:
            operation.status = "failed"
            operation.error_code = type(error).__name__[:80]
            operation.error_message = "The operation failed. Check service configuration and redacted worker logs."
            operation.attempt_count += 1
            await session.commit()


async def _optimize_listing(operation_id: str) -> dict:
    settings = get_settings()
    operation_uuid = uuid.UUID(operation_id)
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        async with SessionLocal() as session:
            operation = await session.get(AgentOperation, operation_uuid)
            if operation is None:
                raise LookupError("Catalog operation not found")
            if operation.status in {"review_required", "approved", "submitted", "succeeded"}:
                return {"operation_id": operation_id, "status": operation.status}
            item = await session.scalar(select(CatalogItem).where(
                CatalogItem.seller_id == operation.seller_id,
                CatalogItem.asin == operation.asin,
                CatalogItem.sku == operation.request_payload["sku"],
            ))
            seller = await session.get(Seller, operation.seller_id)
            if item is None or seller is None:
                raise LookupError("Seller catalog item not found")
            operation.status = "running"
            operation.attempt_count += 1
            await session.commit()

            client = await _make_client(seller, redis)
            listing = await client.get_listing_item(item.sku)
            attributes = listing.get("attributes", {})
            title = text_attribute(attributes, "item_name")
            bullets = text_attribute(attributes, "bullet_point")
            current_copy = {"title": title, "bullet_points": bullets, "attributes": attributes}
            if not title:
                raise ValueError("SP-API listing did not include item_name for this marketplace")
            mode = operation.request_payload.get("optimization_mode", "free")
            helium10_api_key = operation.request_payload.get("helium10_api_key")
            if helium10_api_key is None and mode == "paid":
                helium10_api_key = settings.helium10_api_key.get_secret_value() if settings.helium10_api_key else None
            observations = await fetch_keyword_observations(
                mode,
                item.asin,
                seller.marketplace_id,
                helium10_api_key,
            )
            session.add_all([
                KeywordObservation(
                    seller_id=seller.id,
                    catalog_item_id=item.id,
                    operation_id=operation.id,
                    provider=observation["provider"],
                    query=observation["keyword"],
                    organic_rank=observation.get("organic_rank"),
                    indexed=observation.get("indexed", observation.get("organic_rank") is not None),
                )
                for observation in observations
            ])
            if settings.openai_api_key is None:
                raise RuntimeError("OPENAI_API_KEY is required for listing suggestions")
            suggestion = await optimize_copy(
                current_copy,
                observations,
                mode,
                settings.openai_api_key.get_secret_value(),
                settings.openai_model,
                helium10_api_key,
            )
            operation.result_payload = {
                "current_copy": {"title": title, "bullet_points": bullets},
                "keyword_observations": observations,
                "suggestion": suggestion,
                "product_type": item.product_type,
                "seller_sku": item.sku,
                "marketplace_id": seller.marketplace_id,
                "optimization_mode": mode,
                "health_score": suggestion.get("health_score", 0),
                "missing_high_volume_keywords": suggestion.get("missing_high_volume_keywords", []),
            }
            operation.status = "review_required"
            operation.error_code = None
            operation.error_message = None
            await session.commit()
            return {"operation_id": operation_id, "status": operation.status}
    except Exception as error:
        await _set_operation_failed(operation_uuid, error)
        raise
    finally:
        await redis.aclose()


async def _submit_approved_listing(operation_id: str) -> dict:
    settings = get_settings()
    if not settings.sp_api_enabled or settings.sp_api_dry_run:
        raise RuntimeError("SP-API feed writes are disabled")
    operation_uuid = uuid.UUID(operation_id)
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        async with SessionLocal() as session:
            operation = await session.get(AgentOperation, operation_uuid)
            if operation and operation.status in {"submitted", "succeeded"}:
                return {
                    "operation_id": operation_id,
                    "feed_id": (operation.result_payload or {}).get("amazon_feed_id"),
                    "status": operation.status,
                }
            existing_feed = await session.scalar(select(AmazonFeed).where(AmazonFeed.operation_id == operation_uuid)) if operation else None
            if existing_feed:
                if existing_feed.feed_id:
                    return {"operation_id": operation_id, "feed_id": existing_feed.feed_id, "status": operation.status}
                existing_feed.processing_status = "SUBMISSION_UNCERTAIN"
                operation.status = "needs_review"
                operation.error_code = "AMAZON_FEED_SUBMISSION_UNCERTAIN"
                operation.error_message = "A prior worker may have submitted this feed; reconcile with Amazon before retrying."
                await session.commit()
                return {"operation_id": operation_id, "status": "needs_review"}
            if operation is None or operation.status != "approved":
                raise ValueError("Only an approved catalog operation can be submitted")
            seller = await session.get(Seller, operation.seller_id)
            item = await session.scalar(select(CatalogItem).where(
                CatalogItem.seller_id == operation.seller_id,
                CatalogItem.asin == operation.asin,
                CatalogItem.sku == operation.request_payload["sku"],
            ))
            if seller is None or item is None or not operation.result_payload:
                raise LookupError("Approved listing data is incomplete")
            suggestion = operation.result_payload["suggestion"]
            feed = build_json_listings_feed(
                seller.merchant_id,
                item.sku,
                seller.marketplace_id,
                item.product_type,
                suggestion,
            )
            feed_record = AmazonFeed(
                operation_id=operation.id,
                seller_id=seller.id,
                processing_status="SUBMITTING",
            )
            session.add(feed_record)
            operation.status = "submitting"
            await session.commit()

            client = await _make_client(seller, redis)
            result = await client.submit_json_listings_feed(feed)
            feed_record.feed_id = result["feedId"]
            feed_record.processing_status = "IN_QUEUE"
            operation.status = "submitted"
            operation.result_payload = {**operation.result_payload, "amazon_feed_id": result["feedId"]}
            await session.commit()
            return {"operation_id": operation_id, "feed_id": result["feedId"], "status": "submitted"}
    except Exception as error:
        await _set_operation_failed(operation_uuid, error)
        raise
    finally:
        await redis.aclose()


@shared_task(name="backend.app.tasks.catalog.optimize_listing", bind=True, max_retries=4)
def optimize_listing(self, operation_id: str) -> dict:
    try:
        return run_async(_optimize_listing(operation_id))
    except Exception as error:
        raise self.retry(exc=error, countdown=min(2**self.request.retries, 120))


@shared_task(name="backend.app.tasks.catalog.submit_approved_listing", bind=True, max_retries=5)
def submit_approved_listing(self, operation_id: str) -> dict:
    try:
        return run_async(_submit_approved_listing(operation_id))
    except Exception as error:
        raise self.retry(exc=error, countdown=min(2**self.request.retries, 300))