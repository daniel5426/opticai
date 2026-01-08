from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import User, Clinic
from schemas import UserCreate, UserUpdate, User as UserSchema, UserPublic, UserSelectItem
from auth import get_current_user, get_password_hash
from models import User as UserModel
from utils.storage import upload_base64_image
from utils.supabase_auth import update_supabase_auth_email
from fastapi import Request


CEO_LEVEL = 4
MANAGER_LEVEL = 3
WORKER_LEVEL = 2

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/public", response_model=UserSchema)
def create_user_public(
    user: UserCreate,
    db: Session = Depends(get_db)
):

    # Prefer matching by email when provided; fallback to username
    existing: Optional[User] = None
    if user.email:
        existing = db.query(User).filter(User.email == user.email).first()
    if not existing:
        existing = db.query(User).filter(User.username == user.username).first()

    if existing:
        # If existing user is already linked to a company, block duplicate signup
        if existing.company_id is not None:
            # Keep original error semantics depending on what clashes
            if user.email and existing.email == user.email:
                print(f"DEBUG: Email already exists and linked to company: {user.email}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Email already exists"
                )
            print(f"DEBUG: Username already exists and linked to company: {user.username}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )

        # Existing user without company: continue setup by updating the record
        print(f"DEBUG: Continuing setup for existing user without company (id={existing.id})")
        update_payload = user.dict(exclude_unset=True)
        # Never override username when continuing by email/username match
        update_payload.pop('username', None)
        # Handle password hashing
        if 'password' in update_payload:
            pwd = update_payload.pop('password')
            existing.password = get_password_hash(pwd) if pwd else None
        # Handle profile picture upload
        if update_payload.get('profile_picture'):
            try:
                update_payload['profile_picture'] = upload_base64_image(update_payload['profile_picture'], f"users/public/profile")
            except Exception:
                update_payload.pop('profile_picture', None)
        for k, v in update_payload.items():
            setattr(existing, k, v)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Integrity error: duplicate field")
        db.refresh(existing)
        print(f"DEBUG: User updated and linked successfully (id={existing.id}, company_id={existing.company_id})")
        return existing

    # Create a fresh user
    print(f"DEBUG: Creating new user: {user.username}")
    hashed_password = get_password_hash(user.password) if user.password else None
    up = user.dict(exclude={'password'})
    if up.get('profile_picture'):
        try:
            up['profile_picture'] = upload_base64_image(up['profile_picture'], f"users/public/profile")
        except Exception:
            pass
    
    # Set auth_provider based on google_account_connected for new users
    if up.get('google_account_connected'):
        up['auth_provider'] = 'google'
    else:
        up['auth_provider'] = 'email'

    db_user = User(
        **up,
        password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    print(f"DEBUG: User created successfully with ID: {db_user.id}")
    return db_user

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
    
    if current_user.role_level == MANAGER_LEVEL and user.clinic_id != current_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only create users for your own clinic"
        )
    
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
    db_user = User(
        **up,
        password=hashed_password
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
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    from sqlalchemy import or_, and_
    
    if current_user.role_level >= CEO_LEVEL:
        # CEOs see only users in their company (including other CEOs)
        base = db.query(User).join(Clinic, isouter=True).filter(
            or_(User.company_id == current_user.company_id, Clinic.company_id == current_user.company_id)
        )
        if clinic_id:
            base = base.filter(User.clinic_id == clinic_id)
    elif current_user.role_level >= MANAGER_LEVEL:
        # Clinic managers see users in their clinic and CEOs from their company
        if current_user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
            # If they request a specific clinic, ensure it's THEIR clinic or they are allowed (managers usually only their own)
            target_clinic_id = clinic_id if clinic_id else current_user.clinic_id
            
            if target_clinic_id != current_user.clinic_id:
                 # Managers can only see their own clinic
                 base = db.query(User).filter(User.id == -1)
            elif clinic:
                base = db.query(User).filter(
                    or_(
                        User.clinic_id == current_user.clinic_id,
                        and_(User.role_level >= CEO_LEVEL, User.company_id == clinic.company_id)
                    )
                )
                if clinic_id: # Precise filtering if requested
                     base = base.filter(User.clinic_id == clinic_id)
            else:
                base = db.query(User).filter(User.clinic_id == current_user.clinic_id)
        else:
            base = db.query(User).filter(User.id == -1)  # Empty result
    else:
        # Regular clinic workers see users in their clinic and CEOs from their company
        if current_user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
            if clinic:
                base = db.query(User).filter(
                    or_(
                        User.clinic_id == current_user.clinic_id,
                        and_(User.role_level >= CEO_LEVEL, User.company_id == clinic.company_id)
                    )
                )
                if clinic_id:
                    base = base.filter(User.clinic_id == clinic_id)
            else:
                base = db.query(User).filter(User.clinic_id == current_user.clinic_id)
        else:
            base = db.query(User).filter(User.id == -1)  # Empty result
    
    # Apply search filtering
    if search:
        from sqlalchemy import or_
        like = f"%{search.strip()}%"
        base = base.filter(
            or_(
                User.full_name.ilike(like),
                User.username.ilike(like),
                User.email.ilike(like),
                User.phone.ilike(like),
            )
        )

    # Apply ordering
    if order == "id_asc":
        base = base.order_by(User.id.asc())
    elif order == "username_asc":
        base = base.order_by(User.username.asc())
    elif order == "username_desc":
        base = base.order_by(User.username.desc())
    elif order == "role_asc":
        base = base.order_by(User.role_level.asc())
    elif order == "role_desc":
        base = base.order_by(User.role_level.desc())
    else:  # default to id_desc
        base = base.order_by(User.id.desc())
    
    total = base.count()
    items = base.offset(offset).limit(limit).all()
    
    return {"items": items, "total": total}

@router.get("/", response_model=List[UserSchema])
def get_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.role_level >= CEO_LEVEL:
        # CEOs see only users in their company (including other CEOs)
        users = db.query(User).join(Clinic, isouter=True).filter(
            (User.company_id == current_user.company_id) | (Clinic.company_id == current_user.company_id)
        ).all()
    elif current_user.role_level >= MANAGER_LEVEL:
        # Clinic managers see users in their clinic and CEOs from their company
        if current_user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
            if clinic:
                users = db.query(User).filter(
                    (User.clinic_id == current_user.clinic_id) |
                    ((User.role_level >= CEO_LEVEL) & (User.company_id == clinic.company_id))
                ).all()
            else:
                users = db.query(User).filter(User.clinic_id == current_user.clinic_id).all()
        else:
            users = []
    else:
        # Regular clinic workers see users in their clinic and CEOs from their company
        if current_user.clinic_id:
            clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
            if clinic:
                users = db.query(User).filter(
                    (User.clinic_id == current_user.clinic_id) |
                    ((User.role_level >= CEO_LEVEL) & (User.company_id == clinic.company_id))
                ).all()
            else:
                users = db.query(User).filter(User.clinic_id == current_user.clinic_id).all()
        else:
            users = []
    return users

@router.get("/select", response_model=List[UserSelectItem])
def get_users_for_select(
    clinic_id: Optional[int] = Query(None, description="Filter by clinic id; defaults to current user's clinic scope"),
    include_ceo: bool = Query(True, description="Include company CEO if belongs to same company"),
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    # Determine base query according to role
    if current_user.role_level >= CEO_LEVEL:
        q = db.query(User).join(Clinic, isouter=True)
        if clinic_id:
            q = q.filter((User.clinic_id == clinic_id) | ((User.role_level >= CEO_LEVEL) & (User.company_id == current_user.company_id)))
        else:
            q = q.filter((User.company_id == current_user.company_id) | (User.company_id == current_user.company_id))
    elif current_user.role_level >= 1:
        if not current_user.clinic_id and not clinic_id:
            return []
        effective_clinic_id = clinic_id or current_user.clinic_id
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

@router.get("/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    print(f"DEBUG: User: {user.system_vacation_dates}")
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    if current_user.role_level < CEO_LEVEL and current_user.clinic_id != user.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return user

@router.get("/username/{username}", response_model=UserSchema)
def get_user_by_username(
    username: str,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    # Access allowed if same company or CEO
    if current_user.role_level < CEO_LEVEL and current_user.clinic_id != user.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return user

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
        "has_password": bool(user.password and user.password.strip()),
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
        "has_password": bool(user.password and user.password.strip()),
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
    
    # Check permissions
    if current_user.role_level >= CEO_LEVEL:
        if clinic.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role_level == MANAGER_LEVEL:
        if current_user.clinic_id != clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

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
            "has_password": bool(user.password and user.password.strip()),
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
    
    # Check permissions
    if current_user.role_level >= CEO_LEVEL:
        users = (
            db.query(User)
            .outerjoin(Clinic, User.clinic_id == Clinic.id)
            .filter((Clinic.company_id == company_id) | (User.company_id == company_id))
            .all()
        )
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return users

@router.put("/{user_id}", response_model=UserSchema)
def update_user(
    user_id: int,
    user: UserUpdate,
    request: Request,
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
    
    if current_user.role_level == MANAGER_LEVEL and current_user.clinic_id != db_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update users in your own clinic"
        )
    
    update_data = user.dict(exclude_unset=True)
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
    
    if "email" in update_data and update_data["email"] and update_data["email"] != db_user.email:
        new_email = update_data["email"]
        old_email = db_user.email
        
        # Sync email change to Supabase Auth
        auth_header = request.headers.get("authorization") or request.headers.get("Authorization")
        update_supabase_auth_email(old_email, new_email, db, auth_header, user_id)

    if "password" in update_data:
        if update_data["password"] is None:
            # Remove password (set to None)
            update_data["password"] = None
        else:
            # Hash the new password
            update_data["password"] = get_password_hash(update_data["password"])
    
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
    
    if current_user.role_level == MANAGER_LEVEL and current_user.clinic_id != db_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only delete users in your own clinic"
        )
    
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself"
        )
    
    db.delete(db_user)
    db.commit()
    return {"message": "User deleted successfully"} 