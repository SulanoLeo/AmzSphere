import uuid
from decimal import Decimal

from celery import shared_task
from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from backend.app.db import SessionLocal
from backend.app.models import AgentOperation, CatalogItem, InventorySnapshot, PurchaseOrder, Vendor
from backend.app.services.inventory import generate_po_pdf, latest_inventory_for_items, sales_windows_for_items, velocity_summary
from backend.app.tasks.runtime import run_async


async def _scan_inventory(seller_id: str, operation_id: str | None = None) -> dict:
    seller_uuid = uuid.UUID(seller_id)
    async with SessionLocal() as session:
        items = (await session.scalars(
            select(CatalogItem).options(selectinload(CatalogItem.vendor)).where(CatalogItem.seller_id == seller_uuid)
        )).all()
        item_ids = [item.id for item in items]
        inventory_by_item = await latest_inventory_for_items(session, item_ids)
        sales_by_item = await sales_windows_for_items(session, item_ids)
        operation = await session.get(AgentOperation, uuid.UUID(operation_id)) if operation_id else None
        if operation and operation.status == "succeeded":
            return {"seller_id": seller_id, **(operation.result_payload or {})}
        result = []
        for item in items:
            snapshot = inventory_by_item.get(item.id)
            if snapshot is None:
                continue
            windows = sales_by_item.get(item.id, (0, 0, 0))
            summary = velocity_summary(snapshot.sellable_quantity, *windows)
            result.append({"asin": item.asin, "sku": item.sku, **summary})
            if not summary["reorder_flag"] or item.vendor is None:
                continue

            await session.execute(
                text("select pg_advisory_xact_lock(hashtext(:reorder_key))"),
                {"reorder_key": f"{seller_uuid}:{item.sku}"},
            )
            existing = await session.scalar(
                select(PurchaseOrder).where(
                    PurchaseOrder.seller_id == seller_uuid,
                    PurchaseOrder.vendor_id == item.vendor_id,
                    PurchaseOrder.status.in_(("pending_review", "approved")),
                    PurchaseOrder.lines.contains([{"sku": item.sku}]),
                )
            )
            if existing:
                continue

            unit_prices = item.vendor.po_spec.get("unit_prices", {})
            price = Decimal(str(unit_prices.get(item.sku, "0")))
            if price <= 0:
                continue
            reorder_units = max(1, int((Decimal(str(summary["velocity_30d"])) * 45 - snapshot.sellable_quantity).to_integral_value(rounding="ROUND_CEILING")))
            line_total = price * reorder_units
            total_minor = int((line_total * 100).to_integral_value())
            po_id = uuid.uuid4()
            lines = [{
                "sku": item.sku,
                "asin": item.asin,
                "quantity": reorder_units,
                "unit_price": f"{price:.2f}",
                "line_total": f"{line_total:.2f}",
                "currency": item.vendor.currency,
            }]
            pdf = generate_po_pdf(item.vendor, po_id, lines, item.vendor.currency, total_minor)
            session.add(PurchaseOrder(
                id=po_id,
                seller_id=seller_uuid,
                vendor_id=item.vendor_id,
                status="pending_review",
                currency=item.vendor.currency,
                total_amount_minor=total_minor,
                lines=lines,
                pdf_bytes=pdf,
            ))
        if operation:
            operation.status = "succeeded"
            operation.result_payload = {"items": result}
        await session.commit()
        return {"seller_id": seller_id, "items": result}


@shared_task(name="backend.app.tasks.inventory.scan_seller_inventory", bind=True, max_retries=5)
def scan_seller_inventory(self, seller_id: str, operation_id: str | None = None) -> dict:
    try:
        return run_async(_scan_inventory(seller_id, operation_id))
    except Exception as error:
        raise self.retry(exc=error, countdown=min(2**self.request.retries, 300))