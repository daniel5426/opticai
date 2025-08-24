from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from typing import List, Optional
from database import get_db
from models import Settings, Clinic, Company, User
from schemas import SettingsCreate, SettingsUpdate, Settings as SettingsSchema
from schemas import SaveAllRequest, SaveAllResponse, ClinicUpdate, CompanyUpdate, UserUpdate
from config import settings as app_settings
from auth import verify_supabase_token
import requests
from utils.storage import upload_base64_image

router = APIRouter(prefix="/settings", tags=["settings"])

@router.post("/", response_model=SettingsSchema)
def create_settings(settings: SettingsCreate, db: Session = Depends(get_db)):
    payload = settings.dict()
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
def get_settings_by_clinic(clinic_id: int, db: Session = Depends(get_db)):
    settings = db.query(Settings).filter(Settings.clinic_id == clinic_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found for clinic")
    return settings

@router.get("/", response_model=List[SettingsSchema])
def get_all_settings(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    company_id: Optional[int] = Query(None, description="Filter by company ID"),
    db: Session = Depends(get_db)
):
    query = db.query(Settings)
    if clinic_id:
        query = query.filter(Settings.clinic_id == clinic_id)
    elif company_id:
        clinic_ids = db.query(Clinic.id).filter(Clinic.company_id == company_id).all()
        clinic_id_list = [c[0] for c in clinic_ids]
        query = query.filter(Settings.clinic_id.in_(clinic_id_list))
    return query.all()

@router.get("/{settings_id}", response_model=SettingsSchema)
def get_settings(settings_id: int, db: Session = Depends(get_db)):
    settings = db.query(Settings).filter(Settings.id == settings_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    return settings

@router.put("/{settings_id}", response_model=SettingsSchema)
def update_settings(settings_id: int, settings: SettingsUpdate, db: Session = Depends(get_db)):
    db_settings = db.query(Settings).filter(Settings.id == settings_id).first()
    if not db_settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    update_fields = settings.dict(exclude_unset=True)
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
def delete_settings(settings_id: int, db: Session = Depends(get_db)):
    settings = db.query(Settings).filter(Settings.id == settings_id).first()
    if not settings:
        raise HTTPException(status_code=404, detail="Settings not found")
    
    db.delete(settings)
    db.commit()
    return {"message": "Settings deleted successfully"} 

@router.post("/save-all", response_model=SaveAllResponse)
def save_all(payload: SaveAllRequest, db: Session = Depends(get_db), request: Request = None):
    """Atomically save clinic, settings, user and company in a single call.
    Each object is optional; only provided sections are updated.
    """
    result = SaveAllResponse()
    try:
        # Company
        if payload.company_id and payload.company is not None:
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
            db_clinic = db.query(Clinic).filter(Clinic.id == payload.clinic_id).first()
            if not db_clinic:
                raise HTTPException(status_code=404, detail="Clinic not found")
            cl_update = payload.clinic.dict(exclude_unset=True)
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
                db_settings = db.query(Settings).filter(Settings.id == payload.settings_id).first()
                if not db_settings:
                    raise HTTPException(status_code=404, detail="Settings not found")
                s_update = payload.settings.dict(exclude_unset=True)
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
                if s_payload.get('clinic_logo_path'):
                    try:
                        s_payload['clinic_logo_path'] = upload_base64_image(s_payload['clinic_logo_path'], f"clinics/{s_payload.get('clinic_id') or payload.clinic_id or 'no-clinic'}/logos")
                    except Exception:
                        pass
                s = Settings(**s_payload)
                db.add(s)

        # User
        if payload.user_id and payload.user is not None:
            db_user = db.query(User).filter(User.id == payload.user_id).first()
            if not db_user:
                raise HTTPException(status_code=404, detail="User not found")

            # Sync email change to Supabase Auth (admin) before updating DB
            update_fields = payload.user.dict(exclude_unset=True)
            if update_fields.get('profile_picture'):
                try:
                    update_fields['profile_picture'] = upload_base64_image(update_fields['profile_picture'], f"users/{payload.user_id}/profile")
                except Exception:
                    pass
            new_email = update_fields.get("email")
            old_email = db_user.email
            if new_email and old_email and new_email != old_email:
                # App-level uniqueness guard in our DB (case-insensitive)
                existing_email_user = (
                    db.query(User)
                    .filter(func.lower(User.email) == (new_email or '').lower())
                    .first()
                )
                if existing_email_user and existing_email_user.id != db_user.id:
                    raise HTTPException(status_code=400, detail="EMAIL_ALREADY_REGISTERED")
                supabase_url = app_settings.SUPABASE_URL.rstrip("/") if app_settings.SUPABASE_URL else None
                # Use service role if provided; fall back to SUPABASE_KEY for backward compatibility
                supabase_key = app_settings.SUPABASE_SERVICE_ROLE_KEY or app_settings.SUPABASE_KEY or None
                if not supabase_url or not supabase_key:
                    raise HTTPException(status_code=500, detail="Supabase is not configured on the backend")
                admin_headers = {
                    "apikey": supabase_key,
                    "Authorization": f"Bearer {supabase_key}",
                    "Content-Type": "application/json",
                }
                # Try updating by Supabase user id from the current JWT when editing self
                try:
                    if request is not None:
                        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
                    else:
                        auth_header = None
                    if auth_header and auth_header.lower().startswith("bearer "):
                        token = auth_header.split(" ", 1)[1]
                        t_payload = verify_supabase_token(token)
                        supabase_user_id_from_token = t_payload.get("sub") or t_payload.get("user", {}).get("id")
                        token_email = t_payload.get("email") or t_payload.get("user_metadata", {}).get("email")
                        # Only if the token user matches the DB user being updated
                        if supabase_user_id_from_token and token_email and token_email.lower() == (old_email or '').lower():
                            pr = requests.put(
                                f"{supabase_url}/auth/v1/admin/users/{supabase_user_id_from_token}",
                                json={"email": new_email, "email_confirm": True},
                                headers=admin_headers,
                                timeout=10,
                            )
                            if not pr.ok:
                                # Detect email conflict (includes Postgres 23505 wrapped as 500)
                                conflict = False
                                try:
                                    j = pr.json()
                                    if str(j.get('code')) == '23505':
                                        conflict = True
                                    if isinstance(j, dict) and 'message' in j and 'duplicate key' in str(j['message']).lower():
                                        conflict = True
                                    if isinstance(j, dict) and 'detail' in j and 'already exists' in str(j['detail']).lower():
                                        conflict = True
                                except Exception:
                                    pass
                                if pr.status_code in (400, 409, 422) or conflict or ('duplicate key' in (pr.text or '').lower() or 'already exists' in (pr.text or '').lower()):
                                    raise HTTPException(status_code=400, detail="EMAIL_ALREADY_REGISTERED")
                                print(f"WARN: Supabase email update via token id failed: {pr.status_code} {pr.text}")
                            else:
                                # success via token id; skip lookup path
                                supabase_user_id_found_via_token = True
                        else:
                            supabase_user_id_found_via_token = False
                    else:
                        supabase_user_id_found_via_token = False
                except HTTPException:
                    # propagate validation/conflict to abort save
                    raise
                except Exception as e:
                    supabase_user_id_found_via_token = False
                    print(f"WARN: Failed to parse/verify token for Supabase id: {e}")

                # Find Supabase user; try old email, then new email; scan with pagination as fallback
                def find_user_id_by_email(email: str) -> str | None:
                    try:
                        base_url = f"{supabase_url}/auth/v1/admin/users"
                        # direct filter
                        r = requests.get(base_url, params={"email": email}, headers=admin_headers, timeout=10)
                        if r.ok:
                            arr = r.json() or []
                            if isinstance(arr, list) and arr:
                                return arr[0].get("id")
                        # paginated scan
                        page = 1
                        per_page = 200
                        for _ in range(5):  # scan up to 1000 users
                            r2 = requests.get(base_url, params={"page": page, "per_page": per_page}, headers=admin_headers, timeout=10)
                            if not r2.ok:
                                break
                            arr2 = r2.json() or []
                            if not isinstance(arr2, list) or not arr2:
                                break
                            for u in arr2:
                                if (u.get("email") or "").lower() == email.lower():
                                    return u.get("id")
                            if len(arr2) < per_page:
                                break
                            page += 1
                    except Exception:
                        return None
                    return None

                if not locals().get('supabase_user_id_found_via_token'):
                    supabase_user_id = find_user_id_by_email(old_email) or find_user_id_by_email(new_email)
                    if supabase_user_id:
                        patch_resp = requests.put(
                            f"{supabase_url}/auth/v1/admin/users/{supabase_user_id}",
                            json={"email": new_email, "email_confirm": True},
                            headers=admin_headers,
                            timeout=10,
                        )
                        if patch_resp.status_code >= 400:
                            conflict = False
                            try:
                                j2 = patch_resp.json()
                                if str(j2.get('code')) == '23505':
                                    conflict = True
                                if isinstance(j2, dict) and 'message' in j2 and 'duplicate key' in str(j2['message']).lower():
                                    conflict = True
                                if isinstance(j2, dict) and 'detail' in j2 and 'already exists' in str(j2['detail']).lower():
                                    conflict = True
                            except Exception:
                                pass
                            if patch_resp.status_code in (400, 409, 422) or conflict or ('duplicate key' in (patch_resp.text or '').lower() or 'already exists' in (patch_resp.text or '').lower()):
                                raise HTTPException(status_code=400, detail="EMAIL_ALREADY_REGISTERED")
                            print(f"WARN: Failed to update Supabase email: {patch_resp.status_code} {patch_resp.text}")

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