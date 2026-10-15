import asyncio
import uuid
from datetime import date, datetime, time, timedelta, timezone

from celery import shared_task
from redis.asyncio import Redis
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy import select

from backend.app.config import get_settings
from backend.app.db import SessionLocal
from backend.app.models import AgentOperation, CatalogItem, InventorySnapshot, OutboxEvent, SalesDaily, Seller
from backend.app.tasks.catalog import _make_client
from backend.app.tasks.runtime import run_async


def _listing_summary_for_marketplace(item: dict, marketplace_id: str) -> dict | None:
    return next((summary for summary in item.get("summaries", []) if summary.get("marketplaceId") == marketplace_id), None)


def _product_type_for_marketplace(item: dict, marketplace_id: str, summary: dict) -> str:
    product_type = next((value.get("productType") for value in item.get("productTypes", []) if value.get("marketplaceId") == marketplace_id), None)
    return product_type or summary.get("productType") or "UNKNOWN"


def _sales_interval(today: date) -> str:
    start = datetime.combine(today - timedelta(days=89), time.min, timezone.utc)
    end = datetime.combine(today + timedelta(days=1), time.min, timezone.utc)
    return f"{start:%Y-%m-%dT%H:%M:%SZ}--{end:%Y-%m-%dT%H:%M:%SZ}"


def _metric_day(metric: dict) -> date:
    interval_start = metric["interval"].split("--", 1)[0]
    return datetime.fromisoformat(interval_start.replace("Z", "+00:00")).date()


async def _sync_seller_data(seller_id: str, operation_id: str | None = None) -> dict:
    settings = get_settings()
    seller_uuid = uuid.UUID(seller_id)
    redis = Redis.from_url(settings.redis_url, decode_responses=True)
    try:
        async with SessionLocal() as session:
            seller = await session.get(Seller, seller_uuid)
            if seller is None:
                raise LookupError("Seller not found")
            operation = await session.get(AgentOperation, uuid.UUID(operation_id)) if operation_id else None
            if operation and operation.status == "succeeded":
                return {"seller_id": seller_id, **(operation.result_payload or {})}
            if operation:
                operation.status = "running"
                operation.attempt_count += 1
                await session.commit()
            sp_api = await _make_client(seller, redis)

            listed_items = []
            page_token = None
            pages = 0
            while True:
                page = await sp_api.search_listing_items(page_token)
                listed_items.extend(page.get("items", []))
                page_token = (page.get("pagination") or {}).get("nextToken")
                pages += 1
                if not page_token:
                    break
                if pages >= 50:
                    raise RuntimeError("Listings pagination reached the 1,000-item safety ceiling")

            existing_items = (await session.scalars(select(CatalogItem).where(
                CatalogItem.seller_id == seller_uuid,
            ))).all()
            existing_by_sku = {catalog_item.sku: catalog_item for catalog_item in existing_items}
            catalog_by_sku = {}
            for listing in listed_items:
                summary = _listing_summary_for_marketplace(listing, seller.marketplace_id)
                sku = listing.get("sku")
                asin = summary.get("asin") if summary else None
                if not sku or not asin:
                    continue
                catalog_item = existing_by_sku.get(sku)
                if catalog_item is None:
                    catalog_item = CatalogItem(
                        seller_id=seller_uuid,
                        sku=sku,
                        asin=asin,
                        product_type=_product_type_for_marketplace(listing, seller.marketplace_id, summary),
                        listing_attributes=listing.get("attributes", {}),
                    )
                    session.add(catalog_item)
                    await session.flush()
                else:
                    catalog_item.asin = asin
                    catalog_item.product_type = _product_type_for_marketplace(listing, seller.marketplace_id, summary)
                    catalog_item.listing_attributes = listing.get("attributes", {})
                catalog_by_sku[sku] = (catalog_item, listing)
            await session.flush()

            inventory_count = 0
            inventory_summaries = []
            skus = list(catalog_by_sku)
            for offset in range(0, len(skus), 50):
                inventory_response = await sp_api.get_fba_inventory_summaries(skus[offset:offset + 50])
                inventory_summaries.extend(((inventory_response.get("payload") or {}).get("inventorySummaries") or []))
            now = datetime.now(timezone.utc)
            for summary in inventory_summaries:
                sku = summary.get("sellerSku")
                record = catalog_by_sku.get(sku)
                if not record:
                    continue
                details = summary.get("inventoryDetails") or {}
                sellable = int(details.get("fulfillableQuantity", 0) or 0)
                reserved = int((details.get("reservedQuantity") or {}).get("totalReservedQuantity", 0) or 0)
                session.add(InventorySnapshot(
                    catalog_item_id=record[0].id,
                    captured_at=now,
                    sellable_quantity=sellable,
                    reserved_quantity=reserved,
                ))
                inventory_count += 1
            await session.flush()

            sales_rows = []
            sales_errors = 0
            today = date.today()
            interval = _sales_interval(today)
            for sku, (catalog_item, _listing) in catalog_by_sku.items():
                try:
                    metric_response = await sp_api.get_order_metrics(sku, interval)
                except Exception:
                    sales_errors += 1
                    continue
                for metric in metric_response.get("payload", []):
                    sales_date = _metric_day(metric)
                    if sales_date < today - timedelta(days=89) or sales_date > today:
                        continue
                    sales_rows.append({
                        "catalog_item_id": catalog_item.id,
                        "sales_date": sales_date,
                        "source": "sp_api",
                        "units_ordered": int(metric.get("unitCount", 0) or 0),
                    })

            for offset in range(0, len(sales_rows), 1000):
                batch = sales_rows[offset:offset + 1000]
                insert_statement = pg_insert(SalesDaily).values(batch)
                await session.execute(insert_statement.on_conflict_do_update(
                    index_elements=[SalesDaily.catalog_item_id, SalesDaily.sales_date, SalesDaily.source],
                    set_={"units_ordered": insert_statement.excluded.units_ordered},
                ))

            summary_payload = {
                "catalog_items": len(catalog_by_sku),
                "inventory_snapshots": inventory_count,
                "sales_daily_rows": len(sales_rows),
                "sales_errors": sales_errors,
            }
            if operation:
                operation.status = "partial" if sales_errors else "succeeded"
                operation.result_payload = summary_payload
                operation.error_code = "SALES_METRICS_PARTIAL" if sales_errors else None
                operation.error_message = "Some SKU sales metrics were unavailable; missing values were not treated as zero." if sales_errors else None
            await session.commit()
            return {"seller_id": seller_id, **summary_payload}
    finally:
        await redis.aclose()


