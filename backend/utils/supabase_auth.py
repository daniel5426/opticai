import requests
from fastapi import HTTPException
from config import settings as app_settings
from auth import verify_supabase_token
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import User

def update_supabase_auth_email(old_email: str, new_email: str, db: Session, request_auth_header: str = None, updating_user_id: int = None) -> bool:
    """Sync email change to Supabase Auth (admin)."""
    if not old_email or not new_email or old_email == new_email:
        return True

    # App-level uniqueness guard in our DB (case-insensitive)
    existing_email_user = (
        db.query(User)
        .filter(func.lower(User.email) == (new_email or '').lower())
        .first()
    )
    if existing_email_user and (updating_user_id is None or existing_email_user.id != updating_user_id):
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
    supabase_user_id_found_via_token = False
    if request_auth_header and request_auth_header.lower().startswith("bearer "):
        try:
            token = request_auth_header.split(" ", 1)[1]
            t_payload = verify_supabase_token(token)
            supabase_user_id_from_token = t_payload.get("sub") or t_payload.get("user", {}).get("id")
            token_email = t_payload.get("email") or t_payload.get("user_metadata", {}).get("email")
            
            # Only if the token user matches the user being updated (by email)
            if supabase_user_id_from_token and token_email and token_email.lower() == (old_email or '').lower():
                pr = requests.put(
                    f"{supabase_url}/auth/v1/admin/users/{supabase_user_id_from_token}",
                    json={"email": new_email, "email_confirm": True},
                    headers=admin_headers,
                    timeout=10,
                )
                if pr.ok:
                    supabase_user_id_found_via_token = True
                else:
                    # Detect email conflict
                    if pr.status_code in (400, 409, 422) or 'already exists' in (pr.text or '').lower() or 'duplicate key' in (pr.text or '').lower():
                        raise HTTPException(status_code=400, detail="EMAIL_ALREADY_REGISTERED")
                    print(f"WARN: Supabase email update via token id failed: {pr.status_code} {pr.text}")
        except HTTPException:
            raise
        except Exception as e:
            print(f"WARN: Failed to parse/verify token for Supabase id: {e}")

    if not supabase_user_id_found_via_token:
        # Find Supabase user by email
        def find_user_id_by_email(email: str) -> str | None:
            try:
                base_url = f"{supabase_url}/auth/v1/admin/users"
                r = requests.get(base_url, params={"email": email}, headers=admin_headers, timeout=10)
                if r.ok:
                    arr = r.json() or []
                    if isinstance(arr, list) and arr:
                        return arr[0].get("id")
                
                # Paginated scan fallback
                page = 1
                per_page = 200
                for _ in range(5):
                    r2 = requests.get(base_url, params={"page": page, "per_page": per_page}, headers=admin_headers, timeout=10)
                    if not r2.ok: break
                    arr2 = r2.json() or []
                    if not isinstance(arr2, list) or not arr2: break
                    for u in arr2:
                        if (u.get("email") or "").lower() == email.lower():
                            return u.get("id")
                    if len(arr2) < per_page: break
                    page += 1
            except Exception:
                return None
            return None

        supabase_user_id = find_user_id_by_email(old_email) or find_user_id_by_email(new_email)
        if supabase_user_id:
            patch_resp = requests.put(
                f"{supabase_url}/auth/v1/admin/users/{supabase_user_id}",
                json={"email": new_email, "email_confirm": True},
                headers=admin_headers,
                timeout=10,
            )
            if patch_resp.status_code >= 400:
                if patch_resp.status_code in (400, 409, 422) or 'already exists' in (patch_resp.text or '').lower() or 'duplicate key' in (patch_resp.text or '').lower():
                    raise HTTPException(status_code=400, detail="EMAIL_ALREADY_REGISTERED")
                print(f"WARN: Failed to update Supabase email: {patch_resp.status_code} {patch_resp.text}")
                return False
            return True
        else:
            print(f"WARN: Supabase user not found for email: {old_email}")
            return False
    
    return True
