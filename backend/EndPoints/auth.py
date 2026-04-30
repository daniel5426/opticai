from datetime import timedelta
import time
import uuid
from typing import Any, Optional

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import (
    create_auth_session,
    decrypt_secret,
    encrypt_secret,
    get_current_auth_session,
    get_current_user,
    get_password_hash,
    is_expired,
    new_secret_token,
    revoke_auth_session,
    token_hash,
    utcnow,
    verify_password,
)
from config import settings
from database import get_db
from models import AuthSession, Clinic, ClinicDeviceTrust, Company, PendingCompanySetup, User
from schemas import Clinic as ClinicSchema
from schemas import Company as CompanySchema
from schemas import User as UserSchema
from services.default_exam_layouts import ensure_default_exam_layouts_for_clinic

router = APIRouter(prefix="/auth", tags=["authentication"])
optional_security = HTTPBearer(auto_error=False)
CEO_LEVEL = 4
TRUST_EXPIRE_DAYS = 30
SETUP_EXPIRE_HOURS = 24

_attempts: dict[str, list[float]] = {}


def _check_rate_limit(key: str, limit: int = 8, window_seconds: int = 300) -> None:
    now = time.time()
    values = [ts for ts in _attempts.get(key, []) if now - ts < window_seconds]
    if len(values) >= limit:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Too many attempts")
    values.append(now)
    _attempts[key] = values


class RegisterStartRequest(BaseModel):
    email: str
    password: str
    full_name: str


class RegisterCompleteRequest(BaseModel):
    setup_token: str
    company: dict[str, Any]
    clinic: dict[str, Any]


class ClinicTrustRequest(BaseModel):
    clinic_unique_id: str
    pin: str
    device_id: str


class PasswordLoginRequest(BaseModel):
    identifier: str
    password: str
    clinic_id: Optional[int] = None
    device_id: Optional[str] = None


class QuickLoginRequest(BaseModel):
    username: str
    device_id: Optional[str] = None


class GoogleLoginRequest(BaseModel):
    access_token: str
    refresh_token: Optional[str] = None
    id_token: Optional[str] = None
    user_id: Optional[int] = None
    device_id: Optional[str] = None
    user_info: Optional[dict[str, Any]] = None


class RefreshRequest(BaseModel):
    refresh_token: str


def _user_response(user: User) -> UserSchema:
    return UserSchema.model_validate(user)


def _clinic_response(clinic: Clinic) -> ClinicSchema:
    return ClinicSchema.model_validate(clinic)


def _company_response(company: Company) -> CompanySchema:
    return CompanySchema.model_validate(company)


def _find_user_by_identifier(db: Session, identifier: str) -> Optional[User]:
    value = identifier.strip()
    q = db.query(User)
    if "@" in value:
        return q.filter(User.email == value.lower()).first()
    return q.filter(User.username == value).first()


def _session_response(db: Session, user: User, session_payload: dict[str, Any]) -> dict[str, Any]:
    company = db.query(Company).filter(Company.id == user.company_id).first()
    clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first() if user.clinic_id else None
    return {
        **session_payload,
        "status": "authenticated",
        "user": _user_response(user),
        "company": _company_response(company) if company else None,
        "clinic": _clinic_response(clinic) if clinic else None,
    }


def _setup_response(setup_token: str, email: str, full_name: Optional[str], auth_provider: str) -> dict[str, Any]:
    return {
        "status": "setup_required",
        "setup_token": setup_token,
        "email": email,
        "full_name": full_name,
        "auth_provider": auth_provider,
    }


