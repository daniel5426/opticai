from datetime import timedelta
from typing import Any, Optional
import html
import uuid

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import create_auth_session, get_password_hash, is_expired, new_secret_token, token_hash, utcnow
from config import settings
from database import get_db
from models import AuthActionToken, Clinic, Company, PendingCompanySetup, Subscription, TermsAcceptance, User
from services.default_exam_layouts import ensure_default_exam_layouts_for_clinic
from services.lookup_defaults import seed_default_lookup_values_for_clinic
from services.plan_catalog import require_plan
from services.subscription_service import create_pending_subscription, ensure_legacy_subscription
from services.transactional_email import send_email


router = APIRouter(prefix="/auth", tags=["web-authentication"])
CEO_LEVEL = 4


class WebRegisterStart(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=160)
    plan_code: str


class SetupTokenRequest(BaseModel):
    setup_token: str


class VerifyEmailRequest(BaseModel):
    token: str


class OnboardingSaveRequest(BaseModel):
    setup_token: str
    wizard_state: str
    company: Optional[dict[str, Any]] = None
    clinic: Optional[dict[str, Any]] = None


class WebRegisterComplete(BaseModel):
    setup_token: str
    company: dict[str, Any]
    clinic: dict[str, Any]
    terms_accepted: bool
    privacy_accepted: bool


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    password: str = Field(min_length=8, max_length=72)


class WebGoogleRequest(BaseModel):
    id_token: str
    plan_code: Optional[str] = None


def _normalized_email(value: str) -> str:
    email = value.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=400, detail="Valid email is required")
    return email


def _find_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(func.lower(func.trim(User.email)) == email).first()


def _pending(db: Session, setup_token: str) -> PendingCompanySetup:
    row = db.query(PendingCompanySetup).filter(
        PendingCompanySetup.setup_token_hash == token_hash(setup_token)
    ).first()
    if not row or row.used_at is not None or is_expired(row.expires_at):
        raise HTTPException(status_code=401, detail={"code": "invalid_setup_token"})
    return row


def _issue_action_token(db: Session, purpose: str, *, pending_id: str | None = None, user_id: int | None = None, hours: int = 1) -> str:
    raw = new_secret_token()
    db.add(AuthActionToken(
        id=str(uuid.uuid4()), token_hash=token_hash(raw), purpose=purpose,
        pending_setup_id=pending_id, user_id=user_id,
        expires_at=utcnow() + timedelta(hours=hours),
    ))
    return raw


def _send_verification(db: Session, pending: PendingCompanySetup) -> None:
    raw = _issue_action_token(db, "verify_email", pending_id=pending.id, hours=24)
    url = f"{settings.SITE_URL}/verify-email?token={raw}"
    send_email(
        to=pending.email, subject="Verify your Prysm email",
        html=f"<p>Welcome to Prysm.</p><p><a href=\"{html.escape(url)}\">Verify your email</a></p><p>This link expires in 24 hours.</p>",
    )


def _setup_payload(raw: str, pending: PendingCompanySetup) -> dict:
    return {
        "status": "verification_required" if not pending.email_verified_at else "onboarding_required",
        "setup_token": raw,
        "email": pending.email,
        "full_name": pending.full_name,
        "plan_code": pending.selected_plan_code,
        "wizard_state": pending.wizard_state,
        "company": pending.company_payload,
        "clinic": pending.clinic_payload,
    }


@router.post("/web/register/start")
def register_start(payload: WebRegisterStart, db: Session = Depends(get_db)):
    email = _normalized_email(payload.email)
    plan = require_plan(payload.plan_code, self_service=True)
    if _find_user_by_email(db, email):
        raise HTTPException(status_code=409, detail={"code": "email_already_registered"})
    existing = db.query(PendingCompanySetup).filter(
        func.lower(PendingCompanySetup.email) == email,
        PendingCompanySetup.used_at.is_(None),
    ).order_by(PendingCompanySetup.created_at.desc()).first()
    raw = new_secret_token()
    pending = existing or PendingCompanySetup(id=str(uuid.uuid4()), email=email)
    pending.setup_token_hash = token_hash(raw)
    pending.full_name = payload.full_name.strip()
    pending.password_hash = get_password_hash(payload.password)
    pending.auth_provider = "email"
    pending.selected_plan_code = plan.code
    pending.wizard_state = "verify_email"
    pending.expires_at = utcnow() + timedelta(days=7)
    if not existing:
        db.add(pending)
    db.flush()
    _send_verification(db, pending)
    db.commit()
    return _setup_payload(raw, pending)


