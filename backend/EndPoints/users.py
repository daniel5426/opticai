from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import User, Clinic
from schemas import UserCreate, UserUpdate, User as UserSchema, UserPublic, UserSelectItem
from auth import decrypt_secret, encrypt_secret, get_current_user, get_password_hash
from models import User as UserModel
from utils.storage import upload_base64_image
from utils.date_search import DateSearchHelper
from security.scope import (
    assert_clinic_belongs_to_company,
    get_allowed_clinic_ids,
    get_visible_user,
    require_company_admin,
    resolve_company_id,
    user_belongs_to_company,
)


CEO_LEVEL = 4
MANAGER_LEVEL = 3
WORKER_LEVEL = 2

router = APIRouter(prefix="/users", tags=["users"])


def _normalize_google_token_update(update_data: dict) -> None:
    if update_data.get("google_account_connected") is False:
        update_data["google_access_token"] = None
        update_data["google_refresh_token"] = None
        update_data["google_account_email"] = None
        return
    if "google_access_token" in update_data:
        update_data["google_access_token"] = encrypt_secret(update_data["google_access_token"])
    if "google_refresh_token" in update_data:
        update_data["google_refresh_token"] = encrypt_secret(update_data["google_refresh_token"])


def _company_users_query(db: Session, company_id: int):
    return (
        db.query(User)
        .outerjoin(Clinic, User.clinic_id == Clinic.id)
        .filter(or_(User.company_id == company_id, Clinic.company_id == company_id))
    )


def _visible_users_query(db: Session, current_user: UserModel):
    company_id = resolve_company_id(db, current_user)
    if current_user.role_level >= CEO_LEVEL:
        return _company_users_query(db, company_id)
    if not current_user.clinic_id:
        return db.query(User).filter(User.id == -1)
    return db.query(User).filter(
        or_(
            User.clinic_id == current_user.clinic_id,
            and_(User.role_level >= CEO_LEVEL, User.company_id == company_id),
        )
    )


def _assert_user_manageable(db: Session, current_user: UserModel, target: User) -> None:
    company_id = resolve_company_id(db, current_user)
    if not user_belongs_to_company(db, target, company_id):
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user.role_level >= CEO_LEVEL:
        return
    if current_user.role_level >= MANAGER_LEVEL and target.clinic_id == current_user.clinic_id:
        return
    raise HTTPException(status_code=403, detail="Access denied")


def _validate_user_update_scope(db: Session, current_user: UserModel, update_data: dict) -> None:
    company_id = resolve_company_id(db, current_user)
    if current_user.role_level < CEO_LEVEL:
        if "company_id" in update_data:
            raise HTTPException(status_code=403, detail="Access denied")
        if "role_level" in update_data and (update_data["role_level"] or 1) >= CEO_LEVEL:
            raise HTTPException(status_code=403, detail="Access denied")
        if "clinic_id" in update_data and update_data["clinic_id"] != current_user.clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        if "company_id" in update_data and update_data["company_id"] != company_id:
            raise HTTPException(status_code=403, detail="Access denied")
        if update_data.get("clinic_id") is not None:
            assert_clinic_belongs_to_company(db, update_data["clinic_id"], company_id)

@router.post("/public", response_model=UserSchema)
def create_user_public(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Legacy public user creation is disabled; use /auth/register/start and /auth/register/complete",
    )

