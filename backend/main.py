from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from core.config import get_settings
from api.routes import router
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ThinkTrace starting up...")
    logger.info(f"Environment: {settings.app_env}")
    yield
    logger.info("ThinkTrace shutting down...")


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

app.include_router(router)


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
    return {"status": "healthy"}
