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

    # Preload sentence transformer at startup so first analysis is fast
    try:
        from services.pinecone_service import get_embedder
        embedder = get_embedder()
        if embedder:
            # Warm up with a dummy encode
            embedder.encode("warmup", normalize_embeddings=True)
            logger.info("Sentence transformer preloaded and warmed up")
        else:
            logger.warning("Sentence transformer not available — using hash embeddings")
    except Exception as e:
        logger.warning(f"Sentence transformer preload failed: {e}")

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
def get_redis_client():
    try:
        import redis as redis_lib, ssl
        r = redis_lib.from_url(
            settings.redis_url,
            decode_responses=True,
            ssl_cert_reqs=ssl.CERT_NONE,
            socket_connect_timeout=2,
            socket_timeout=2,
        )
        r.ping()
        return r
    except Exception:
        return None


def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def check_rate_limit(r, key: str, limit: int, window: int, detail: str):
    """Returns a JSONResponse if rate limited, None if allowed."""
    try:
        count = r.incr(key)
        if count == 1:
            r.expire(key, window)
        if count > limit:
            ttl = r.ttl(key)
            return JSONResponse(
                status_code=429,
                content={"detail": f"{detail} Try again in {ttl} seconds."}
            )
    except Exception:
        pass
    return None


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)

    path = request.url.path
    client_ip = get_client_ip(request)
    r = get_redis_client()

    if r:
        # ── Auth endpoints — prevent OTP spam and brute force ──
        if path in ("/api/v1/auth/register", "/api/v1/auth/resend-otp"):
            # 5 registration attempts per IP per hour
            blocked = check_rate_limit(
                r, f"rate:{client_ip}:register", 5, 3600,
                "Too many registration attempts from this IP."
            )
            if blocked:
                return blocked

        if path == "/api/v1/auth/login":
            # 20 login attempts per IP per hour
            blocked = check_rate_limit(
                r, f"rate:{client_ip}:login", 20, 3600,
                "Too many login attempts from this IP."
            )
            if blocked:
                return blocked

        if path == "/api/v1/auth/verify-otp":
            # 10 OTP attempts per IP per 10 minutes
            blocked = check_rate_limit(
                r, f"rate:{client_ip}:otp", 10, 600,
                "Too many verification attempts from this IP."
            )
            if blocked:
                return blocked

        # ── Analysis endpoints ──
        if path in ("/api/v1/analyze", "/api/v1/compare"):
            # Check auth header to determine if logged in
            auth_header = request.headers.get("authorization", "")
            is_authenticated = auth_header.startswith("Bearer ")

            if not is_authenticated:
                # Unauthenticated: 3 analyses per IP per day (demo mode)
                blocked = check_rate_limit(
                    r, f"rate:{client_ip}:anon_analyze", 3, 86400,
                    "Guest users are limited to 3 analyses per day. Sign in for full access."
                )
                if blocked:
                    return blocked
            else:
                # Authenticated: 100 analyses per IP per hour
                blocked = check_rate_limit(
                    r, f"rate:{client_ip}:analyze", 100, 3600,
                    "Rate limit exceeded. You can run 100 analyses per hour."
                )
                if blocked:
                    return blocked

        # ── Global safety net — 500 requests per IP per hour ──
        blocked = check_rate_limit(
            r, f"rate:{client_ip}:global", 500, 3600,
            "Too many requests from this IP."
        )
        if blocked:
            return blocked

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
