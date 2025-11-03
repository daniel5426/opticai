from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import requests
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError, DatabaseError, TimeoutError
from sqlalchemy import text
from database import get_db
from models import User
from schemas import TokenData
from config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

_jwks_cache: Dict[str, Any] = {}
_jwks_last_fetch: Optional[datetime] = None

def _get_supabase_jwks() -> Dict[str, Any]:
    global _jwks_cache, _jwks_last_fetch
    now = datetime.utcnow()
    
    if _jwks_cache and _jwks_last_fetch and (now - _jwks_last_fetch).seconds < 3600:
        return _jwks_cache
    
    if not settings.SUPABASE_URL:
        raise RuntimeError("SUPABASE_URL is not configured")
    
    jwks_url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/jwks"
    try:
        resp = requests.get(jwks_url, timeout=5)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_last_fetch = now
        return _jwks_cache
    except (requests.RequestException, requests.Timeout) as e:
        if _jwks_cache:
            print(f"JWKS fetch failed, using cached version: {e}")
            return _jwks_cache
        else:
            print(f"JWKS fetch failed and no cache available: {e}")
            raise RuntimeError(f"Could not fetch JWKS: {e}")

def _get_signing_key(token: str) -> Any:
    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    jwks = _get_supabase_jwks()
    for key in jwks.get("keys", []):
        if key.get("kid") == kid:
            return jwt.algorithms.RSAAlgorithm.from_jwk(key)
    raise JWTError("Signing key not found")

def verify_supabase_token(token: str) -> Dict[str, Any]:
    # Fallback to HS256 using project JWT secret (Supabase JWT secret)
    try:
        secret = settings.SUPABASE_JWT_SECRET or settings.SUPABASE_KEY
        if not secret:
            raise JWTError("Missing SUPABASE_KEY for HS256 verification")
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
    except Exception as e:
        print(f"AUTH DEBUG verify failed: {e}")
        raise JWTError(str(e))

def check_database_connection(db: Session) -> bool:
    try:
        db.execute(text("SELECT 1"))
        return True
    except (OperationalError, DatabaseError, TimeoutError):
        return False


def ensure_user_role_level(user: User) -> User:
    if getattr(user, "role_level", None) is None:
        user.role_level = 1
    return user

def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    database_unavailable_exception = HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Database service temporarily unavailable",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    try:
        payload = verify_supabase_token(token)
        email = payload.get("email") or payload.get("user_metadata", {}).get("email")
        username = payload.get("username")
        
        if not check_database_connection(db):
            raise database_unavailable_exception
        
        user = None
        try:
            if email:
                user = db.query(User).filter(User.email == email).first()
            
            if not user and username:
                user = db.query(User).filter(User.username == username).first()
            
            if not user and email and "@clinic.local" in email:
                username_from_email = email.split("@")[0]
                user = db.query(User).filter(User.username == username_from_email).first()
                
        except (OperationalError, DatabaseError, TimeoutError) as e:
            print(f"Database connection error in auth: {e}")
            raise database_unavailable_exception
        
        if user is None:
            raise credentials_exception
        return ensure_user_role_level(user)
    except JWTError:
        raise credentials_exception

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)