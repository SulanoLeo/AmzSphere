"""Bulk Procurement Approval router for AmzSphere.

Serverless-optimized endpoint for approving purchase orders in bulk and
staging consolidated PDF-generation payloads without persistent background
daemons.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db import SessionLocal
from backend.app.models import (
    PendingPDFGeneration,
    PurchaseOrder,
    Seller,
    Vendor,
)
from backend.app.schemas import BulkProcurementApprovalRequest, BulkProcurementApprovalResponse

router = APIRouter(prefix="/api/v1/procurement", tags=["Procurement"])


async def get_async_db() -> AsyncSession:
    """FastAPI dependency that yields an async SQLAlchemy session."""
    async with SessionLocal() as session:
        yield session


class _MutablePO:
    __slots__ = ("id", "vendor_id", "status")

    def __init__(self, id: uuid.UUID, vendor_id: uuid.UUID | None, status: str) -> None:
        self.id = id
        self.vendor_id = vendor_id
        self.status = status


@router.post(
    "/bulk-approve",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=BulkProcurementApprovalResponse,
)
async def bulk_approve_purchase_orders(
    request: BulkProcurementApprovalRequest,
    db: AsyncSession = Depends(get_async_db),
) -> BulkProcurementApprovalResponse:
    """Bulk-approve purchase orders and stage PDF-generation payloads.

    Executes entirely within a single ``async with db.begin()`` transaction
    block so the operation is atomic and safe for serverless runtimes with
    strict timeout boundaries.

    - Validates that every requested PO exists and is in a mutable state.
    - Transitions all valid POs to ``approved`` in one bulk UPDATE.
    - When ``execution_strategy == "CONSOLIDATE_BY_VENDOR"``, groups approved
      POs in-memory by vendor and inserts one ``PendingPDFGeneration`` row per
      vendor group. Otherwise inserts one row per PO.
    - Returns a batch token and processing summary for downstream consumption.
    """
    batch_token = str(uuid.uuid4())
    requested_ids: list[uuid.UUID] = []

    # Normalize and validate input IDs.
    for raw_id in request.purchase_order_ids:
        try:
            requested_ids.append(uuid.UUID(str(raw_id)))
        except (ValueError, AttributeError, TypeError):
            continue  # Non-UUID strings are silently skipped; they will not match.

    if not requested_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid purchase order IDs provided",
        )

    async with db.begin():
        # Fetch all targeted purchase orders in a single query.
        result = await db.execute(
            select(PurchaseOrder.id, PurchaseOrder.vendor_id, PurchaseOrder.status).where(
                PurchaseOrder.id.in_(requested_ids)
            )
        )
        rows = result.all()

        found_ids = {row.id for row in rows}
        missing_ids = set(requested_ids) - found_ids

        # Verify mutable state: only pending_review can be bulk-approved.
        mutable_rows = [
            _MutablePO(id=row.id, vendor_id=row.vendor_id, status=row.status)
            for row in rows
            if row.status == "pending_review"
        ]
        immutable_ids = {
            row.id for row in rows if row.status != "pending_review"
        }

        if not mutable_rows:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No purchase orders are in a mutable (pending_review) state",
            )

        # Bulk UPDATE all mutable POs to approved in one statement.
        approved_ids = [po.id for po in mutable_rows]
        await db.execute(
            update(PurchaseOrder)
            .where(PurchaseOrder.id.in_(approved_ids))
            .values(status="approved")
        )

        # Flush so the UPDATE is visible before we read related vendor data.
        await db.flush()

        # Load vendor names for the consolidated payloads.
        vendor_ids = {po.vendor_id for po in mutable_rows if po.vendor_id is not None}
        vendor_names: dict[uuid.UUID | None, str] = {}
        if vendor_ids:
            vendor_result = await db.execute(
                select(Vendor.id, Vendor.name).where(Vendor.id.in_(vendor_ids))
            )
            for vendor_id, vendor_name in vendor_result.all():
                vendor_names[vendor_id] = vendor_name

        # Stage PendingPDFGeneration rows.
        staged_count = 0
        vendor_group_count = 0

        if request.execution_strategy == "CONSOLIDATE_BY_VENDOR":
            # In-memory grouping by vendor ID.
            groups: dict[uuid.UUID | None, list[uuid.UUID]] = {}
            for po in mutable_rows:
                groups.setdefault(po.vendor_id, []).append(po.id)

            for vendor_id, po_ids in groups.items():
                payload: dict[str, Any] = {
                    "strategy": "CONSOLIDATE_BY_VENDOR",
                    "vendor_id": str(vendor_id) if vendor_id else None,
                    "vendor_name": vendor_names.get(vendor_id, "Unknown Vendor"),
                    "purchase_order_ids": [str(pid) for pid in po_ids],
                    "po_count": len(po_ids),
                    "batch_token": batch_token,
                }
                db.add(
                    PendingPDFGeneration(
                        vendor_id=vendor_id,
                        batch_token=batch_token,
                        execution_strategy=request.execution_strategy,
                        payload=payload,
                        status="pending",
                    )
                )
                vendor_group_count += 1
                staged_count += 1
        else:
            # IMMEDIATE_STAGING: one row per approved PO.
            for po in mutable_rows:
                payload: dict[str, Any] = {
                    "strategy": "IMMEDIATE_STAGING",
                    "purchase_order_id": str(po.id),
                    "vendor_id": str(po.vendor_id) if po.vendor_id else None,
                    "vendor_name": vendor_names.get(po.vendor_id, "Unknown Vendor"),
                    "batch_token": batch_token,
                }
                db.add(
                    PendingPDFGeneration(
                        purchase_order_id=po.id,
                        vendor_id=po.vendor_id,
                        batch_token=batch_token,
                        execution_strategy=request.execution_strategy,
                        payload=payload,
                        status="pending",
                    )
                )
                staged_count += 1

    return BulkProcurementApprovalResponse(
        batch_token=batch_token,
        execution_strategy=request.execution_strategy,
        total_requested=len(requested_ids),
        total_approved=len(approved_ids),
        total_skipped=len(missing_ids) + len(immutable_ids),
        vendor_groups=vendor_group_count if request.execution_strategy == "CONSOLIDATE_BY_VENDOR" else 0,
        message=(
            f"{len(approved_ids)} purchase order(s) approved and staged for PDF generation "
            f"under batch token {batch_token}."
        ),
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
