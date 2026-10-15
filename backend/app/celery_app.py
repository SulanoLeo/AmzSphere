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
        "backend.app.tasks.notifications",
        "backend.app.tasks.outbox",
    ],
)
celery_app.conf.update(
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    task_default_queue="amzsphere.default",
    task_routes={
        "backend.app.tasks.catalog.*": {"queue": "amzsphere.catalog"},
        "backend.app.tasks.inventory.*": {"queue": "amzsphere.inventory"},
        "backend.app.tasks.ingestion.*": {"queue": "amzsphere.ingestion"},
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
    },
)