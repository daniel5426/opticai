from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from database import get_db
from models import User, Clinic
from schemas import UserCreate, UserUpdate, User as UserSchema, UserPublic
from auth import get_current_user, get_password_hash
from models import User as UserModel

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/public", response_model=UserSchema)
def create_user_public(
    user: UserCreate,
    db: Session = Depends(get_db)
):
    """Public endpoint for creating users during registration"""
    # Check if username already exists
    existing_user = db.query(User).filter(User.username == user.username).first()
    if existing_user:
        print(f"DEBUG: Username already exists: {user.username}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    if user.email:
        existing_email_user = db.query(User).filter(User.email == user.email).first()
        if existing_email_user:
            print(f"DEBUG: Email already exists: {user.email}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already exists"
            )
    
    print(f"DEBUG: Creating new user: {user.username}")
    hashed_password = get_password_hash(user.password) if user.password else None
    db_user = User(
        **user.dict(exclude={'password'}),
        password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    print(f"DEBUG: User created successfully with ID: {db_user.id}")
    return db_user

@router.post("/", response_model=UserSchema)
def create_user(
    user: UserCreate,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.role not in ["company_ceo", "clinic_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to create users"
        )
    
    if current_user.role == "clinic_manager" and user.clinic_id != current_user.clinic_id:
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
    db_user = User(
        **user.dict(exclude={'password'}),
        password=hashed_password
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@router.get("/", response_model=List[UserSchema])
def get_users(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.role == "company_ceo":
        # CEOs see only users in their company (including other CEOs)
        users = db.query(User).join(Clinic, isouter=True).filter(
            (User.company_id == current_user.company_id) | (Clinic.company_id == current_user.company_id)
        ).all()
    else:
        users = db.query(User).filter(User.clinic_id == current_user.clinic_id).all()
    return users

@router.get("/{user_id}", response_model=UserSchema)
def get_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    if current_user.role != "company_ceo" and current_user.clinic_id != user.clinic_id:
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
    if current_user.role != "company_ceo" and current_user.clinic_id != user.clinic_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return user

@router.get("/username/{username}/public", response_model=UserSchema)
def get_user_by_username_public(
    username: str,
    db: Session = Depends(get_db)
):
    """Public endpoint to get user by username (for login without password)"""
    user = db.query(User).filter(User.username == username).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@router.get("/email/{email}/public", response_model=UserSchema)
def get_user_by_email_public(
    email: str,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    return user

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
    if current_user.role == "company_ceo":
        if clinic.company_id != current_user.company_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif current_user.role == "clinic_manager":
        if current_user.clinic_id != clinic_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    users = db.query(User).filter(
        (User.clinic_id == clinic_id)
        | ((User.role == "company_ceo") & (User.company_id == clinic.company_id))
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
    
    # Get all users for this clinic (including CEOs)
    users = db.query(User).filter(
        (User.clinic_id == clinic_id) | (User.role == "company_ceo")
    ).all()
    
    # Convert to UserPublic schema with has_password field
    public_users = []
    for user in users:
        user_dict = {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "is_active": user.is_active,
            "profile_picture": user.profile_picture,
            "primary_theme_color": user.primary_theme_color,
            "secondary_theme_color": user.secondary_theme_color,
            "theme_preference": user.theme_preference,
            "google_account_connected": user.google_account_connected,
            "google_account_email": user.google_account_email,
            "clinic_id": user.clinic_id,
            "has_password": bool(user.password and user.password.strip()),
            "created_at": user.created_at,
            "updated_at": user.updated_at
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
    if current_user.role == "company_ceo":
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
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    if current_user.role not in ["company_ceo", "clinic_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to update users"
        )
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    if current_user.role == "clinic_manager" and current_user.clinic_id != db_user.clinic_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Can only update users in your own clinic"
        )
    
    update_data = user.dict(exclude_unset=True)

    # Validate unique fields if they are being changed
    if "username" in update_data and update_data["username"] and update_data["username"] != db_user.username:
        existing_user = db.query(User).filter(User.username == update_data["username"]).first()
        if existing_user and existing_user.id != db_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username already exists")
    if "email" in update_data and update_data["email"] and update_data["email"] != db_user.email:
        existing_email_user = db.query(User).filter(User.email == update_data["email"]).first()
        if existing_email_user and existing_email_user.id != db_user.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already exists")
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
    if current_user.role not in ["company_ceo", "clinic_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions to delete users"
        )
    
    db_user = db.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(status_code=404, detail="User not found")
    
    if current_user.role == "clinic_manager" and current_user.clinic_id != db_user.clinic_id:
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