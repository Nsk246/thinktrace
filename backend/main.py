from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.config import get_settings
from core.database import create_tables
from core.memory import knowledge_graph
from api.routes import router
from api.watchdog_routes import router as watchdog_router
from api.auth import router as auth_router
from api.org_routes import router as org_router
from api.eval_routes import router as eval_router
from agents.watchdog import watchdog
import logging

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
    watchdog.shutdown()
    knowledge_graph.close()


app = FastAPI(
    title="ThinkTrace API",
    description="Enterprise reasoning audit platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(org_router)
app.include_router(router)
app.include_router(watchdog_router)
app.include_router(eval_router)


@app.get("/")
async def root():
    return {
        "name": "ThinkTrace",
        "version": "1.0.0",
        "status": "running",
        "env": settings.app_env,
    }


@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "watchdog": watchdog.get_status(),
        "knowledge_graph": knowledge_graph.get_graph_stats("system"),
    }