async def _enqueue_connected_seller_syncs() -> int:
    interval = max(get_settings().seller_sync_interval_seconds, 60)
    window = int(datetime.now(timezone.utc).timestamp() // interval)
    enqueued = 0
    async with SessionLocal() as session:
        sellers = (await session.scalars(select(Seller).order_by(Seller.id).with_for_update(skip_locked=True))).all()
        for seller in sellers:
            active = await session.scalar(select(AgentOperation.id).where(
                AgentOperation.seller_id == seller.id,
                AgentOperation.operation_type == "seller_data_sync",
                AgentOperation.status.in_(("queued", "running")),
            ).limit(1))
            if active:
                continue
            operation = AgentOperation(
                seller_id=seller.id,
                operation_type="seller_data_sync",
                status="queued",
                idempotency_key=f"scheduled-sync:{window}",
            )
            session.add(operation)
            await session.flush()
            session.add(OutboxEvent(
                event_type="backend.app.tasks.ingestion.sync_seller_data",
                payload={"args": [str(seller.id), str(operation.id)]},
            ))
            enqueued += 1
        await session.commit()
    return enqueued


@shared_task(name="backend.app.tasks.ingestion.sync_seller_data", bind=True, max_retries=5, acks_late=True)
def sync_seller_data(self, seller_id: str, operation_id: str | None = None) -> dict:
    try:
        return run_async(_sync_seller_data(seller_id, operation_id))
    except Exception as error:
        raise self.retry(exc=error, countdown=min(2**self.request.retries, 300))


@shared_task(name="backend.app.tasks.ingestion.enqueue_connected_seller_syncs")
def enqueue_connected_seller_syncs() -> int:
    return run_async(_enqueue_connected_seller_syncs())