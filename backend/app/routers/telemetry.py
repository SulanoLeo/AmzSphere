"""Queue telemetry endpoint for AmzSphere real-time diagnostic workspace.

Aggregates operational metrics across ``listing_health_events`` and
``amazon_write_outbox`` tables: status partitions, average execution
latency, and top error strings.
"""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from backend.app.db import SessionLocal
from backend.app.models import AmazonWriteOutbox, ListingHealthEvent

router = APIRouter(prefix="/api/v1/telemetry", tags=["Telemetry"])


async def get_async_db() -> AsyncSession:
    """FastAPI dependency that yields an async SQLAlchemy session."""
    async with SessionLocal() as session:
        yield session


class QueueStatusCounts(BaseModel):
    """Counts of rows partitioned by operational status."""

    pending: int = 0
    processed: int = 0
    published: int = 0
    failed: int = 0
    dead_letter: int = 0


class QueueErrorEntry(BaseModel):
    """A single error string and its occurrence frequency."""

    error: str
    count: int


class QueueTelemetryOut(BaseModel):
    """Structured telemetry payload for the Queue Monitor Dashboard."""

    model_config = ConfigDict(from_attributes=True)

    listing_health: QueueStatusCounts
    amazon_write_outbox: QueueStatusCounts
    average_execution_latency_seconds: float | None = None
    top_errors: list[QueueErrorEntry] = []
    total_outbox_rows: int = 0
    generated_at: str


def _map_health_status(status: str | None) -> str:
    """Map listing_health_events status values to common telemetry buckets."""
    if status is None:
        return "pending"
    normalized = status.strip().lower()
    if normalized in ("pending_review", "pending"):
        return "pending"
    if normalized in ("processed", "approved"):
        return "processed"
    if normalized == "failed":
        return "failed"
    return normalized


def _map_outbox_status(status: str | None) -> str:
    """Map amazon_write_outbox status values to common telemetry buckets."""
    if status is None:
        return "pending"
    normalized = status.strip().lower()
    if normalized in ("pending",):
        return "pending"
    if normalized in ("processed",):
        return "processed"
    if normalized in ("published",):
        return "published"
    if normalized in ("failed", "dead_letter"):
        return normalized
    return normalized


@router.get("/queues", response_model=QueueTelemetryOut)
async def get_queue_telemetry(
    db: AsyncSession = Depends(get_async_db),
) -> QueueTelemetryOut:
    """Return real-time queue telemetry for diagnostic workspaces.

    Aggregates status partitions for both tables, computes average execution
    latency from published outbox rows, and surfaces the top 5 most frequent
    error strings.
    """
    # Listing health status counts
    health_rows = (
        await db.execute(
            select(ListingHealthEvent.status, func.count(ListingHealthEvent.id))
            .group_by(ListingHealthEvent.status)
        )
    ).all()
    health_counts = QueueStatusCounts()
    for status, count in health_rows:
        bucket = _map_health_status(status)
        setattr(health_counts, bucket, int(count))

    # Amazon write outbox status counts
    outbox_rows = (
        await db.execute(
            select(AmazonWriteOutbox.status, func.count(AmazonWriteOutbox.id))
            .group_by(AmazonWriteOutbox.status)
        )
    ).all()
    outbox_counts = QueueStatusCounts()
    total_outbox = 0
    for status, count in outbox_rows:
        bucket = _map_outbox_status(status)
        setattr(outbox_counts, bucket, int(count))
        total_outbox += int(count)

    # Average execution latency: published_at - created_at for published rows
    avg_latency_result = (
        await db.execute(
            select(
                func.avg(
                    func.extract(
                        "epoch",
                        AmazonWriteOutbox.published_at - AmazonWriteOutbox.created_at,
                    )
                )
            ).where(
                AmazonWriteOutbox.published_at.is_not(None),
                AmazonWriteOutbox.created_at.is_not(None),
            )
        )
    ).scalar_one_or_none()
    average_latency = (
        round(float(avg_latency_result), 3) if avg_latency_result is not None else None
    )

    # Top 5 most frequent error strings
    top_errors_rows = (
        await db.execute(
            select(
                AmazonWriteOutbox.last_error,
                func.count(AmazonWriteOutbox.id),
            )
            .where(AmazonWriteOutbox.last_error.is_not(None))
            .group_by(AmazonWriteOutbox.last_error)
            .order_by(func.count(AmazonWriteOutbox.id).desc())
            .limit(5)
        )
    ).all()
    top_errors = [
        QueueErrorEntry(error=str(error), count=int(count))
        for error, count in top_errors_rows
    ]

    return QueueTelemetryOut(
        listing_health=health_counts,
        amazon_write_outbox=outbox_counts,
        average_execution_latency_seconds=average_latency,
        top_errors=top_errors,
        total_outbox_rows=total_outbox,
        generated_at=datetime.now(timezone.utc).isoformat(),
    )
