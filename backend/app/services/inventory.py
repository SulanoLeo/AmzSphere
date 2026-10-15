import io
import math
from datetime import date, timedelta
from decimal import Decimal

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import case, func, select

from backend.app.models import CatalogItem, InventorySnapshot, SalesDaily


def velocity_summary(stock: int | None, units_7d: int, units_30d: int, units_90d: int) -> dict:
    velocity_7d = units_7d / 7
    velocity_30d = units_30d / 30
    velocity_90d = units_90d / 90
    days_supply = stock / velocity_30d if stock is not None and velocity_30d > 0 else None
    return {
        "stock": stock,
        "velocity_7d": round(velocity_7d, 3),
        "velocity_30d": round(velocity_30d, 3),
        "velocity_90d": round(velocity_90d, 3),
        "days_supply": round(days_supply, 2) if days_supply is not None else None,
        "reorder_flag": stock is not None and days_supply is not None and days_supply < 30,
    }


async def item_sales_windows(session, item_id, today: date | None = None) -> tuple[int, int, int]:
    today = today or date.today()
    windows = []
    for days in (7, 30, 90):
        result = await session.scalar(
            select(func.coalesce(func.sum(SalesDaily.units_ordered), 0)).where(
                SalesDaily.catalog_item_id == item_id,
                SalesDaily.sales_date >= today - timedelta(days=days - 1),
                SalesDaily.sales_date <= today,
            )
        )
        windows.append(int(result or 0))
    return tuple(windows)


async def sales_windows_for_items(session, item_ids, today: date | None = None) -> dict:
    if not item_ids:
        return {}
    today = today or date.today()
    statement = select(
        SalesDaily.catalog_item_id,
        func.coalesce(func.sum(case((SalesDaily.sales_date >= today - timedelta(days=6), SalesDaily.units_ordered), else_=0)), 0).label("units_7d"),
        func.coalesce(func.sum(case((SalesDaily.sales_date >= today - timedelta(days=29), SalesDaily.units_ordered), else_=0)), 0).label("units_30d"),
        func.coalesce(func.sum(SalesDaily.units_ordered), 0).label("units_90d"),
    ).where(
        SalesDaily.catalog_item_id.in_(item_ids),
        SalesDaily.sales_date >= today - timedelta(days=89),
        SalesDaily.sales_date <= today,
    ).group_by(SalesDaily.catalog_item_id)
    rows = (await session.execute(statement)).all()
    return {row.catalog_item_id: (int(row.units_7d), int(row.units_30d), int(row.units_90d)) for row in rows}


async def latest_inventory_for_items(session, item_ids) -> dict:
    if not item_ids:
        return {}
    ranked = select(
        InventorySnapshot.id.label("snapshot_id"),
        func.row_number().over(
            partition_by=InventorySnapshot.catalog_item_id,
            order_by=(InventorySnapshot.captured_at.desc(), InventorySnapshot.id.desc()),
        ).label("row_number"),
    ).where(InventorySnapshot.catalog_item_id.in_(item_ids)).subquery()
    snapshots = (await session.scalars(
        select(InventorySnapshot)
        .join(ranked, ranked.c.snapshot_id == InventorySnapshot.id)
        .where(ranked.c.row_number == 1)
    )).all()
    return {snapshot.catalog_item_id: snapshot for snapshot in snapshots}


def generate_po_pdf(vendor, po_id, lines: list[dict], currency: str, total_minor: int) -> bytes:
    config = vendor.po_spec or {}
    address = vendor.address or {}
    buffer = io.BytesIO()
    document = SimpleDocTemplate(buffer, pagesize=letter, title=f"Purchase Order {po_id}")
    styles = getSampleStyleSheet()
    story = [Paragraph(config.get("document_title", "PURCHASE ORDER"), styles["Title"]), Spacer(1, 12)]
    story.append(Paragraph(f"PO: {po_id}", styles["Heading2"]))
    story.append(Paragraph(f"Supplier: {vendor.name} ({vendor.vendor_code})", styles["BodyText"]))
    if vendor.email:
        story.append(Paragraph(f"Email: {vendor.email}", styles["BodyText"]))
    address_text = ", ".join(str(value) for value in address.values() if value)
    if address_text:
        story.append(Paragraph(address_text, styles["BodyText"]))
    story.append(Spacer(1, 16))
    rows = [["SKU", "ASIN", "Quantity", f"Unit Price ({currency})", f"Line Total ({currency})"]]
    rows.extend([
        [line["sku"], line["asin"], str(line["quantity"]), line["unit_price"], line["line_total"]]
        for line in lines
    ])
    rows.append(["", "", "", "Total", f"{Decimal(total_minor) / 100:.2f}"])
    table = Table(rows, repeatRows=1, colWidths=[100, 90, 65, 110, 110])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#252e52")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd2dc")),
        ("ALIGN", (2, 1), (-1, -1), "RIGHT"),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eef1f5")),
        ("FONTNAME", (0, 0), (-1, 0), config.get("header_font", "Helvetica-Bold")),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.extend([table, Spacer(1, 16), Paragraph(config.get("footer_note", "Pending review; this document is not a supplier order."), styles["Italic"])])
    document.build(story)
    return buffer.getvalue()


async def scan_seller_inventory(session, seller_id):
    today = date.today()
    items = (await session.scalars(
        select(CatalogItem).where(CatalogItem.seller_id == seller_id).order_by(CatalogItem.sku)
    )).all()
    report = []
    for item in items:
        latest = await session.scalar(
            select(InventorySnapshot)
            .where(InventorySnapshot.catalog_item_id == item.id)
            .order_by(InventorySnapshot.captured_at.desc())
            .limit(1)
        )
        if latest is None:
            continue
        units_7d, units_30d, units_90d = await item_sales_windows(session, item.id, today)
        summary = velocity_summary(latest.sellable_quantity, units_7d, units_30d, units_90d)
        report.append({"asin": item.asin, "sku": item.sku, **summary})
    return items, report