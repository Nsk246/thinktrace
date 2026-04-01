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
import random
import logging

logger = logging.getLogger(__name__)
settings = get_settings()
router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

MAX_ATTEMPTS = 5
LOCKOUT_SECONDS = 300
OTP_EXPIRE_SECONDS = 600  # 10 minutes


def get_redis():
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


_token_blacklist_memory: set = set()
_failed_attempts_memory: dict = {}
_otp_memory: dict = {}  # fallback for OTP when Redis is down


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


def store_otp(email: str, otp: str, pending_data: dict):
    """Store OTP + pending registration data in Redis for 10 minutes."""
    import json
    r = get_redis()
    key = f"otp:{email}"
    data = json.dumps({"otp": otp, **pending_data})
    if r:
        r.setex(key, OTP_EXPIRE_SECONDS, data)
    else:
        import time
        _otp_memory[email] = {"data": data, "expires": time.time() + OTP_EXPIRE_SECONDS}


def verify_otp(email: str, otp: str, consume: bool = False) -> dict | None:
    """
    Verify OTP and return pending data if valid.
    Only deletes the OTP when consume=True (after successful account creation).
    """
    import json, time
    r = get_redis()
    key = f"otp:{email}"
    if r:
        raw = r.get(key)
        if not raw:
            return None
        data = json.loads(raw)
        if data.get("otp") != otp:
            return None
        if consume:
            r.delete(key)  # Only delete after successful use
        return data
    else:
        entry = _otp_memory.get(email)
        if not entry or entry["expires"] < time.time():
            return None
        data = json.loads(entry["data"])
        if data.get("otp") != otp:
            return None
        if consume:
            del _otp_memory[email]
        return data


def send_otp_email(email: str, otp: str, full_name: str) -> bool:
    """Send OTP via Resend."""
    try:
        import resend
        resend.api_key = settings.resend_api_key
        resend.Emails.send({
            "from": "noreply@nandhusk.dev",
            "to": email,
            "subject": "Your ThinkTrace verification code",
            "html": f"""
            <div style="font-family: system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
              <div style="margin-bottom: 24px;">
                <h1 style="font-size: 20px; font-weight: 700; color: #09090b; margin: 0 0 4px;">ThinkTrace</h1>
                <p style="color: #71717a; font-size: 14px; margin: 0;">AI Reasoning Audit Platform</p>
              </div>
              <h2 style="font-size: 18px; font-weight: 600; color: #09090b; margin: 0 0 8px;">
                Verify your email, {full_name.split()[0]}
              </h2>
              <p style="color: #52525b; font-size: 14px; line-height: 1.6; margin: 0 0 24px;">
                Enter this code to complete your registration. It expires in 10 minutes.
              </p>
              <div style="background: #f4f4f5; border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 8px; color: #6366f1; font-family: monospace;">
                  {otp}
                </span>
              </div>
              <p style="color: #71717a; font-size: 13px; margin: 0;">
                If you did not request this, you can safely ignore this email.
                Check your spam folder if you do not see this email.
              </p>
            </div>
            """
        })
        logger.info(f"OTP email sent to {email}")
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email: {e}")
        return False


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


class VerifyOTPRequest(BaseModel):
    email: str
    otp: str


class LoginRequest(BaseModel):
    email: str
    password: str


def hash_password(password: str) -> str:
    # Truncate to 72 chars before encoding — bcrypt limit
    truncated = password.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    return pwd_context.hash(truncated)


def verify_password(plain: str, hashed: str) -> bool:
    truncated = plain.encode("utf-8")[:72].decode("utf-8", errors="ignore")
    return pwd_context.verify(truncated, hashed)


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
    """Step 1: Validate details and send OTP email."""
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))

    # Store pending registration data
    store_otp(req.email, otp, {
        "password": hash_password(req.password),
        "full_name": req.full_name,
        "org_name": req.org_name,
    })

    # Send OTP email
    sent = send_otp_email(req.email, otp, req.full_name)
    if not sent:
        raise HTTPException(
            status_code=500,
            detail="Failed to send verification email. Please try again."
        )

    logger.info(f"OTP sent to {req.email}")
    return {
        "message": "Verification code sent to your email. Please check your inbox and spam folder.",
        "email": req.email,
        "expires_in": OTP_EXPIRE_SECONDS,
    }


@router.post("/verify-otp")
async def verify_otp_endpoint(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    """Step 2: Verify OTP and create the account."""
    email = req.email.lower().strip()
    otp = req.otp.strip()

    # First verify without consuming
    pending = verify_otp(email, otp, consume=False)
    if not pending:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired verification code. Please request a new one."
        )

    # Double-check email not taken during OTP window
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists")

    try:
        # Now consume the OTP — account creation is about to happen
        verify_otp(email, otp, consume=True)
        org = Organization(
            id=str(uuid.uuid4()),
            name=pending["org_name"].strip(),
            slug=pending["org_name"].lower().strip().replace(" ", "-")[:20] + "-" + str(uuid.uuid4())[:8],
        )
        db.add(org)
        db.flush()

        user = User(
            id=str(uuid.uuid4()),
            email=email,
            full_name=pending["full_name"],
            hashed_password=pending["password"],
            org_id=org.id,
            role="admin",
        )
        db.add(user)
        db.commit()

        token = create_token(user.id, org.id, user.role)
        logger.info(f"Account created after OTP verification: {email} (org: {org.id})")
        return {
            "access_token": token,
            "token_type": "bearer",
            "user_id": user.id,
            "org_id": org.id,
            "role": user.role,
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Account creation error: {e}")
        raise HTTPException(status_code=500, detail="Account creation failed. Please try again.")


@router.post("/resend-otp")
async def resend_otp(email: str, db: Session = Depends(get_db)):
    """Resend OTP if user did not receive it."""
    email = email.lower().strip()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="Account already exists")

    import json, time
    r = get_redis()
    key = f"otp:{email}"
    if r:
        raw = r.get(key)
        if not raw:
            raise HTTPException(
                status_code=400,
                detail="No pending registration found. Please start registration again."
            )
        data = json.loads(raw)
        otp = str(random.randint(100000, 999999))
        data["otp"] = otp
        r.setex(key, OTP_EXPIRE_SECONDS, json.dumps(data))
    else:
        entry = _otp_memory.get(email)
        if not entry or entry["expires"] < time.time():
            raise HTTPException(
                status_code=400,
                detail="No pending registration found. Please start registration again."
            )
        data = json.loads(entry["data"])
        otp = str(random.randint(100000, 999999))
        data["otp"] = otp
        _otp_memory[email] = {"data": json.dumps(data), "expires": time.time() + OTP_EXPIRE_SECONDS}

    send_otp_email(email, otp, data.get("full_name", "there"))
    return {"message": "New verification code sent. Check your inbox and spam folder."}


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
