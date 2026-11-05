from datetime import timedelta, timezone
from typing import Any, Literal, Optional
import hashlib
import hmac
import html
import logging
import math
import secrets
import uuid

import httpx
import requests
from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from pydantic import BaseModel, Field, model_validator
from sqlalchemy import func, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import create_auth_session, get_password_hash, new_secret_token, token_hash, utcnow
from config import settings
from currency import normalize_currency
from database import get_db
from models import AuthActionToken, Clinic, Company, PendingCompanySetup, Subscription, TermsAcceptance, User
from services.default_exam_layouts import ensure_default_exam_layouts_for_clinic
from services.lookup_defaults import seed_default_lookup_values_for_clinic
from services.plan_catalog import require_plan
from services.subscription_service import create_pending_subscription, ensure_legacy_subscription
from services.transactional_email import send_email


router = APIRouter(prefix="/auth", tags=["web-authentication"])
CEO_LEVEL = 4
VERIFICATION_MINUTES = 10
RESEND_SECONDS = 60
MAX_VERIFICATION_ATTEMPTS = 5
EMAIL_VERIFICATION_PURPOSES = ("verify_email", "verify_email_code")
logger = logging.getLogger(__name__)


class WebRegisterStart(BaseModel):
    email: str
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Field(min_length=2, max_length=160)
    plan_code: str
    language: Literal["he", "en", "fr"] = "en"
    verification_method: Literal["link", "code"] = "link"


class SetupTokenRequest(BaseModel):
    setup_token: str


class VerificationResendRequest(SetupTokenRequest):
    language: Literal["he", "en", "fr"] = "en"
    verification_method: Optional[Literal["link", "code"]] = None


class VerifyEmailRequest(BaseModel):
    token: Optional[str] = Field(default=None, min_length=32, max_length=256)
    code: Optional[str] = Field(default=None, pattern=r"^[0-9]{6}$")
    setup_token: Optional[str] = None

    @model_validator(mode="after")
    def require_proof(self):
        if bool(self.token) == bool(self.code) or (self.code and not self.setup_token):
            raise ValueError("Provide a verification link token or a code with its setup token")
        return self


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


def _utc(value):
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _expired(value) -> bool:
    return value is None or _utc(value) <= _utc(utcnow())


def _pending(db: Session, setup_token: str, *, lock: bool = False) -> PendingCompanySetup:
    query = db.query(PendingCompanySetup).filter(
        PendingCompanySetup.setup_token_hash == token_hash(setup_token)
    )
    row = (query.with_for_update() if lock else query).first()
    if not row or row.used_at is not None or _expired(row.expires_at):
        raise HTTPException(status_code=401, detail={"code": "invalid_setup_token"})
    return row


def _issue_action_token(db: Session, purpose: str, *, pending_id: str | None = None, user_id: int | None = None, hours: int = 1) -> str:
    raw = new_secret_token()
    db.add(AuthActionToken(
        id=str(uuid.uuid4()), token_hash=token_hash(raw), purpose=purpose,
        pending_setup_id=pending_id, user_id=user_id,
        expires_at=_utc(utcnow()) + timedelta(hours=hours),
        created_at=_utc(utcnow()),
    ))
    return raw


def _latest_verification(db: Session, pending: PendingCompanySetup) -> Optional[AuthActionToken]:
    return db.query(AuthActionToken).filter(
        AuthActionToken.pending_setup_id == pending.id,
        AuthActionToken.purpose.in_(EMAIL_VERIFICATION_PURPOSES),
    ).order_by(AuthActionToken.created_at.desc(), AuthActionToken.id.desc()).first()


def _resend_at(action: AuthActionToken):
    created = action.created_at
    if created.tzinfo is None:
        created = created.replace(tzinfo=timezone.utc)
    return created + timedelta(seconds=RESEND_SECONDS)


def _check_verification_cooldown(db: Session, pending: PendingCompanySetup) -> None:
    latest = _latest_verification(db, pending)
    if latest:
        seconds = math.ceil((_resend_at(latest) - _utc(utcnow())).total_seconds())
        if seconds > 0:
            raise HTTPException(status_code=429, detail={
                "code": "verification_cooldown", "retry_after": seconds,
            }, headers={"Retry-After": str(seconds)})


def _code_hash(pending: PendingCompanySetup, code: str, challenge_id: str) -> str:
    # A database dump cannot brute-force six digits without the server key.
    value = f"verify_email_code:{pending.id}:{pending.setup_token_hash}:{challenge_id}:{code}"
    return hmac.new(settings.SECRET_KEY.encode(), value.encode(), hashlib.sha256).hexdigest()


def _invalidate_verifications(db: Session, pending: PendingCompanySetup) -> None:
    db.query(AuthActionToken).filter(
        AuthActionToken.pending_setup_id == pending.id,
        AuthActionToken.purpose.in_(EMAIL_VERIFICATION_PURPOSES),
        AuthActionToken.consumed_at.is_(None),
    ).update({"consumed_at": utcnow()}, synchronize_session="fetch")


