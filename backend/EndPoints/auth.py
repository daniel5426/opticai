from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import User
from auth import get_current_user
from jose import jwt
from datetime import datetime, timedelta
from config import settings
from pydantic import BaseModel

router = APIRouter(prefix="/auth", tags=["authentication"])

class PasswordlessLoginRequest(BaseModel):
    username: str

@router.post("/login-no-password")
async def login_no_password(
    request: PasswordlessLoginRequest,
    db: Session = Depends(get_db)
):
    """Login endpoint for users without passwords"""
    # Find user by username
    user = db.query(User).filter(User.username == request.username).first()
    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or user not active"
        )
    
    # Check if user has no password (passwordless user)
    if user.password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This user requires a password. Please use regular login."
        )
    
    # Create a simple JWT token for the passwordless user
    # We'll use the same format as Supabase JWT but with our own signature
    payload = {
        "email": user.email or f"{user.username}@clinic.local",
        "username": user.username,
        "user_id": str(user.id),
        "iat": datetime.utcnow(),
        "exp": datetime.utcnow() + timedelta(hours=24),
        "aud": "authenticated",
        "role": "authenticated"
    }
    
    # Use Supabase JWT secret to sign the token so it's compatible with our auth system
    secret = settings.SUPABASE_JWT_SECRET or settings.SUPABASE_KEY
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authentication configuration error"
        )
    
    access_token = jwt.encode(payload, secret, algorithm="HS256")
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user
    }

@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user