@router.post("/link-company", response_model=UserSchema)
def link_company(
    company_id: int = Body(...),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.company_id is not None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already linked to a company")
    db_user = db.query(User).filter(User.id == current_user.id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    db_user.company_id = company_id
    if not getattr(db_user, "role_level", None) or db_user.role_level < CEO_LEVEL:
        db_user.role_level = CEO_LEVEL
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Integrity error")
    db.refresh(db_user)
    return db_user

@router.post("/", response_model=UserSchema)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.role_level < MANAGER_LEVEL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create users"
        )
    
    company_id = resolve_company_id(db, current_user)
    if user.company_id != company_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    if user.clinic_id is not None:
        assert_clinic_belongs_to_company(db, user.clinic_id, company_id)
    if current_user.role_level == MANAGER_LEVEL and user.clinic_id != current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only create users for your own clinic"
        )
    if current_user.role_level < CEO_LEVEL and user.role_level >= CEO_LEVEL:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")
    
    existing_user = db.query(User).filter(User.username == user.username).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    if user.email:
        existing_email_user = db.query(User).filter(User.email == user.email).first()
        if existing_email_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
    
    hashed_password = get_password_hash(user.password) if user.password else None
    up = user.dict(exclude={'password'})
    if up.get('profile_picture'):
        try:
            up['profile_picture'] = upload_base64_image(up['profile_picture'], f"users/profile")
        except Exception:
            pass
    _normalize_google_token_update(up)
    db_user = User(
        **up,
        password_hash=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/paginated")
def get_users_paginated(
    limit: int = Query(25, ge=1, le=100, description="Max items to return"),
    offset: int = Query(0, ge=0, description="Items to skip"),
    order: Optional[str] = Query("id_desc", description="Sort order: id_desc|id_asc|username_asc|username_desc|role_asc|role_desc"),
    search: Optional[str] = Query(None, description="Search by name/email/phone/username"),
    clinic_id: Optional[int] = Query(None, description="Filter by clinic ID"),
    role_level: Optional[int] = Query(None, description="Filter by role level"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    from sqlalchemy import func
    
    base = _visible_users_query(db, current_user)
    if clinic_id:
        get_allowed_clinic_ids(db, current_user, clinic_id)
        base = base.filter(User.clinic_id == clinic_id)
    
    # Apply search filtering
    if search:
        like = f"%{search.strip()}%"
        date_search_conditions = [
            *DateSearchHelper.build_date_search_conditions(User.created_at, search),
            *DateSearchHelper.build_date_search_conditions(User.updated_at, search),
        ]
        base = base.filter(
            or_(
                User.full_name.ilike(like),
                User.username.ilike(like),
                User.email.ilike(like),
                User.phone.ilike(like),
                *date_search_conditions,
            )
        )
    if role_level is not None:
        base = base.filter(User.role_level == role_level)

    order_columns = {
        "id": User.id,
        "name": func.coalesce(User.full_name, User.username),
        "username": User.username,
        "role": User.role_level,
        "email": User.email,
        "phone": User.phone,
        "clinic": User.clinic_id,
        "status": User.is_active,
    }
    order_key, _, order_direction = (order or "id_desc").rpartition("_")
    order_column = order_columns.get(order_key, User.id)
    if order_direction == "asc":
        base = base.order_by(order_column.asc().nulls_last(), User.id.asc())
    else:
        base = base.order_by(order_column.desc().nulls_last(), User.id.desc())
    
    total = base.count()
    items = base.offset(offset).limit(limit).all()
    
    return {"items": items, "total": total}

@router.get("/", response_model=List[UserSchema])
def get_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    return _visible_users_query(db, current_user).all()

@router.get("/select", response_model=List[UserSelectItem])
def get_users_for_select(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic id; defaults to current user's clinic scope"),
    include_ceo: bool = Query(True, description="Include company CEO if belongs to same company"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    company_id = resolve_company_id(db, current_user)
    if current_user.role_level >= CEO_LEVEL:
        q = _company_users_query(db, company_id)
        if clinic_id:
            get_allowed_clinic_ids(db, current_user, clinic_id)
            q = q.filter((User.clinic_id == clinic_id) | ((User.role_level >= CEO_LEVEL) & (User.company_id == company_id)))
        else:
            q = q.filter(or_(User.company_id == company_id, Clinic.company_id == company_id))
    elif current_user.role_level >= 1:
        if not current_user.clinic_id and not clinic_id:
            return []
        effective_clinic_id = clinic_id or current_user.clinic_id
        get_allowed_clinic_ids(db, current_user, effective_clinic_id)
        clinic = db.query(Clinic).filter(Clinic.id == effective_clinic_id).first()
        if not clinic:
            return []
        q = db.query(User).filter(User.clinic_id == effective_clinic_id)
        if include_ceo:
            q = q.union_all(
                db.query(User).filter(
                    (User.role_level >= CEO_LEVEL) & (User.company_id == clinic.company_id)
                )
            )
    else:
        return []

    users = q.all()
    result: List[UserSelectItem] = []
    for u in users:
        result.append(UserSelectItem(
            id=u.id,
            full_name=u.full_name,
            username=u.username,
            role_level=u.role_level,
            clinic_id=u.clinic_id,
            email=u.email,
            phone=u.phone,
            auth_provider=u.auth_provider,
            is_active=u.is_active
        ))
    return result

@router.get("/{user_id}/google-tokens")
def get_user_google_tokens(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "connected": bool(user.google_account_connected),
        "email": user.google_account_email,
        "access_token": decrypt_secret(user.google_access_token) if user.google_account_connected else None,
        "refresh_token": decrypt_secret(user.google_refresh_token) if user.google_account_connected else None,
    }

@router.get("/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    return get_visible_user(db, current_user, user_id)

@router.get("/username/{username}", response_model=UserSchema)
def get_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return get_visible_user(db, current_user, user.id)

@router.get("/username/{username}/public", response_model=UserPublic)
def get_user_by_username_public(
    username: str,
    db: Session = Depends(get_db)
):
    """Public endpoint to get user by username (for login without password)"""
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user_dict = {
        "id": user.id,
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "role_level": user.role_level,
        "is_active": user.is_active,
        "profile_picture": user.profile_picture,
        "primary_theme_color": user.primary_theme_color,
        "secondary_theme_color": user.secondary_theme_color,
        "theme_preference": user.theme_preference,
        "google_account_connected": user.google_account_connected,
        "google_account_email": user.google_account_email,
        "clinic_id": user.clinic_id,
        "system_vacation_dates": user.system_vacation_dates,
        "added_vacation_dates": user.added_vacation_dates,
        "va_format": user.va_format,
        "auth_provider": user.auth_provider,
        "has_password": bool(user.password_hash and user.password_hash.strip()),
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "company_id": user.company_id,
    }
    return UserPublic(**user_dict)

@router.get("/email/{email}/public", response_model=UserPublic)
def get_user_by_email_public(
    email: str,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    user_dict = {
        "id": user.id,
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "role_level": user.role_level,
        "is_active": user.is_active,
        "profile_picture": user.profile_picture,
        "primary_theme_color": user.primary_theme_color,
        "secondary_theme_color": user.secondary_theme_color,
        "theme_preference": user.theme_preference,
        "google_account_connected": user.google_account_connected,
        "google_account_email": user.google_account_email,
        "clinic_id": user.clinic_id,
        "system_vacation_dates": user.system_vacation_dates,
        "added_vacation_dates": user.added_vacation_dates,
        "va_format": user.va_format,
        "auth_provider": user.auth_provider,
        "has_password": bool(user.password_hash and user.password_hash.strip()),
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "company_id": user.company_id,
    }
    return UserPublic(**user_dict)

@router.get("/clinic/{clinic_id}", response_model=List[UserSchema])
def get_users_by_clinic(
    clinic_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all users for a specific clinic, including CEO users"""
    # Check if clinic exists
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    get_allowed_clinic_ids(db, current_user, clinic_id)

    users = db.query(User).filter(
        (User.clinic_id == clinic_id)
        | ((User.role_level >= CEO_LEVEL) & (User.company_id == clinic.company_id))
    ).all()

    return users

@router.get("/clinic/{clinic_id}/public", response_model=List[UserPublic])
def get_users_by_clinic_public(
    clinic_id: int,
    db: Session = Depends(get_db)
):
    """Public endpoint to get all users for a specific clinic (for user selection)"""
    # Check if clinic exists
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    # Get users for this clinic and CEOs belonging to the same company
    users = db.query(User).filter(
        (User.clinic_id == clinic_id)
        | ((User.role_level >= CEO_LEVEL) & (User.company_id == clinic.company_id))
    ).all()
    
    # Convert to UserPublic schema with has_password field
    public_users = []
    for user in users:
        user_dict = {
            "id": user.id,
            "full_name": user.full_name,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "role_level": user.role_level,
            "is_active": user.is_active,
            "profile_picture": user.profile_picture,
            "primary_theme_color": user.primary_theme_color,
            "secondary_theme_color": user.secondary_theme_color,
            "theme_preference": user.theme_preference,
            "google_account_connected": user.google_account_connected,
            "google_account_email": user.google_account_email,
            "clinic_id": user.clinic_id,
            "system_vacation_dates": user.system_vacation_dates,
            "added_vacation_dates": user.added_vacation_dates,
            "va_format": user.va_format,
            "auth_provider": user.auth_provider,
            "has_password": bool(user.password_hash and user.password_hash.strip()),
            "created_at": user.created_at,
            "updated_at": user.updated_at,
            "company_id": user.company_id
        }
        public_users.append(UserPublic(**user_dict))
    
    return public_users

@router.get("/company/{company_id}", response_model=List[UserSchema])
def get_users_by_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    """Get all users for a specific company"""
    # Check if company exists
    from models import Company
    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    require_company_admin(db, current_user, company_id)
    users = _company_users_query(db, company_id).all()
    
    return users

@router.put("/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    user: UserUpdate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.role_level < MANAGER_LEVEL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update users"
        )
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    _assert_user_manageable(db, current_user, db_user)
    
    update_data = user.dict(exclude_unset=True)
    _validate_user_update_scope(db, current_user, update_data)
    if update_data.get('profile_picture'):
        try:
            update_data['profile_picture'] = upload_base64_image(update_data['profile_picture'], f"users/{user_id}/profile")
        except Exception:
            pass

    # Validate unique fields if they are being changed
    if "username" in update_data and update_data["username"] and update_data["username"] != db_user.username:
        existing_user = db.query(User).filter(User.username == update_data["username"]).first()
        if existing_user and existing_user.id != db_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
    
    if "password" in update_data:
        if update_data["password"] is None:
            update_data["password_hash"] = None
        else:
            update_data["password_hash"] = get_password_hash(update_data["password"])
        update_data.pop("password", None)
    _normalize_google_token_update(update_data)
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    try:
        db.commit()
    except IntegrityError as e:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Integrity error: duplicate field")
    db.refresh(db_user)
    return db_user

@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.role_level < MANAGER_LEVEL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete users"
        )
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    _assert_user_manageable(db, current_user, db_user)
    
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"} 
