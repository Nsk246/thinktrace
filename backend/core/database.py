from sqlalchemy import create_engine, Column, String, DateTime, Boolean, ForeignKey, Float, Integer, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import uuid
from core.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if "sqlite" in settings.database_url else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class Organization(Base):
    __tablename__ = "organizations"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    users = relationship("User", back_populates="org")
    analyses = relationship("AnalysisRecord", back_populates="org")


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String)
    role = Column(String, default="member")  # admin | member | viewer
    org_id = Column(String, ForeignKey("organizations.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    org = relationship("Organization", back_populates="users")


class AnalysisRecord(Base):
    __tablename__ = "analysis_records"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    org_id = Column(String, ForeignKey("organizations.id"))
    user_id = Column(String, ForeignKey("users.id"))
    job_id = Column(String)
    content_type = Column(String)
    content_preview = Column(String)
    claim_count = Column(Integer, default=0)
    fallacy_count = Column(Integer, default=0)
    overall_score = Column(Float)
    evidence_score = Column(Float)
    logic_score = Column(Float)
    status = Column(String, default="pending")
    full_result = Column(Text)
    content_hash = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime)
    org = relationship("Organization", back_populates="analyses")


def create_tables():
    Base.metadata.create_all(bind=engine)