def _deliver_verification(db: Session, pending: PendingCompanySetup, subject: str, body: str) -> None:
    try:
        delivered = send_email(to=pending.email, subject=subject, html=body)
    except httpx.HTTPError:
        logger.warning("Signup verification email delivery failed")
        delivered = False
    if not delivered:
        db.rollback()
        raise HTTPException(status_code=503, detail={"code": "email_delivery_unavailable"})


def _send_verification(db: Session, pending: PendingCompanySetup, language: str = "en", method: str = "code") -> None:
    previous = _latest_verification(db, pending)
    _invalidate_verifications(db, pending)
    direction = "rtl" if language == "he" else "ltr"
    if method == "link":
        # Old signup pages still need links while the new frontend rolls out.
        raw = _issue_action_token(db, "verify_email", pending_id=pending.id, hours=24)
        url = html.escape(f"{settings.SITE_URL}/verify-email?token={raw}")
        subject, label, expiry = {
            "en": ("Verify your Prysm email", "Verify your email", "This link expires in 24 hours."),
            "he": ("אימות האימייל שלך ב־Prysm", "אימות האימייל", "תוקף הקישור הוא 24 שעות."),
            "fr": ("Vérifiez votre e-mail Prysm", "Vérifier mon e-mail", "Ce lien expire dans 24 heures."),
        }[language]
        _deliver_verification(db, pending, subject, f'<div lang="{language}" dir="{direction}"><p><a href="{url}">{label}</a></p><p>{expiry}</p></div>')
        return
    code = f"{secrets.randbelow(1_000_000):06d}"
    if previous and previous.purpose == "verify_email_code":
        # A resend must visibly replace the immediately previous code.
        while hmac.compare_digest(previous.token_hash, _code_hash(pending, code, previous.id)):
            code = f"{secrets.randbelow(1_000_000):06d}"
    now = _utc(utcnow())
    challenge_id = str(uuid.uuid4())
    db.add(AuthActionToken(
        id=challenge_id, token_hash=_code_hash(pending, code, challenge_id), purpose="verify_email_code",
        pending_setup_id=pending.id, expires_at=now + timedelta(minutes=VERIFICATION_MINUTES),
        created_at=now, failed_attempts=0,
    ))
    subject, message, expiry = {
        "en": ("Your Prysm verification code", "Enter this code in the signup page you already have open.", "This code expires in 10 minutes. If you did not request it, you can ignore this email."),
        "he": ("קוד האימות שלך ב־Prysm", "הזינו את הקוד בעמוד ההרשמה שכבר פתוח אצלכם.", "תוקף הקוד הוא 10 דקות. אם לא ביקשתם אותו, אפשר להתעלם מהאימייל."),
        "fr": ("Votre code de vérification Prysm", "Saisissez ce code sur la page d’inscription déjà ouverte.", "Ce code expire dans 10 minutes. Si vous ne l’avez pas demandé, ignorez cet e-mail."),
    }[language]
    _deliver_verification(db, pending, subject,
        f'<div lang="{language}" dir="{direction}"><p>{message}</p><p dir="ltr" style="font-size:32px;letter-spacing:8px;font-weight:bold">{code}</p><p>{expiry}</p></div>')


def _setup_payload(raw: str, pending: PendingCompanySetup, db: Session | None = None) -> dict:
    latest = _latest_verification(db, pending) if db is not None and not pending.email_verified_at else None
    return {
        "status": "verification_required" if not pending.email_verified_at else "onboarding_required",
        "setup_token": raw,
        "email": pending.email,
        "full_name": pending.full_name,
        "plan_code": pending.selected_plan_code,
        "wizard_state": pending.wizard_state,
        "company": pending.company_payload,
        "clinic": pending.clinic_payload,
        "verification": {
            "method": "code" if latest.purpose == "verify_email_code" else "link",
            "expires_at": _utc(latest.expires_at),
            "resend_available_at": _resend_at(latest),
            "attempts_remaining": max(0, MAX_VERIFICATION_ATTEMPTS - latest.failed_attempts),
        } if latest else None,
    }


