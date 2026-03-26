from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from sqlalchemy.pool import QueuePool
from datetime import datetime
from core.config import get_settings
import uuid
import logging

logger = logging.getLogger(__name__)
settings = get_settings()

# Detect database type and configure accordingly
DATABASE_URL = settings.database_url

if DATABASE_URL.startswith("sqlite"):
    # SQLite — dev only, no connection pooling needed
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
    )
    logger.warning("Using SQLite — not suitable for production. Set DATABASE_URL to PostgreSQL.")
else:
    # PostgreSQL — production, full connection pooling
    engine = create_engine(
        DATABASE_URL,
        poolclass=QueuePool,
        pool_size=10,           # Base connections kept open
        max_overflow=20,        # Extra connections under load
        pool_pre_ping=True,     # Verify connections before use
        pool_recycle=3600,      # Recycle connections every hour
        pool_timeout=30,        # Wait max 30s for a connection
        echo=False,
    )
    logger.info("Using PostgreSQL with connection pooling (size=10, max_overflow=20)")

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    Base.metadata.create_all(bind=engine)
    logger.info("Database tables created/verified")


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    slug = Column(String, unique=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    users = relationship("User", back_populates="org")
    analyses = relationship("AnalysisRecord", back_populates="org")


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False, index=True)
    full_name = Column(String)
    hashed_password = Column(String, nullable=False)
    org_id = Column(String, ForeignKey("organizations.id"), index=True)
    role = Column(String, default="member")
    created_at = Column(DateTime, default=datetime.utcnow)
    org = relationship("Organization", back_populates="users")


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String, ForeignKey("organizations.id"), index=True)
    user_id = Column(String, index=True)
    job_id = Column(String, index=True)
    content_type = Column(String)
    content_preview = Column(String)
    content_hash = Column(String, index=True)
    claim_count = Column(Integer, default=0)
    fallacy_count = Column(Integer, default=0)
    overall_score = Column(Float)
    evidence_score = Column(Float)
    logic_score = Column(Float)
    status = Column(String, default="pending", index=True)
    full_result = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    completed_at = Column(DateTime)
    org = relationship("Organization", back_populates="analyses")
