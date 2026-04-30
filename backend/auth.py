from datetime import datetime, timedelta
import base64
import hashlib
import secrets
import uuid
from typing import Any, Dict, Optional

import bcrypt
from cryptography.fernet import Fernet, InvalidToken
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.exc import DatabaseError, OperationalError, TimeoutError
from sqlalchemy.orm import Session

from config import settings
from database import get_db
from models import AuthSession, User

security = HTTPBearer()

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES or 15
REFRESH_TOKEN_EXPIRE_DAYS = 30


def utcnow() -> datetime:
    return datetime.utcnow()


def is_expired(value: Optional[datetime]) -> bool:
    if value is None:
        return True
    if value.tzinfo is not None:
        value = value.replace(tzinfo=None)
    return value <= utcnow()


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_secret_token() -> str:
    return secrets.token_urlsafe(48)


def _fernet() -> Fernet:
    raw = settings.TOKEN_ENCRYPTION_KEY or settings.SECRET_KEY
    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    return _fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        return _fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return None


def check_database_connection(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except (OperationalError, DatabaseError, TimeoutError):
        return False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    raw_password = plain_password.encode("utf-8")
    if len(raw_password) > 72:
        return False
    try:
        return bcrypt.checkpw(raw_password, hashed_password.encode("utf-8"))
    except ValueError:
        return False


def get_password_hash(password: str) -> str:
    raw_password = password.encode("utf-8")
    if len(raw_password) > 72:
        raise ValueError("password cannot be longer than 72 bytes")
    return bcrypt.hashpw(raw_password, bcrypt.gensalt()).decode("utf-8")


def ensure_user_role_level(user: User) -> User:
    if getattr(user, "role_level", None) is None:
        user.role_level = 1
    return user


def issue_access_token(session: AuthSession, user: User) -> str:
    now = utcnow()
    payload = {
        "token_type": "access",
        "session_id": session.id,
        "user_id": str(user.id),
        "company_id": user.company_id,
        "clinic_id": session.clinic_id,
        "username": user.username,
        "email": user.email,
        "iat": now,
        "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
        "aud": "opticai",
        "role": "authenticated",
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_auth_session(
    db: Session,
    user: User,
    clinic_id: Optional[int] = None,
    device_id: Optional[str] = None,
    request: Optional[Request] = None,
) -> Dict[str, Any]:
    refresh_token = new_secret_token()
    auth_session = AuthSession(
        id=str(uuid.uuid4()),
        user_id=user.id,
        company_id=user.company_id,
        clinic_id=clinic_id,
        refresh_token_hash=token_hash(refresh_token),
        device_id=device_id,
        user_agent=request.headers.get("user-agent") if request else None,
        ip_address=request.client.host if request and request.client else None,
        expires_at=utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        last_seen_at=utcnow(),
    )
    db.add(auth_session)
    db.flush()
    return {
        "access_token": issue_access_token(auth_session, user),
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "expires_in": ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        "session_id": auth_session.id,
    }


def revoke_auth_session(db: Session, auth_session: AuthSession) -> None:
    auth_session.revoked_at = utcnow()


def _credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_current_auth_session(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> AuthSession:
    if not check_database_connection(db):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service temporarily unavailable",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_aud": False},
        )
    except JWTError:
        raise _credentials_exception()
    if payload.get("token_type") != "access":
        raise _credentials_exception()
    session_id = payload.get("session_id")
    if not session_id:
        raise _credentials_exception()
    auth_session = db.query(AuthSession).filter(AuthSession.id == session_id).first()
    if (
        not auth_session
        or auth_session.revoked_at is not None
        or is_expired(auth_session.expires_at)
    ):
        raise _credentials_exception()
    auth_session.last_seen_at = utcnow()
    return auth_session


def get_current_user(
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
) -> User:
    user = db.query(User).filter(User.id == auth_session.user_id).first()
    if user is None or not user.is_active:
        raise _credentials_exception()
    return ensure_user_role_level(user)