@router.post("/web/register/start")
def register_start(payload: WebRegisterStart, db: Session = Depends(get_db)):
    email = _normalized_email(payload.email)
    plan = require_plan(payload.plan_code, self_service=True)
    if _find_user_by_email(db, email):
        raise HTTPException(status_code=409, detail={"code": "email_already_registered"})
    if db.bind.dialect.name == "postgresql":
        # Serialize even the first registration for an address, before a row exists.
        lock_id = int.from_bytes(hashlib.sha256(email.encode()).digest()[:8], "big", signed=True)
        db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock_id})
    existing = db.query(PendingCompanySetup).filter(
        func.lower(PendingCompanySetup.email) == email,
        PendingCompanySetup.used_at.is_(None),
    ).order_by(PendingCompanySetup.created_at.desc()).with_for_update().first()
    if existing:
        _check_verification_cooldown(db, existing)
    raw = new_secret_token()
    pending = existing or PendingCompanySetup(id=str(uuid.uuid4()), email=email)
    pending.setup_token_hash = token_hash(raw)
    pending.full_name = payload.full_name.strip()
    pending.password_hash = get_password_hash(payload.password)
    pending.auth_provider = "email"
    # Replacing credentials must require fresh proof of email ownership.
    pending.email_verified_at = None
    pending.company_payload = None
    pending.clinic_payload = None
    pending.google_account_email = None
    pending.google_access_token = None
    pending.google_refresh_token = None
    pending.selected_plan_code = plan.code
    pending.wizard_state = "verify_email"
    pending.expires_at = _utc(utcnow()) + timedelta(days=7)
    if not existing:
        db.add(pending)
    db.flush()
    _send_verification(db, pending, payload.language, payload.verification_method)
    db.commit()
    return _setup_payload(raw, pending, db)


@router.post("/web/register/resend")
def register_resend(payload: VerificationResendRequest, db: Session = Depends(get_db)):
    pending = _pending(db, payload.setup_token, lock=True)
    if pending.email_verified_at:
        return {"status": "already_verified"}
    _check_verification_cooldown(db, pending)
    latest = _latest_verification(db, pending)
    method = payload.verification_method or ("code" if latest and latest.purpose == "verify_email_code" else "link")
    _send_verification(db, pending, payload.language, method)
    db.commit()
    return {"status": "sent", "verification": _setup_payload(payload.setup_token, pending, db)["verification"]}


@router.post("/web/verify-email")
def verify_email(payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    if payload.code is not None:
        pending = _pending(db, payload.setup_token, lock=True)
        action = _latest_verification(db, pending)
        if (not action or action.purpose != "verify_email_code" or action.consumed_at is not None
                or _expired(action.expires_at) or action.failed_attempts >= MAX_VERIFICATION_ATTEMPTS):
            raise HTTPException(status_code=400, detail={"code": "invalid_or_expired_code"})
        if not hmac.compare_digest(action.token_hash, _code_hash(pending, payload.code, action.id)):
            action.failed_attempts += 1
            db.commit()
            raise HTTPException(status_code=400, detail={
                "code": "verification_attempts_exhausted" if action.failed_attempts >= MAX_VERIFICATION_ATTEMPTS else "invalid_or_expired_code",
                "attempts_remaining": max(0, MAX_VERIFICATION_ATTEMPTS - action.failed_attempts),
            })
        return _complete_verification(db, pending)

    # Existing 24-hour email links remain valid until used, expired or superseded.
    action = db.query(AuthActionToken).filter(
        AuthActionToken.token_hash == token_hash(payload.token),
        AuthActionToken.purpose == "verify_email",
    ).first()
    if not action or action.consumed_at is not None or _expired(action.expires_at):
        raise HTTPException(status_code=400, detail={"code": "invalid_or_expired_token"})
    pending = db.query(PendingCompanySetup).filter(PendingCompanySetup.id == action.pending_setup_id).with_for_update().first()
    if not pending or pending.used_at is not None:
        raise HTTPException(status_code=400, detail={"code": "invalid_or_expired_token"})
    db.refresh(action)
    if action.consumed_at is not None or _expired(action.expires_at):
        raise HTTPException(status_code=400, detail={"code": "invalid_or_expired_token"})
    return _complete_verification(db, pending)


def _complete_verification(db: Session, pending: PendingCompanySetup) -> dict:
    if _expired(pending.expires_at):
        raise HTTPException(status_code=400, detail={"code": "invalid_setup_token"})
    _invalidate_verifications(db, pending)
    pending.email_verified_at = _utc(utcnow())
    pending.wizard_state = "company"
    raw_setup = new_secret_token()
    pending.setup_token_hash = token_hash(raw_setup)
    db.commit()
    return _setup_payload(raw_setup, pending)


@router.get("/web/onboarding")
def onboarding_state(setup_token: Optional[str] = None,
                     x_setup_token: Optional[str] = Header(default=None, alias="X-Prysm-Setup-Token"),
                     db: Session = Depends(get_db)):
    credential = x_setup_token or setup_token or ""
    return _setup_payload(credential, _pending(db, credential), db)


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
            default_currency=normalize_currency(company_data.get("default_currency")),
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
    if not action or action.consumed_at is not None or _expired(action.expires_at):
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
        expires_at=_utc(utcnow()) + timedelta(days=7),
    )
    db.add(pending)
    db.commit()
    return _setup_payload(raw, pending)
