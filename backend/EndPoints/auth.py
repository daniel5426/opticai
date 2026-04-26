from fastapi import APIRouter, Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic, Company
from auth import get_current_user, get_password_hash, verify_password, verify_supabase_token
from jose import jwt
from datetime import datetime, timedelta
from config import settings
from schemas import (
    Clinic as ClinicSchema,
    ClinicGoogleLoginRequest,
    ClinicSessionRequest,
    CompleteSetupRequest,
    User as UserSchema,
)
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel
import time
import uuid

router = APIRouter(prefix="/auth", tags=["authentication"])
optional_security = HTTPBearer(auto_error=False)
CEO_LEVEL = 4

_attempts = {}

def _check_rate_limit(key: str, limit: int = 8, window_seconds: int = 300):
    now = time.time()
    values = [ts for ts in _attempts.get(key, []) if now - ts < window_seconds]
    if len(values) >= limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts")
    values.append(now)
    _attempts[key] = values

class PasswordlessLoginRequest(BaseModel):
    username: str

class LoginRequest(BaseModel):
    username: str
    password: str
    clinic_id: int | None = None

def _jwt_secret() -> str:
    secret = settings.SUPABASE_JWT_SECRET or settings.SUPABASE_KEY or settings.SECRET_KEY
    if not secret:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Authentication configuration error")
    return secret

def _issue_user_token(user: User) -> str:
    payload = {
        "email": user.email or f"{user.username}@clinic.local",
        "username": user.username,
        "user_id": str(user.id),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=24),
        "aud": "authenticated",
        "role": "authenticated"
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")

def _issue_clinic_trust_token(clinic: Clinic, device_id: str) -> str:
    payload = {
        "token_type": "clinic_trust",
        "clinic_id": clinic.id,
        "company_id": clinic.company_id,
        "device_id": device_id,
        "entry_pin_version": clinic.entry_pin_version or 1,
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, _jwt_secret(), algorithm="HS256")

def _verify_clinic_trust(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
    device_id: str | None = None,
) -> tuple[Clinic, dict]:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic trust required")
    try:
        payload = jwt.decode(
            credentials.credentials,
            _jwt_secret(),
            algorithms=["HS256"],
            options={"verify_aud": False, "verify_exp": False},
        )
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic trust")
    if payload.get("token_type") != "clinic_trust":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic trust")
    if device_id and payload.get("device_id") != device_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device mismatch")
    clinic = db.query(Clinic).filter(Clinic.id == payload.get("clinic_id")).first()
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic not active")
    if not clinic.entry_pin_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic PIN not configured")
    if int(payload.get("entry_pin_version") or 0) != int(clinic.entry_pin_version or 1):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic trust revoked")
    return clinic, payload

def _user_response(user: User) -> UserSchema:
    return UserSchema.model_validate(user)

def _clinic_response(clinic: Clinic) -> ClinicSchema:
    return ClinicSchema.model_validate(clinic)

def _bearer_value(value: str | None) -> str | None:
    if not value:
        return None
    return value.split(" ", 1)[1] if value.lower().startswith("bearer ") else value

@router.post("/login")
async def login_with_password(
    request: LoginRequest,
    db: Session = Depends(get_db)
):
    """Login endpoint for users with passwords"""
    # Find user by username
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Check if user has a password
    if not user.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user doesn't have a password. Please use passwordless login."
        )
    
    if request.clinic_id is not None:
        clinic = db.query(Clinic).filter(Clinic.id == request.clinic_id).first()
        if not clinic or not clinic.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic")
        is_same_clinic_user = user.clinic_id == clinic.id
        is_company_owner = user.role_level >= CEO_LEVEL and user.company_id == clinic.company_id
        if not is_same_clinic_user and not is_company_owner:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic credentials")

    _check_rate_limit(f"password:{request.username}")
    if not verify_password(request.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    return {
        "access_token": _issue_user_token(user),
        "token_type": "bearer",
        "user": _user_response(user)
    }

@router.post("/clinic-session")
async def create_clinic_session(
    request: ClinicSessionRequest,
    db: Session = Depends(get_db)
):
    clinic = db.query(Clinic).filter(Clinic.unique_id == request.clinic_unique_id).first()
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic credentials")
    _check_rate_limit(f"clinic-pin:{clinic.id}:{request.device_id}", limit=6)
    if not clinic.entry_pin_hash:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clinic PIN is not configured")
    if not verify_password(request.pin, clinic.entry_pin_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic credentials")
    return {
        "clinic_trust_token": _issue_clinic_trust_token(clinic, request.device_id),
        "token_type": "clinic_trust",
        "clinic": _clinic_response(clinic),
    }

@router.post("/login-no-password")
async def login_no_password(
    request: PasswordlessLoginRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db)
):
    """Login endpoint for users without passwords"""
    clinic, _ = _verify_clinic_trust(credentials, db)
    # Find user by username
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or user not active"
        )
    
    # Check if user has no password (passwordless user)
    if user.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user requires a password. Please use regular login."
        )

    if user.role_level >= CEO_LEVEL:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Privileged users must use password or Google login")
    if user.clinic_id != clinic.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not belong to trusted clinic")
    
    return {
        "access_token": _issue_user_token(user),
        "token_type": "bearer",
        "user": _user_response(user)
    }