def _verify_clinic_trust(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
    device_id: Optional[str] = None,
) -> ClinicDeviceTrust:
    if not credentials or not credentials.credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic trust required")
    trust = db.query(ClinicDeviceTrust).filter(
        ClinicDeviceTrust.token_hash == token_hash(credentials.credentials)
    ).first()
    if not trust or trust.revoked_at is not None or is_expired(trust.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic trust")
    if device_id and trust.device_id != device_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device mismatch")
    clinic = db.query(Clinic).filter(Clinic.id == trust.clinic_id).first()
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic not active")
    if int(trust.entry_pin_version or 0) != int(clinic.entry_pin_version or 1):
        trust.revoked_at = utcnow()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic trust revoked")
    trust.last_used_at = utcnow()
    return trust


def _store_google_tokens(user: User, access_token: str, refresh_token: Optional[str], email: str) -> None:
    user.google_account_connected = True
    user.google_account_email = email
    user.google_access_token = encrypt_secret(access_token)
    if refresh_token:
        user.google_refresh_token = encrypt_secret(refresh_token)
    user.auth_provider = "google"


def _verify_google_user(access_token: str, id_token: Optional[str] = None) -> dict[str, Any]:
    if not settings.GOOGLE_DESKTOP_CLIENT_ID or not settings.GOOGLE_DESKTOP_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google login is not configured",
        )
    tokeninfo_email = None
    if id_token:
        try:
            token_resp = requests.get(
                "https://oauth2.googleapis.com/tokeninfo",
                params={"id_token": id_token},
                timeout=8,
            )
            token_resp.raise_for_status()
            token_data = token_resp.json()
            if settings.GOOGLE_DESKTOP_CLIENT_ID and token_data.get("aud") != settings.GOOGLE_DESKTOP_CLIENT_ID:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google audience")
            tokeninfo_email = (token_data.get("email") or "").strip().lower()
        except HTTPException:
            raise
        except Exception:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google ID token")

    try:
        resp = requests.get(
            "https://www.googleapis.com/oauth2/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Google token")
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google email is required")
    if tokeninfo_email and tokeninfo_email != email:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Google token email mismatch")
    return data


def _create_pending_setup(
    db: Session,
    email: str,
    full_name: Optional[str],
    password_hash: Optional[str],
    auth_provider: str,
    google_access_token: Optional[str] = None,
    google_refresh_token: Optional[str] = None,
) -> str:
    existing = db.query(User).filter(User.email == email).first()
    if existing and existing.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
    setup_token = new_secret_token()
    pending = PendingCompanySetup(
        id=str(uuid.uuid4()),
        setup_token_hash=token_hash(setup_token),
        email=email,
        full_name=full_name,
        password_hash=password_hash,
        auth_provider=auth_provider,
        google_account_email=email if auth_provider == "google" else None,
        google_access_token=encrypt_secret(google_access_token),
        google_refresh_token=encrypt_secret(google_refresh_token),
        expires_at=utcnow() + timedelta(hours=SETUP_EXPIRE_HOURS),
    )
    db.add(pending)
    db.commit()
    return setup_token


@router.post("/register/start")
async def register_start(request: RegisterStartRequest, db: Session = Depends(get_db)):
    if "@" not in request.email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Valid email is required")
    _check_rate_limit(f"register:{request.email.lower()}", limit=5)
    setup_token = _create_pending_setup(
        db=db,
        email=request.email.lower(),
        full_name=request.full_name,
        password_hash=get_password_hash(request.password),
        auth_provider="email",
    )
    return _setup_response(setup_token, request.email.lower(), request.full_name, "email")