@router.post("/web/register/resend")
def register_resend(payload: SetupTokenRequest, db: Session = Depends(get_db)):
    pending = _pending(db, payload.setup_token)
    if pending.email_verified_at:
        return {"status": "already_verified"}
    db.query(AuthActionToken).filter(
        AuthActionToken.pending_setup_id == pending.id,
        AuthActionToken.purpose == "verify_email",
        AuthActionToken.consumed_at.is_(None),
    ).update({"consumed_at": utcnow()}, synchronize_session=False)
    _send_verification(db, pending)
    db.commit()
    return {"status": "sent"}


@router.post("/web/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    action = db.query(AuthActionToken).filter(
        AuthActionToken.token_hash == token_hash(payload.token),
        AuthActionToken.purpose == "verify_email",
    ).first()
    if not action or action.consumed_at is not None or is_expired(action.expires_at):
        raise HTTPException(status_code=400, detail={"code": "invalid_or_expired_token"})
    pending = db.query(PendingCompanySetup).filter(PendingCompanySetup.id == action.pending_setup_id).first()
    if not pending or pending.used_at is not None:
        raise HTTPException(status_code=400, detail={"code": "invalid_or_expired_token"})
    action.consumed_at = utcnow()
    pending.email_verified_at = utcnow()
    pending.wizard_state = "company"
    raw_setup = new_secret_token()
    pending.setup_token_hash = token_hash(raw_setup)
    db.commit()
    return _setup_payload(raw_setup, pending)


@router.get("/web/onboarding")
def onboarding_state(setup_token: str, db: Session = Depends(get_db)):
    return _setup_payload(setup_token, _pending(db, setup_token))


@router.put("/web/onboarding")
def save_onboarding(payload: OnboardingSaveRequest, db: Session = Depends(get_db)):
    pending = _pending(db, payload.setup_token)
    if not pending.email_verified_at:
        raise HTTPException(status_code=403, detail={"code": "email_not_verified"})
    if payload.wizard_state not in {"company", "clinic", "review"}:
        raise HTTPException(status_code=400, detail="Invalid wizard state")
    if payload.company is not None:
        pending.company_payload = payload.company
    if payload.clinic is not None:
        pending.clinic_payload = payload.clinic
    pending.wizard_state = payload.wizard_state
    db.commit()
    return _setup_payload(payload.setup_token, pending)


@router.post("/web/register/complete")
def register_complete(payload: WebRegisterComplete, request: Request, db: Session = Depends(get_db)):
    pending = _pending(db, payload.setup_token)
    if not pending.email_verified_at:
        raise HTTPException(status_code=403, detail={"code": "email_not_verified"})
    if not payload.terms_accepted or not payload.privacy_accepted:
        raise HTTPException(status_code=400, detail={"code": "terms_required"})
    if _find_user_by_email(db, pending.email):
        raise HTTPException(status_code=409, detail={"code": "email_already_registered"})
    plan = require_plan(pending.selected_plan_code or "", self_service=True)
    company_data = payload.company
    clinic_data = payload.clinic
    if not str(company_data.get("name") or "").strip() or not str(clinic_data.get("name") or "").strip():
        raise HTTPException(status_code=400, detail="Company and clinic names are required")
    try:
        company = Company(
            name=company_data["name"].strip(),
            owner_full_name=company_data.get("owner_full_name") or pending.full_name,
            contact_email=pending.email,
            contact_phone=company_data.get("contact_phone") or "",
            address=company_data.get("address") or "",
        )
        db.add(company)
        db.flush()
        username_base = pending.email.split("@", 1)[0] + "_ceo"
        username = username_base
        suffix = 1
        while db.query(User).filter(User.username == username).first():
            suffix += 1
            username = f"{username_base}_{suffix}"
        user = User(
            company_id=company.id, clinic_id=None, full_name=pending.full_name,
            username=username, email=pending.email, password_hash=pending.password_hash,
            role_level=CEO_LEVEL, is_active=True, auth_provider=pending.auth_provider,
        )
        db.add(user)
        clinic = Clinic(
            company_id=company.id, name=clinic_data["name"].strip(),
            location=clinic_data.get("location"), phone_number=clinic_data.get("phone_number"),
            email=clinic_data.get("email"), unique_id=uuid.uuid4().hex, entry_pin_version=1,
        )
        db.add(clinic)
        db.flush()
        ensure_default_exam_layouts_for_clinic(db, clinic.id)
        seed_default_lookup_values_for_clinic(db, clinic.id)
        subscription = create_pending_subscription(db, company.id, plan.code)
        db.add(TermsAcceptance(
            id=str(uuid.uuid4()), user_id=user.id, company_id=company.id,
            terms_version=settings.TERMS_VERSION, privacy_version=settings.PRIVACY_VERSION,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent"),
        ))
        pending.company_payload = company_data
        pending.clinic_payload = clinic_data
        pending.wizard_state = "checkout"
        pending.used_at = utcnow()
        session = create_auth_session(db, user, request=request)
        db.commit()
        return {
            **session, "status": "authenticated", "account_state": "pending_checkout",
            "user": {"id": user.id, "email": user.email, "full_name": user.full_name, "role_level": user.role_level},
            "company": {"id": company.id, "name": company.name},
            "subscription": {"status": subscription.status, "plan_code": subscription.plan_code},
        }
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409, detail={"code": "signup_conflict"}) from exc


