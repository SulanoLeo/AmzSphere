import asyncio
from datetime import datetime, timedelta, timezone

from celery import shared_task
from sqlalchemy import select

from backend.app.celery_app import celery_app
from backend.app.db import SessionLocal
from backend.app.models import OutboxEvent
from backend.app.tasks.runtime import run_async


ALLOWED_TASKS = {
    "backend.app.tasks.catalog.optimize_listing",
    "backend.app.tasks.catalog.submit_approved_listing",
    "backend.app.tasks.inventory.scan_seller_inventory",
    "backend.app.tasks.ingestion.sync_seller_data",
}


async def _dispatch_pending_events(limit: int = 50) -> int:
    published = 0
    async with SessionLocal() as session:
        events = (await session.scalars(
            select(OutboxEvent)
            .where(OutboxEvent.status == "pending", OutboxEvent.available_at <= datetime.now(timezone.utc))
            .order_by(OutboxEvent.created_at)
            .with_for_update(skip_locked=True)
            .limit(limit)
        )).all()
        for event in events:
            if event.event_type not in ALLOWED_TASKS:
                event.status = "dead_letter"
                event.last_error = "unsupported_task"
                continue
            try:
                await asyncio.to_thread(
                    celery_app.send_task,
                    event.event_type,
                    args=event.payload.get("args", []),
                    task_id=str(event.id),
                )
                event.status = "published"
                event.published_at = datetime.now(timezone.utc)
                event.attempt_count += 1
                published += 1
            except Exception as error:
                event.attempt_count += 1
                if event.attempt_count >= 10:
                    event.status = "dead_letter"
                else:
                    event.available_at = datetime.now(timezone.utc) + timedelta(seconds=min(2**event.attempt_count, 300))
                event.last_error = type(error).__name__[:160]
        await session.commit()
    return published


@shared_task(name="backend.app.tasks.outbox.dispatch_pending_events")
def dispatch_pending_events() -> int:
    return run_async(_dispatch_pending_events())