"""Serverless PDF compilation for AmzSphere B2B Procurement.

Triggered by an external scheduler (e.g., Vercel Cron) to compile pending
purchase order drafts into in-memory PDFs using ReportLab Platypus. The entire
pipeline is stateless: no local disk paths, in-memory byte buffers only, and
atomic status evolution per staging row.
"""

from __future__ import annotations

import base64
import io
import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    KeepTogether,
    SimpleDocTemplate,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db import SessionLocal
from backend.app.models import PendingPDFGeneration, PurchaseOrder, Vendor
from backend.app.schemas import CompilePDFBatchResponse

router = APIRouter(prefix="/api/v1/procurement/pdf", tags=["Procurement PDF"])


async def get_async_db() -> AsyncSession:
    """FastAPI dependency that yields an async SQLAlchemy session."""
    async with SessionLocal() as session:
        yield session


def _verify_admin_secret(
    x_admin_secret: str | None = Header(default=None, alias="x-admin-secret"),
    settings: Any = None,
) -> None:
    """Verify the administrative webhook secret key.

    Placeholder for production: compare against a configured admin webhook
    secret using constant-time comparison.
    """
    if settings is None:
        from backend.app.config import get_settings

        settings = get_settings()

    configured = settings.admin_webhook_secret
    if configured is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ADMIN_WEBHOOK_SECRET is not configured",
        )
    expected = configured.get_secret_value()
    if not x_admin_secret or not __import__("hmac").compare_digest(
        x_admin_secret, expected
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin webhook secret",
        )


def _styles() -> dict[str, ParagraphStyle]:
    """Return a dictionary of custom ParagraphStyle configurations."""
    return {
        "company": ParagraphStyle(
            "Company",
            fontName="Helvetica-Bold",
            fontSize=16,
            leading=20,
            textColor=colors.HexColor("#1e3a8a"),
            spaceAfter=2,
        ),
        "company_sub": ParagraphStyle(
            "CompanySub",
            fontName="Helvetica",
            fontSize=9,
            leading=12,
            textColor=colors.HexColor("#4b5563"),
            spaceAfter=8,
        ),
        "disclaimer": ParagraphStyle(
            "Disclaimer",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#b91c1c"),
            alignment=1,  # center
            spaceAfter=10,
        ),
        "section": ParagraphStyle(
            "Section",
            fontName="Helvetica-Bold",
            fontSize=11,
            leading=14,
            textColor=colors.HexColor("#1e3a8a"),
            spaceBefore=10,
            spaceAfter=4,
        ),
        "field_label": ParagraphStyle(
            "FieldLabel",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#374151"),
        ),
        "field_value": ParagraphStyle(
            "FieldValue",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#111827"),
        ),
        "table_header": ParagraphStyle(
            "TableHeader",
            fontName="Helvetica-Bold",
            fontSize=8.5,
            leading=11,
            textColor=colors.white,
            alignment=1,
        ),
        "table_cell": ParagraphStyle(
            "TableCell",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#111827"),
        ),
        "table_cell_right": ParagraphStyle(
            "TableCellRight",
            fontName="Helvetica",
            fontSize=8.5,
            leading=11,
            textColor=colors.HexColor("#111827"),
            alignment=2,  # right
        ),
        "total": ParagraphStyle(
            "Total",
            fontName="Helvetica-Bold",
            fontSize=10,
            leading=13,
            textColor=colors.HexColor("#1e3a8a"),
            alignment=2,
            spaceBefore=6,
        ),
    }


