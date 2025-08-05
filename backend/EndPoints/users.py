from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
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
    
    print(f"DEBUG: Creating new user: {user.username}")
    hashed_password = get_password_hash(user.password)
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
    
    hashed_password = get_password_hash(user.password)
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
        users = db.query(User).all()
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
        # CEO can see all users in any clinic plus other CEOs
        users = db.query(User).filter(
            (User.clinic_id == clinic_id) | (User.role == "company_ceo")
        ).all()
    elif current_user.role == "clinic_manager" and current_user.clinic_id == clinic_id:
        # Clinic manager can see users in their own clinic plus CEOs
        users = db.query(User).filter(
            (User.clinic_id == clinic_id) | (User.role == "company_ceo")
        ).all()
    else:
        raise HTTPException(status_code=403, detail="Access denied")
    
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
        # CEO can see all users in their company
        users = db.query(User).join(Clinic).filter(Clinic.company_id == company_id).all()
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
    if "password" in update_data:
        update_data["password"] = get_password_hash(update_data["password"])
    
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
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