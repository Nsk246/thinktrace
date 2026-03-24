from celery import Celery
from celery.utils.log import get_task_logger
from core.config import get_settings
import ssl

settings = get_settings()
logger = get_task_logger(__name__)

ssl_options = {"ssl_cert_reqs": ssl.CERT_NONE}

celery_app = Celery(
    "thinktrace",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["services.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
    broker_connection_retry_on_startup=True,
    broker_use_ssl=ssl_options,
    redis_backend_use_ssl=ssl_options,
    task_routes={
        "services.tasks.run_analysis_task": {"queue": "analysis"},
        "services.tasks.run_watchdog_task": {"queue": "watchdog"},
    },
)
