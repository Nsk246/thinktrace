from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from core.database import get_db, User, Organization
from core.config import get_settings
from pydantic import BaseModel, field_validator
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta
import uuid
import re
import logging

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 300


def get_redis():
    """Get Redis client — falls back to in-memory if Redis unavailable."""
    try:
        import redis as redis_lib
        import ssl
        r = redis_lib.from_url(
            settings.redis_url,
            decode_responses=True,
            ssl_cert_reqs=ssl.CERT_NONE,
            socket_connect_timeout=3,
            socket_timeout=3,
        )
        r.ping()
        return r
    except Exception as e:
        logger.warning(f"Redis unavailable for auth: {e} — using in-memory fallback")
        return None


# In-memory fallbacks (used when Redis is unavailable)
_token_blacklist_memory: set = set()
_failed_attempts_memory: dict = {}


def is_token_blacklisted(token: str) -> bool:
    r = get_redis()
    if r:
        return bool(r.exists(f"blacklist:{token}"))
    return token in _token_blacklist_memory


def blacklist_token(token: str, expire_seconds: int = 86400):
    r = get_redis()
    if r:
        r.setex(f"blacklist:{token}", expire_seconds, "1")
    else:
        _token_blacklist_memory.add(token)


def check_brute_force(email: str):
    import time
    r = get_redis()
    if r:
        key = f"login_attempts:{email}"
        attempts = int(r.get(key) or 0)
        if attempts >= MAX_ATTEMPTS:
            ttl = r.ttl(key)
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Please wait {ttl} seconds before trying again."
            )
    else:
        now = time.time()
        attempts = _failed_attempts_memory.get(email, [])
        recent = [t for t in attempts if now - t < LOCKOUT_SECONDS]
        _failed_attempts_memory[email] = recent
        if len(recent) >= MAX_ATTEMPTS:
            wait = int(LOCKOUT_SECONDS - (now - recent[0]))
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Please wait {wait} seconds before trying again."
            )


def record_failed_attempt(email: str):
    import time
    r = get_redis()
    if r:
        key = f"login_attempts:{email}"
        pipe = r.pipeline()
        pipe.incr(key)
        pipe.expire(key, LOCKOUT_SECONDS)
        pipe.execute()
    else:
        attempts = _failed_attempts_memory.get(email, [])
        attempts.append(time.time())
        _failed_attempts_memory[email] = attempts


def clear_failed_attempts(email: str):
    r = get_redis()
    if r:
        r.delete(f"login_attempts:{email}")
    else:
        _failed_attempts_memory.pop(email, None)


class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: str
    org_name: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[0-9]", v):
            raise ValueError("Password must contain at least one number")
        return v

    @field_validator("email")
    @classmethod
    def validate_email(cls, v):
        if not re.match(r"^[^@]+@[^@]+\.[^@]+$", v):
            raise ValueError("Invalid email address")
        return v.lower().strip()

    @field_validator("full_name")
    @classmethod
    def validate_name(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Full name must be at least 2 characters")
        return v.strip()


class LoginRequest(BaseModel):
    email: str
    password: str


def hash_password(password: str) -> str:
    return pwd_context.hash(password[:72].encode("utf-8"))


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72].encode("utf-8"), hashed)


def create_token(user_id: str, org_id: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=24)
    return jwt.encode(
        {"sub": user_id, "org_id": org_id, "role": role,
         "exp": expire, "iat": datetime.utcnow()},
        settings.app_secret_key,
        algorithm="HS256",
    )


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if is_token_blacklisted(token):
        raise HTTPException(status_code=401, detail="Token has been revoked. Please sign in again.")
    try:
        payload = jwt.decode(token, settings.app_secret_key, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token. Please sign in again.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user


@router.post("/register")
async def register(req: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")
    try:
        org = Organization(
            id=str(uuid.uuid4()),
            name=req.org_name.strip(),
            slug=req.org_name.lower().strip().replace(" ", "-")[:20] + "-" + str(uuid.uuid4())[:8],
        )
        db.add(org)
        db.flush()
        user = User(
            id=str(uuid.uuid4()),
            email=req.email,
            full_name=req.full_name,
            hashed_password=hash_password(req.password),
            org_id=org.id,
            role="admin",
        )
        db.add(user)
        db.commit()
        token = create_token(user.id, org.id, user.role)
        logger.info(f"New user registered: {req.email} (org: {org.id})")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user.id,
            "org_id": org.id,
            "role": user.role,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Registration error: {e}")
        raise HTTPException(status_code=500, detail="Registration failed. Please try again.")


@router.post("/login")
async def login(req: LoginRequest, db: Session = Depends(get_db)):
    email = req.email.lower().strip()
    check_brute_force(email)
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(req.password, user.hashed_password):
        record_failed_attempt(email)
        raise HTTPException(status_code=401, detail="Incorrect email or password")
    clear_failed_attempts(email)
    token = create_token(user.id, user.org_id, user.role)
    logger.info(f"User logged in: {email}")
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "org_id": user.org_id,
        "role": user.role,
    }


@router.post("/logout")
async def logout(token: str = Depends(oauth2_scheme)):
    blacklist_token(token)
    return {"message": "Logged out successfully"}


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return {
        "user_id": current_user.id,
        "email": current_user.email,
        "full_name": current_user.full_name,
        "org_id": current_user.org_id,
        "role": current_user.role,
    }
