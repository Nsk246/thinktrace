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

# ── Request timing log ──
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000)
    logger.info(f"{request.method} {request.url.path} {response.status_code} {duration}ms")
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
    return {"status": "ok", "version": "1.0.0", "env": settings.app_env}
