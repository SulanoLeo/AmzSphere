from celery import Celery

from backend.app.config import get_settings


settings = get_settings()
celery_app = Celery(
    "amzsphere",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
    include=[
        "backend.app.tasks.catalog",
        "backend.app.tasks.inventory",
        "backend.app.tasks.ingestion",
        "backend.app.tasks.listing_health",
        "backend.app.tasks.amazon_writes",
        "backend.app.tasks.notifications",
        "backend.app.tasks.outbox",
    ],
)
celery_app.conf.update(
    task_acks_late=settings.celery_task_acks_late,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=settings.celery_worker_prefetch_multiplier,
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_default_queue="amzsphere.default",
    task_routes={
        "backend.app.tasks.catalog.*": {"queue": "amzsphere.catalog"},
        "backend.app.tasks.inventory.*": {"queue": "amzsphere.inventory"},
        "backend.app.tasks.ingestion.*": {"queue": "amzsphere.ingestion"},
        "backend.app.tasks.listing_health.*": {"queue": settings.celery_listing_health_queue},
        "backend.app.tasks.notifications.*": {"queue": "amzsphere.notifications"},
    },
    broker_transport_options={"visibility_timeout": 3600},
    result_expires=86400,
    beat_schedule={
        "publish-amzsphere-outbox": {
            "task": "backend.app.tasks.outbox.dispatch_pending_events",
            "schedule": 2.0,
        },
        "schedule-connected-seller-syncs": {
            "task": "backend.app.tasks.ingestion.enqueue_connected_seller_syncs",
            "schedule": settings.seller_sync_interval_seconds,
        },
        "process-listing-health-events": {
            "task": "backend.app.tasks.listing_health.process_listing_health_events",
            "schedule": settings.celery_listing_health_interval_seconds,
            "options": {"queue": settings.celery_listing_health_queue},
        },
    },
)