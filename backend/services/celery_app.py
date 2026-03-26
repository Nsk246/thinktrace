from celery import Celery
from core.config import get_settings
import ssl
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

celery_app = Celery(
    "thinktrace",
    broker=settings.redis_url,
    backend=settings.redis_url,
)

celery_app.conf.update(
    # SSL for Upstash Redis
    broker_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE},
    redis_backend_use_ssl={"ssl_cert_reqs": ssl.CERT_NONE},

    # Serialization
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Reliability
    task_acks_late=True,           # Only ack after task completes
    task_reject_on_worker_lost=True,  # Re-queue if worker dies
    worker_prefetch_multiplier=1,  # One task per worker at a time

    # Timeouts
    task_soft_time_limit=130,      # Soft limit — task gets SIGTERM
    task_time_limit=150,           # Hard limit — task gets SIGKILL
    result_expires=3600,           # Results expire after 1 hour

    # Queue routing
    task_routes={
        "services.tasks.run_analysis_task": {"queue": "analysis"},
        "services.tasks.run_watchdog_check": {"queue": "watchdog"},
    },

    # Worker settings
    worker_max_tasks_per_child=50,  # Recycle worker after 50 tasks (prevents memory leaks)
    worker_disable_rate_limits=False,
)

logger.info("Celery configured with reliability settings")