@router.post("/register/complete")
async def register_complete(
    payload: RegisterCompleteRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    pending = db.query(PendingCompanySetup).filter(
        PendingCompanySetup.setup_token_hash == token_hash(payload.setup_token)
    ).first()
    if not pending or pending.used_at is not None or is_expired(pending.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid setup token")

    existing = db.query(User).filter(User.email == pending.email).first()
    if existing and existing.company_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already linked to a company")

    try:
        company_payload = payload.company
        clinic_payload = payload.clinic
        company = Company(
            name=company_payload.get("name"),
            owner_full_name=company_payload.get("owner_full_name") or pending.full_name or pending.email.split("@")[0],
            contact_email=company_payload.get("contact_email") or pending.email,
            contact_phone=company_payload.get("contact_phone") or company_payload.get("phone") or "",
            address=company_payload.get("address") or "",
        )
        db.add(company)
        db.flush()

        base_username = pending.email.split("@")[0] + "_ceo"
        username = base_username
        counter = 1
        while db.query(User).filter(User.username == username).first():
            counter += 1
            username = f"{base_username}_{counter}"

        user = existing or User(username=username)
        user.company_id = company.id
        user.clinic_id = None
        user.email = pending.email
        user.full_name = pending.full_name or pending.email.split("@")[0]
        user.password_hash = pending.password_hash
        user.role_level = CEO_LEVEL
        user.is_active = True
        user.auth_provider = pending.auth_provider
        if pending.auth_provider == "google":
            user.google_account_connected = True
            user.google_account_email = pending.google_account_email
            user.google_access_token = pending.google_access_token
            user.google_refresh_token = pending.google_refresh_token
        if not existing:
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
        pending.used_at = utcnow()
        db.flush()
        ensure_default_exam_layouts_for_clinic(db, clinic.id)
        session_payload = create_auth_session(db, user, request=request)
        db.commit()
        db.refresh(user)
        db.refresh(company)
        db.refresh(clinic)
        return {
            **session_payload,
            "status": "authenticated",
            "user": _user_response(user),
            "company": _company_response(company),
            "clinic": _clinic_response(clinic),
        }
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Setup integrity error")
    except Exception:
        db.rollback()
        raise


@router.post("/clinic/trust")
async def clinic_trust(payload: ClinicTrustRequest, db: Session = Depends(get_db)):
    clinic = db.query(Clinic).filter(Clinic.unique_id == payload.clinic_unique_id).first()
    if not clinic or not clinic.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic credentials")
    _check_rate_limit(f"clinic-pin:{clinic.id}:{payload.device_id}", limit=6)
    if not clinic.entry_pin_hash:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Clinic PIN is not configured")
    if not verify_password(payload.pin, clinic.entry_pin_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic credentials")

    raw_token = new_secret_token()
    existing = db.query(ClinicDeviceTrust).filter(
        ClinicDeviceTrust.clinic_id == clinic.id,
        ClinicDeviceTrust.device_id == payload.device_id,
    ).first()
    trust = existing or ClinicDeviceTrust(clinic_id=clinic.id, device_id=payload.device_id)
    trust.company_id = clinic.company_id
    trust.token_hash = token_hash(raw_token)
    trust.entry_pin_version = clinic.entry_pin_version or 1
    trust.expires_at = utcnow() + timedelta(days=TRUST_EXPIRE_DAYS)
    trust.revoked_at = None
    trust.last_used_at = utcnow()
    if not existing:
        db.add(trust)
    db.commit()
    return {
        "clinic_trust_token": raw_token,
        "token_type": "clinic_trust",
        "clinic": _clinic_response(clinic),
    }


@router.post("/login/password")
async def login_password(
    payload: PasswordLoginRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db),
):
    user = _find_user_by_identifier(db, payload.identifier)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.password_hash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This user does not have a password")
    _check_rate_limit(f"password:{payload.identifier}")
    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    clinic_id = payload.clinic_id
    if clinic_id is not None:
        trust = _verify_clinic_trust(credentials, db, payload.device_id)
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if not clinic or clinic.id != trust.clinic_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid clinic")
        if user.clinic_id != clinic.id and not (user.role_level >= CEO_LEVEL and user.company_id == clinic.company_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    elif user.role_level < CEO_LEVEL:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic trust required")

    session_payload = create_auth_session(db, user, clinic_id=clinic_id, device_id=payload.device_id, request=request)
    db.commit()
    return _session_response(db, user, session_payload)


@router.post("/login/quick")
async def login_quick(
    payload: QuickLoginRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db),
):
    trust = _verify_clinic_trust(credentials, db, payload.device_id)
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if user.password_hash:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="This user requires a password")
    if user.role_level >= CEO_LEVEL:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Privileged users must use password or Google login")
    if user.clinic_id != trust.clinic_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    session_payload = create_auth_session(db, user, clinic_id=trust.clinic_id, device_id=payload.device_id, request=request)
    db.commit()
    return _session_response(db, user, session_payload)


@router.post("/login/google")
async def login_google(
    payload: GoogleLoginRequest,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_security),
    db: Session = Depends(get_db),
):
    google_user = _verify_google_user(payload.access_token, payload.id_token)
    email = google_user["email"].strip().lower()
    full_name = google_user.get("name") or ((payload.user_info or {}).get("name"))

    clinic_id = None
    if payload.user_id is not None:
        trust = _verify_clinic_trust(credentials, db, payload.device_id)
        user = db.query(User).filter(User.id == payload.user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user")
        allowed_email = (user.google_account_email or user.email or "").lower()
        if not allowed_email or allowed_email != email:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Google account does not match selected user")
        if user.clinic_id != trust.clinic_id and not (user.role_level >= CEO_LEVEL and user.company_id == trust.company_id):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
        _store_google_tokens(user, payload.access_token, payload.refresh_token, email)
        clinic_id = trust.clinic_id
    else:
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.company_id:
            setup_token = _create_pending_setup(
                db=db,
                email=email,
                full_name=full_name or email.split("@")[0],
                password_hash=None,
                auth_provider="google",
                google_access_token=payload.access_token,
                google_refresh_token=payload.refresh_token,
            )
            return _setup_response(setup_token, email, full_name, "google")
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
        if user.role_level < CEO_LEVEL:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Clinic trust required")
        _store_google_tokens(user, payload.access_token, payload.refresh_token, email)

    session_payload = create_auth_session(db, user, clinic_id=clinic_id, device_id=payload.device_id, request=request)
    db.commit()
    return _session_response(db, user, session_payload)


@router.post("/refresh")
async def refresh(payload: RefreshRequest, request: Request, db: Session = Depends(get_db)):
    auth_session = db.query(AuthSession).filter(
        AuthSession.refresh_token_hash == token_hash(payload.refresh_token)
    ).first()
    if not auth_session or auth_session.revoked_at is not None or is_expired(auth_session.expires_at):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    user = db.query(User).filter(User.id == auth_session.user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    revoke_auth_session(db, auth_session)
    session_payload = create_auth_session(
        db,
        user,
        clinic_id=auth_session.clinic_id,
        device_id=auth_session.device_id,
        request=request,
    )
    db.commit()
    return _session_response(db, user, session_payload)


@router.post("/logout")
async def logout(
    auth_session: AuthSession = Depends(get_current_auth_session),
    db: Session = Depends(get_db),
):
    revoke_auth_session(db, auth_session)
    db.commit()
    return {"message": "Logged out successfully"}


@router.post("/logout-all")
async def logout_all(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.query(AuthSession).filter(
        AuthSession.user_id == current_user.id,
        AuthSession.revoked_at.is_(None),
    ).update({"revoked_at": utcnow()}, synchronize_session=False)
    db.commit()
    return {"message": "Logged out successfully"}


@router.get("/me")
async def read_users_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = db.query(Company).filter(Company.id == current_user.company_id).first()
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first() if current_user.clinic_id else None
    return {
        "user": _user_response(current_user),
        "company": _company_response(company) if company else None,
        "clinic": _clinic_response(clinic) if clinic else None,
    }


@router.get("/google-tokens")
async def google_tokens(current_user: User = Depends(get_current_user)):
    return {
        "connected": bool(current_user.google_account_connected),
        "email": current_user.google_account_email,
        "access_token": decrypt_secret(current_user.google_access_token) if current_user.google_account_connected else None,
        "refresh_token": decrypt_secret(current_user.google_refresh_token) if current_user.google_account_connected else None,
    }
