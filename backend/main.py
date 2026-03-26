import os
# Force sentence-transformers to use local cache only — no network calls
os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from core.database import create_tables
from core.config import get_settings
from core.memory import knowledge_graph
from api.routes import router as analysis_router
from api.auth import router as auth_router
from api.org_routes import router as org_router
from api.watchdog_routes import router as watchdog_router
from api.eval_routes import router as eval_router
import logging
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ThinkTrace starting up...")
    logger.info(f"Environment: {settings.app_env}")

    # Validate critical config on startup
    missing = []
    if not settings.anthropic_api_key:
        missing.append("ANTHROPIC_API_KEY")
    if not settings.app_secret_key or len(settings.app_secret_key) < 32:
        missing.append("APP_SECRET_KEY (must be 32+ chars)")
    if not settings.redis_url:
        missing.append("REDIS_URL")
    if missing:
        logger.warning(f"Missing or weak config: {', '.join(missing)}")
        if settings.app_env == "production":
            raise RuntimeError(f"Cannot start in production with missing config: {missing}")

    create_tables()
    logger.info("Database tables created")
    knowledge_graph.connect()
    logger.info("Knowledge graph initialized")
    yield
    logger.info("ThinkTrace shutting down...")
    knowledge_graph.close()


app = FastAPI(
    title="ThinkTrace API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.app_env == "development" else None,
    redoc_url=None,
)

# ── CORS — lock to frontend domain in production ──
allowed_origins = ["*"] if settings.app_env == "development" else [
    "https://thinktrace-frontend.onrender.com",
    "https://thinktrace.onrender.com",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# ── Rate limiting — per IP using Redis ──
@app.middleware("http")
async def rate_limit(request: Request, call_next):
    """
    Rate limits the analyze endpoint to prevent abuse.
    100 requests per hour per IP for analysis.
    1000 requests per hour for everything else.
    """
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    if path not in ("/api/v1/analyze", "/api/v1/compare"):
        return await call_next(request)

    client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "unknown")
    client_ip = client_ip.split(",")[0].strip()

    try:
        import redis as redis_lib
        import ssl
        r = redis_lib.from_url(
            settings.redis_url,
            decode_responses=True,
            ssl_cert_reqs=ssl.CERT_NONE,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        key = f"rate:{client_ip}:analyze"
        count = r.incr(key)
        if count == 1:
            r.expire(key, 3600)  # 1 hour window
        if count > 100:
            ttl = r.ttl(key)
            return JSONResponse(
                status_code=429,
                content={"detail": f"Rate limit exceeded. You can run 100 analyses per hour. Try again in {ttl} seconds."}
            )
    except Exception:
        pass  # If Redis is down, allow the request

    return await call_next(request)


# ── Request size limit — reject payloads over 1MB ──
@app.middleware("http")
async def limit_request_size(request: Request, call_next):
    max_size = 1 * 1024 * 1024  # 1MB
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > max_size:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request too large. Maximum payload size is 1MB."}
        )
    return await call_next(request)

# ── Request ID + timing log ──
@app.middleware("http")
async def log_requests(request: Request, call_next):
    import uuid as _uuid
    request_id = str(_uuid.uuid4())[:8]
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000)
    response.headers["X-Request-ID"] = request_id
    logger.info(f"[{request_id}] {request.method} {request.url.path} {response.status_code} {duration}ms")
    return response

# ── Global error handler — never expose raw Python errors ──
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "An unexpected error occurred. Please try again."}
    )

app.include_router(analysis_router)
app.include_router(auth_router)
app.include_router(org_router)
app.include_router(watchdog_router)
app.include_router(eval_router)

@app.get("/health")
async def health():
    """Health check that verifies all critical dependencies."""
    checks = {}

    # Database
    try:
        from core.database import SessionLocal
        db = SessionLocal()
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db.close()
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"error: {str(e)[:50]}"

    # Redis
    try:
        import redis as redis_lib, ssl
        r = redis_lib.from_url(
            settings.redis_url,
            ssl_cert_reqs=ssl.CERT_NONE,
            socket_connect_timeout=2,
        )
        r.ping()
        checks["redis"] = "ok"
    except Exception as e:
        checks["redis"] = f"error: {str(e)[:50]}"

    all_ok = all(v == "ok" for v in checks.values())
    return {
        "status": "ok" if all_ok else "degraded",
        "version": "1.0.0",
        "env": settings.app_env,
        "checks": checks,
    }
