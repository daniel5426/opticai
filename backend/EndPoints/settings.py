from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Optional
from database import get_db
from models import Settings, Clinic, Company, User
from schemas import SettingsCreate, SettingsUpdate, Settings as SettingsSchema
from schemas import SaveAllRequest, SaveAllResponse
from auth import encrypt_secret, get_password_hash
from utils.storage import upload_base64_image
from auth import get_current_user
from security.scope import (
    assert_company_scope,
    get_allowed_clinic_ids,
    get_scoped_settings,
    get_scoped_user,
    normalize_clinic_id_for_company,
    require_company_admin,
    resolve_company_id,
)

router = APIRouter(prefix="/settings", tags=["settings"])

@router.post("/", response_model=SettingsSchema)
def create_settings(
    settings: SettingsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    payload = settings.dict()
    payload["clinic_id"] = normalize_clinic_id_for_company(db, current_user, payload.get("clinic_id"))
    if payload.get('clinic_logo_path'):
        try:
            payload['clinic_logo_path'] = upload_base64_image(payload['clinic_logo_path'], f"clinics/{payload.get('clinic_id') or 'no-clinic'}/logos")
        except Exception:
            pass
    db_settings = Settings(**payload)
    db.add(db_settings)
    db.commit()
    db.refresh(db_settings)
    return db_settings

@router.get("/clinic/{clinic_id}", response_model=SettingsSchema)
def get_settings_by_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    normalize_clinic_id_for_company(db, current_user, clinic_id)
    settings = db.query(Settings).filter(Settings.clinic_id == clinic_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found for clinic")
    return settings

@router.get("/", response_model=List[SettingsSchema])
def get_all_settings(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    company_id = resolve_company_id(db, current_user)
    assert_company_scope(current_user, company_id)
    clinic_id_list = get_allowed_clinic_ids(db, current_user, clinic_id)
    query = db.query(Settings).filter(Settings.clinic_id.in_(clinic_id_list))
    return query.all()

@router.get("/{settings_id}", response_model=SettingsSchema)
def get_settings(
    settings_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return get_scoped_settings(db, current_user, settings_id)

@router.put("/{settings_id}", response_model=SettingsSchema)
def update_settings(
    settings_id: int,
    settings: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db_settings = get_scoped_settings(db, current_user, settings_id)
    
    update_fields = settings.dict(exclude_unset=True)
    if "clinic_id" in update_fields:
        update_fields["clinic_id"] = normalize_clinic_id_for_company(db, current_user, update_fields["clinic_id"])
    if update_fields.get('clinic_logo_path'):
        try:
            update_fields['clinic_logo_path'] = upload_base64_image(update_fields['clinic_logo_path'], f"clinics/{db_settings.clinic_id or 'no-clinic'}/logos")
        except Exception:
            pass
    for field, value in update_fields.items():
        setattr(db_settings, field, value)
    
    db.commit()
    db.refresh(db_settings)
    return db_settings

@router.delete("/{settings_id}")
def delete_settings(
    settings_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    settings = get_scoped_settings(db, current_user, settings_id)
    
    db.delete(settings)
    db.commit()
    return {"message": "Settings deleted successfully"} 

@router.post("/save-all", response_model=SaveAllResponse)
def save_all(
    payload: SaveAllRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Atomically save clinic, settings, user and company in a single call.
    Each object is optional; only provided sections are updated.
    """
    result = SaveAllResponse()
    try:
        # Company
        if payload.company_id and payload.company is not None:
            require_company_admin(db, current_user, payload.company_id)
            db_company = db.query(Company).filter(Company.id == payload.company_id).first()
            if not db_company:
                raise HTTPException(status_code=404, detail="Company not found")
            c_update = payload.company.dict(exclude_unset=True)
            if c_update.get('logo_path'):
                try:
                    c_update['logo_path'] = upload_base64_image(c_update['logo_path'], f"companies/{payload.company_id}")
                except Exception:
                    pass
            for field, value in c_update.items():
                setattr(db_company, field, value)
            db.add(db_company)

        # Clinic
        if payload.clinic_id and payload.clinic is not None:
            normalize_clinic_id_for_company(db, current_user, payload.clinic_id)
            db_clinic = db.query(Clinic).filter(Clinic.id == payload.clinic_id).first()
            if not db_clinic:
                raise HTTPException(status_code=404, detail="Clinic not found")
            cl_update = payload.clinic.dict(exclude_unset=True)
            entry_pin = cl_update.pop('entry_pin', None)
            remove_entry_pin = bool(cl_update.pop('remove_entry_pin', False))
            cl_update.pop('has_entry_pin', None)
            if entry_pin is not None:
                entry_pin = entry_pin.strip()
                if not entry_pin:
                    entry_pin = None
                elif len(entry_pin) < 4:
                    raise HTTPException(status_code=400, detail="Clinic PIN must be at least 4 characters")
                elif len(entry_pin.encode("utf-8")) > 72:
                    raise HTTPException(status_code=400, detail="Clinic PIN must be 72 bytes or fewer")
                if entry_pin:
                    db_clinic.entry_pin_hash = get_password_hash(entry_pin)
                    db_clinic.entry_pin_version = (db_clinic.entry_pin_version or 1) + 1
            if remove_entry_pin and not entry_pin and db_clinic.entry_pin_hash:
                db_clinic.entry_pin_hash = None
                db_clinic.entry_pin_version = (db_clinic.entry_pin_version or 1) + 1
            if cl_update.get('clinic_logo_path'):
                try:
                    cl_update['clinic_logo_path'] = upload_base64_image(cl_update['clinic_logo_path'], f"clinics/{payload.clinic_id}/logos")
                except Exception:
                    pass
            for field, value in cl_update.items():
                setattr(db_clinic, field, value)
            db.add(db_clinic)

        # Settings
        if payload.settings is not None:
            if payload.settings_id:
                db_settings = get_scoped_settings(db, current_user, payload.settings_id)
                s_update = payload.settings.dict(exclude_unset=True)
                if "clinic_id" in s_update:
                    s_update["clinic_id"] = normalize_clinic_id_for_company(db, current_user, s_update["clinic_id"])
                if s_update.get('clinic_logo_path'):
                    try:
                        s_update['clinic_logo_path'] = upload_base64_image(s_update['clinic_logo_path'], f"clinics/{db_settings.clinic_id or payload.clinic_id or 'no-clinic'}/logos")
                    except Exception:
                        pass
                for field, value in s_update.items():
                    setattr(db_settings, field, value)
                db.add(db_settings)
            else:
                # Create new when no id provided but clinic_id exists in settings
                s_payload = payload.settings.dict(exclude_unset=True)
                s_payload["clinic_id"] = normalize_clinic_id_for_company(
                    db,
                    current_user,
                    s_payload.get("clinic_id") or payload.clinic_id,
                )
                if s_payload.get('clinic_logo_path'):
                    try:
                        s_payload['clinic_logo_path'] = upload_base64_image(s_payload['clinic_logo_path'], f"clinics/{s_payload.get('clinic_id') or payload.clinic_id or 'no-clinic'}/logos")
                    except Exception:
                        pass
                s = Settings(**s_payload)
                db.add(s)

        # User
        if payload.user_id and payload.user is not None:
            db_user = get_scoped_user(db, current_user, payload.user_id)

            update_fields = payload.user.dict(exclude_unset=True)
            if update_fields.get('profile_picture'):
                try:
                    update_fields['profile_picture'] = upload_base64_image(update_fields['profile_picture'], f"users/{payload.user_id}/profile")
                except Exception:
                    pass
            if "password" in update_fields:
                update_fields["password_hash"] = get_password_hash(update_fields["password"]) if update_fields["password"] else None
                update_fields.pop("password", None)
            if update_fields.get("google_account_connected") is False:
                update_fields["google_access_token"] = None
                update_fields["google_refresh_token"] = None
                update_fields["google_account_email"] = None
            else:
                if "google_access_token" in update_fields:
                    update_fields["google_access_token"] = encrypt_secret(update_fields["google_access_token"])
                if "google_refresh_token" in update_fields:
                    update_fields["google_refresh_token"] = encrypt_secret(update_fields["google_refresh_token"])

            for field, value in update_fields.items():
                setattr(db_user, field, value)
            db.add(db_user)

        db.commit()

        # Refresh and populate response
        if payload.company_id:
            result.company = db.query(Company).filter(Company.id == payload.company_id).first()
        if payload.clinic_id:
            result.clinic = db.query(Clinic).filter(Clinic.id == payload.clinic_id).first()
        if payload.settings_id:
            result.settings = db.query(Settings).filter(Settings.id == payload.settings_id).first()
        else:
            # Attempt to resolve created settings by clinic if provided
            if payload.settings and getattr(payload.settings, 'clinic_id', None):
                result.settings = db.query(Settings).filter(Settings.clinic_id == payload.settings.clinic_id).first()
        if payload.user_id:
            result.user = db.query(User).filter(User.id == payload.user_id).first()

        return result
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