def _build_po_pdf(
    *,
    vendor: Vendor | None,
    purchase_order: PurchaseOrder,
    batch_token: str,
    execution_strategy: str,
    payload: dict[str, Any],
) -> bytes:
    """Compile a B2B Purchase Order draft PDF into an in-memory byte buffer."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        leftMargin=0.75 * inch,
        rightMargin=0.75 * inch,
        topMargin=0.75 * inch,
        bottomMargin=0.75 * inch,
        title=f"Purchase Order Draft - {purchase_order.id}",
        author="AmzSphere B2B Procurement",
    )

    styles = _styles()
    story: list[Any] = []

    # --- Header block ---
    header_content = [
        Paragraph("AmzSphere B2B Procurement", styles["company"]),
        Paragraph(
            "Amazon Seller Operations Workspace &bull; Purchase Order Draft",
            styles["company_sub"],
        ),
        Paragraph(
            "DRAFT - NOT AN ORDER TRANSMISSION",
            styles["disclaimer"],
        ),
    ]
    story.append(KeepTogether(header_content))

    # --- Vendor / corporate info block ---
    vendor_name = vendor.name if vendor else "Unknown Vendor"
    vendor_code = getattr(vendor, "vendor_code", None) or ""
    po_id_str = str(purchase_order.id)

    info_rows = [
        [
            Paragraph("Vendor", styles["field_label"]),
            Paragraph(vendor_name, styles["field_value"]),
            Paragraph("Batch Token", styles["field_label"]),
            Paragraph(batch_token[:12], styles["field_value"]),
        ],
        [
            Paragraph("Vendor Code", styles["field_label"]),
            Paragraph(vendor_code, styles["field_value"]),
            Paragraph("Execution Strategy", styles["field_value"]),
            Paragraph(execution_strategy, styles["field_value"]),
        ],
        [
            Paragraph("PO ID", styles["field_label"]),
            Paragraph(po_id_str, styles["field_value"]),
            Paragraph("Currency", styles["field_label"]),
            Paragraph(purchase_order.currency, styles["field_value"]),
        ],
        [
            Paragraph("Status", styles["field_label"]),
            Paragraph(purchase_order.status, styles["field_value"]),
            Paragraph("Generated", styles["field_label"]),
            Paragraph(
                datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
                styles["field_value"],
            ),
        ],
    ]

    info_table = Table(info_rows, colWidths=[0.85 * inch, 2.35 * inch, 1.15 * inch, 1.65 * inch])
    info_table.setStyle(
        TableStyle(
            [
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#e5e7eb")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f3f4f6")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f3f4f6")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    story.append(info_table)

    # --- Line items matrix ---
    story.append(Paragraph("Line Items", styles["section"]))

    lines = purchase_order.lines or []
    if not isinstance(lines, list):
        lines = []

    table_data = [
        [
            Paragraph("SKU", styles["table_header"]),
            Paragraph("Product / Item", styles["table_header"]),
            Paragraph("Qty", styles["table_header"]),
            Paragraph("Unit Cost", styles["table_header"]),
            Paragraph("Subtotal", styles["table_header"]),
        ]
    ]

    grand_total = 0.0
    for line in lines:
        sku = str(line.get("sku", ""))
        title = str(line.get("title", line.get("asin", "")))
        qty = int(line.get("quantity", 0))
        unit_price = float(line.get("unit_price", 0) or 0)
        subtotal = qty * unit_price
        grand_total += subtotal

        table_data.append(
            [
                Paragraph(sku, styles["table_cell"]),
                Paragraph(title, styles["table_cell"]),
                Paragraph(str(qty), styles["table_cell_right"]),
                Paragraph(f"{unit_price:.2f}", styles["table_cell_right"]),
                Paragraph(f"{subtotal:.2f}", styles["table_cell_right"]),
            ]
        )

    table_data.append(
        [
            Paragraph("", styles["table_cell"]),
            Paragraph("", styles["table_cell"]),
            Paragraph("", styles["table_cell"]),
            Paragraph("Grand Total", styles["table_cell_right"]),
            Paragraph(f"{grand_total:.2f}", styles["total"]),
        ]
    )

    col_widths = [0.9 * inch, 2.6 * inch, 0.6 * inch, 1.0 * inch, 0.9 * inch]
    items_table = Table(table_data, colWidths=col_widths, repeatRows=1)
    items_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1e3a8a")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#f9fafb")]),
                ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#eff6ff")),
                ("LINEABOVE", (0, -1), (-1, -1), 1, colors.HexColor("#1e3a8a")),
            ]
        )
    )
    story.append(items_table)

    # --- Footer disclaimer ---
    story.append(Spacer(1, 0.25 * inch))
    story.append(
        Paragraph(
            "This document is a draft generated by the AmzSphere B2B Procurement "
            "workspace. It does not constitute a transmitted purchase order until "
            "formally approved and submitted through the vendor channel.",
            ParagraphStyle(
                "Footer",
                fontName="Helvetica-Oblique",
                fontSize=7.5,
                leading=10,
                textColor=colors.HexColor("#6b7280"),
                alignment=1,
            ),
        )
    )

    doc.build(story)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


@router.post(
    "/compile-batch",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=CompilePDFBatchResponse,
)
async def compile_pdf_batch(
    x_admin_secret: str | None = Header(default=None, alias="x-admin-secret"),
    db: AsyncSession = Depends(get_async_db),
) -> CompilePDFBatchResponse:
    """Compile a batch of pending purchase order PDFs in-memory.

    Triggered by an external scheduler (e.g., Vercel Cron). Verifies the
    admin webhook secret, locks up to 5 pending ``pending_pdf_generations``
    rows with ``FOR UPDATE SKIP LOCKED``, compiles each into a PDF via
    ReportLab Platypus using an in-memory ``io.BytesIO`` buffer, and updates
    each row to ``completed`` or ``failed`` within an atomic transaction.
    """
    from backend.app.config import get_settings

    settings = get_settings()
    _verify_admin_secret(x_admin_secret, settings=settings)

    processed = 0
    succeeded = 0
    failed = 0
    batch_token: str | None = None

    async with db.begin():
        rows = (
            await db.scalars(
                select(PendingPDFGeneration)
                .where(PendingPDFGeneration.status == "pending")
                .order_by(PendingPDFGeneration.created_at.asc())
                .with_for_update(skip_locked=True)
                .limit(5)
            )
        ).all()

        for row in rows:
            batch_token = row.batch_token
            processed += 1

            try:
                purchase_order = await db.get(PurchaseOrder, row.purchase_order_id)
                if purchase_order is None:
                    raise ValueError(
                        f"Purchase order {row.purchase_order_id} not found"
                    )

                vendor = None
                if row.vendor_id is not None:
                    vendor = await db.get(Vendor, row.vendor_id)

                pdf_bytes = _build_po_pdf(
                    vendor=vendor,
                    purchase_order=purchase_order,
                    batch_token=row.batch_token,
                    execution_strategy=row.execution_strategy,
                    payload=row.payload or {},
                )

                row.pdf_data = pdf_bytes
                row.status = "completed"
                row.completed_at = datetime.now(timezone.utc)
                row.error_details = None
                succeeded += 1
            except Exception as error:  # noqa: BLE001 - resilient per-row evolution
                row.status = "failed"
                row.completed_at = datetime.now(timezone.utc)
                row.error_details = str(error)[:500]
                failed += 1

    return CompilePDFBatchResponse(
        processed=processed,
        succeeded=succeeded,
        failed=failed,
        batch_token=batch_token,
        message=(
            f"Compiled {succeeded} PDF(s) successfully; {failed} failed. "
            f"Batch token: {batch_token or '—'}"
        ),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
