"""API router for the Listing Suppression Guard dashboard.

Provides paginated access to processed listing health events and a global
health summary used by the AmzSphere Operations Dashboard metric cards.
"""

from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timezone

from backend.app.db import SessionLocal
from backend.app.models import AmazonWriteOutbox, ListingHealthEvent
from backend.app.schemas import ListingRemediationApproval, ListingRemediationApprovalResponse


router = APIRouter(prefix="/api/v1/listings", tags=["Listings"])


async def get_async_db() -> AsyncSession:
    """FastAPI dependency that yields an async SQLAlchemy session."""
    async with SessionLocal() as session:
        yield session


class ListingHealthEventOut(BaseModel):
    """Serialized representation of a single processed listing health event."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    notification_id: str
    notification_type: str
    seller_id: UUID
    asin: str
    sku: str
    marketplace_id: str
    listing_status: str
    status: str
    is_suppressed: bool
    error_codes: list[str]
    error_messages: list[str]
    processed_at: Optional[str] = None
    received_at: str


class ListingHealthSummaryOut(BaseModel):
    """Lightweight metadata schema for dashboard high-level metric cards."""

    total_pending_count: int = 0
    total_processed_count: int = 0
    total_failed_count: int = 0
    total_suppressed_count: int = 0
    total_critical_count: int = 0


@router.get("/health-summary", response_model=ListingHealthSummaryOut)
async def get_listing_health_summary(
    db: AsyncSession = Depends(get_async_db),
) -> ListingHealthSummaryOut:
    """Return global health metadata for active listing suppressions.

    Aggregates counts across all ``listing_health_events`` rows so the
    dashboard can populate high-level metric cards without scanning the
    full event table.
    """
    counts: dict[str, int] = {}
    rows = (
        await db.execute(
            select(ListingHealthEvent.status, func.count(ListingHealthEvent.id))
            .group_by(ListingHealthEvent.status)
        )
    ).all()
    for status, count in rows:
        counts[status or "unknown"] = int(count)

    suppressed_rows = (
        await db.execute(
            select(func.count(ListingHealthEvent.id)).where(
                ListingHealthEvent.is_suppressed.is_(True)
            )
        )
    ).scalar_one()

    return ListingHealthSummaryOut(
        total_pending_count=counts.get("pending_review", 0),
        total_processed_count=counts.get("processed", 0),
        total_failed_count=counts.get("failed", 0),
        total_suppressed_count=int(suppressed_rows or 0),
        total_critical_count=int(suppressed_rows or 0),
    )


@router.get("/alerts", response_model=list[ListingHealthEventOut])
async def list_listing_health_alerts(
    db: AsyncSession = Depends(get_async_db),
    page: int = Query(default=1, ge=1, description="1-based page number"),
    limit: int = Query(default=20, ge=1, le=100, description="Items per page"),
    is_suppressed: Optional[bool] = Query(
        default=None, description="Filter by suppression flag"
    ),
    marketplace_id: Optional[str] = Query(
        default=None, description="Filter by Amazon marketplace ID"
    ),
) -> list[ListingHealthEventOut]:
    """Return a paginated, filtered list of processed listing health events.

    Results are ordered descending by ``processed_at`` so the most recent
    suppressions surface first in the dashboard alerts view.
    """
    query = select(ListingHealthEvent).where(
        ListingHealthEvent.status == "processed"
    )

    if is_suppressed is not None:
        query = query.where(ListingHealthEvent.is_suppressed == is_suppressed)

    if marketplace_id:
        query = query.where(ListingHealthEvent.marketplace_id == marketplace_id)

    query = query.order_by(ListingHealthEvent.processed_at.desc().nullslast())
    query = query.offset((page - 1) * limit).limit(limit)

    events = (await db.execute(query)).scalars().all()
    return [ListingHealthEventOut.model_validate(event) for event in events]


@router.post(
    "/remediations/approve",
    status_code=202,
    response_model=ListingRemediationApprovalResponse,
)
async def approve_listing_remediation(
    approval: ListingRemediationApproval,
    db: AsyncSession = Depends(get_async_db),
) -> ListingRemediationApprovalResponse:
    """Approve a listing remediation and stage it for asynchronous execution.

    Verifies the target ``listing_health_events`` row is still in
    ``pending_review``, transitions it to ``approved``, and injects an
    ``amazon_write_outbox`` row routed to ``amzsphere.catalog_writes``.
    All mutations occur within a single async transaction block.
    """
    async with db.begin():
        event = await db.get(ListingHealthEvent, approval.event_id)
        if event is None:
            raise HTTPException(status_code=404, detail="Listing health event not found")

        if event.status != "pending_review":
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Event is not in pending_review status "
                    f"(current: {event.status})"
                ),
            )

        event.status = "approved"
        event.processed_at = datetime.now(timezone.utc)

        outbox_entry = AmazonWriteOutbox(
            event_id=approval.event_id,
            action_type=approval.action_type,
            payload=approval.payload,
            routing_target="amzsphere.catalog_writes",
            status="pending",
        )
        db.add(outbox_entry)
        await db.flush()

    return ListingRemediationApprovalResponse(
        outbox_entry_id=outbox_entry.id,
        timestamp=datetime.now(timezone.utc).isoformat(),
        message="Remediation action successfully queued for execution.",
    )