@router.post("/password/forgot")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = _normalized_email(payload.email)
    user = _find_user_by_email(db, email)
    if user:
        raw = _issue_action_token(db, "reset_password", user_id=user.id, hours=1)
        url = f"{settings.SITE_URL}/reset-password?token={raw}"
        send_email(to=email, subject="Reset your Prysm password", html=f"<p><a href=\"{html.escape(url)}\">Reset password</a></p><p>This link expires in one hour.</p>")
        db.commit()
    return {"status": "sent_if_registered"}


@router.post("/password/reset")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    action = db.query(AuthActionToken).filter(
        AuthActionToken.token_hash == token_hash(payload.token),
        AuthActionToken.purpose == "reset_password",
    ).first()
    if not action or action.consumed_at is not None or is_expired(action.expires_at):
        raise HTTPException(status_code=400, detail={"code": "invalid_or_expired_token"})
    user = db.query(User).filter(User.id == action.user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail={"code": "invalid_or_expired_token"})
    user.password_hash = get_password_hash(payload.password)
    action.consumed_at = utcnow()
    db.commit()
    return {"status": "password_updated"}


@router.post("/web/google")
def google_identity(payload: WebGoogleRequest, request: Request, db: Session = Depends(get_db)):
    if not settings.GOOGLE_WEB_CLIENT_ID:
        raise HTTPException(status_code=503, detail="Google web login is not configured")
    response = requests.get("https://oauth2.googleapis.com/tokeninfo", params={"id_token": payload.id_token}, timeout=10)
    if not response.ok:
        raise HTTPException(status_code=401, detail="Invalid Google identity")
    identity = response.json()
    if identity.get("aud") != settings.GOOGLE_WEB_CLIENT_ID or identity.get("email_verified") not in {True, "true"}:
        raise HTTPException(status_code=401, detail="Invalid Google identity")
    email = _normalized_email(identity.get("email", ""))
    user = _find_user_by_email(db, email)
    if user:
        if not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid Google identity")
        session = create_auth_session(db, user, request=request)
        subscription = ensure_legacy_subscription(db, user.company_id)
        db.commit()
        return {
            **session,
            "status": "authenticated",
            "account_state": (
                "pending_checkout"
                if subscription.status == "pending_checkout"
                else "account"
            ),
        }
    plan = require_plan(payload.plan_code or "essential", self_service=True)
    raw = new_secret_token()
    pending = PendingCompanySetup(
        id=str(uuid.uuid4()), setup_token_hash=token_hash(raw), email=email,
        full_name=identity.get("name") or email.split("@")[0], auth_provider="google_identity",
        selected_plan_code=plan.code, email_verified_at=utcnow(), wizard_state="company",
        expires_at=utcnow() + timedelta(days=7),
    )
    db.add(pending)
    db.commit()
    return _setup_payload(raw, pending)
