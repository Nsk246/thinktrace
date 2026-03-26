import multiprocessing
import os

# Workers: (2 x CPU cores) + 1 — standard formula
workers = int(os.getenv("WEB_CONCURRENCY", multiprocessing.cpu_count() * 2 + 1))

# Use uvicorn worker for async FastAPI
worker_class = "uvicorn.workers.UvicornWorker"

# Bind
bind = f"0.0.0.0:{os.getenv('PORT', '8000')}"

# Timeouts — analyses can take up to 120 seconds
timeout = 150
graceful_timeout = 30
keepalive = 5

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# Worker lifecycle — recycle workers to prevent memory leaks
max_requests = 1000
max_requests_jitter = 100

# Preload app for faster worker spawning
preload_app = True