@router.post("/clinic-google-login")
async def clinic_google_login(
    request: ClinicGoogleLoginRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    x_supabase_authorization: str | None = Header(default=None),
    db: Session = Depends(get_db)
):
    clinic, _ = _verify_clinic_trust(credentials, db, request.device_id)
    user = db.query(User).filter(User.id == request.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")
    if user.clinic_id != clinic.id and not (user.role_level >= CEO_LEVEL and user.company_id == clinic.company_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="User does not belong to trusted clinic")
    if user.auth_provider != "google":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Selected user is not configured for Google login")

    supabase_token = _bearer_value(x_supabase_authorization)
    if not supabase_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase token required")
    try:
        payload = verify_supabase_token(supabase_token)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    oauth_email = (payload.get("email") or payload.get("user_metadata", {}).get("email") or "").lower()
    login_email = user.email or user.google_account_email
    allowed_emails = [login_email.lower()] if login_email else []
    if not oauth_email or oauth_email not in allowed_emails:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Google account does not match selected user")

    return {
        "access_token": _issue_user_token(user),
        "token_type": "bearer",
        "user": _user_response(user)
    }

@router.post("/complete-setup")
async def complete_setup(
    request: CompleteSetupRequest,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db)
):
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Supabase token required")
    try:
        payload = verify_supabase_token(credentials.credentials)
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Supabase token")
    email = payload.get("email") or payload.get("user_metadata", {}).get("email")
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Supabase email required")
    full_name = payload.get("user_metadata", {}).get("full_name") or email.split("@")[0]
    provider = payload.get("app_metadata", {}).get("provider")
    providers = payload.get("app_metadata", {}).get("providers") or []
    is_google = provider == "google" or "google" in providers

    existing = db.query(User).filter(User.email == email).first()
    if existing and existing.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already linked to a company")
    try:
        company_payload = request.company
        clinic_payload = request.clinic
        company = Company(
            name=company_payload.get("name"),
            owner_full_name=company_payload.get("owner_full_name") or full_name,
            contact_email=company_payload.get("contact_email") or email,
            contact_phone=company_payload.get("contact_phone") or "",
            address=company_payload.get("address") or "",
        )
        db.add(company)
        db.flush()

        if existing:
            user = existing
            user.company_id = company.id
            user.role_level = max(user.role_level or 1, CEO_LEVEL)
            user.clinic_id = None
            user.full_name = user.full_name or full_name
            user.auth_provider = "google" if is_google else "email"
            user.google_account_connected = is_google
            user.google_account_email = email if is_google else user.google_account_email
        else:
            base_username = email.split("@")[0] + "_ceo"
            username = base_username
            counter = 1
            while db.query(User).filter(User.username == username).first():
                counter += 1
                username = f"{base_username}_{counter}"
            user = User(
                company_id=company.id,
                clinic_id=None,
                username=username,
                email=email,
                full_name=full_name,
                password=None,
                role_level=CEO_LEVEL,
                is_active=True,
                auth_provider="google" if is_google else "email",
                google_account_connected=is_google,
                google_account_email=email if is_google else None,
            )
            db.add(user)

        clinic = Clinic(
            company_id=company.id,
            name=clinic_payload.get("name"),
            location=clinic_payload.get("location"),
            phone_number=clinic_payload.get("phone_number"),
            email=clinic_payload.get("email"),
            unique_id=clinic_payload.get("unique_id") or uuid.uuid4().hex,
            entry_pin_version=1,
        )
        db.add(clinic)
        db.commit()
        db.refresh(company)
        db.refresh(user)
        db.refresh(clinic)
        return {"company": company, "user": _user_response(user), "clinic": _clinic_response(clinic)}
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Setup integrity error")
    except Exception:
        db.rollback()
        raise

@router.post("/logout")
async def logout():
    """Logout endpoint for clinic users"""
    # For clinic users, logout is handled on the frontend
    # This endpoint exists for consistency and potential future use
    return {"message": "Logged out successfully"}

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return _user_response(current_user)
