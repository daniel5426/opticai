from fastapi import Depends, HTTPException
from sqlalchemy.orm import Session
from auth import get_current_user
from database import get_db
from models import Clinic, User
from services.subscription_service import require_module


def ai_access(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_module(db, user.company_id, "ai")


def campaign_access(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    require_module(db, user.company_id, "campaigns")


def campaign_delivery(db, clinic_id, actor_user_id=None):
    clinic = db.query(Clinic).filter_by(id=clinic_id).populate_existing().first()
    if not clinic or not clinic.is_active:
        raise HTTPException(403, detail={"code": "clinic_inactive"})
    if actor_user_id is not None:
        actor = db.query(User).filter_by(id=actor_user_id).populate_existing().first()
        if not actor or not actor.is_active or actor.company_id != clinic.company_id:
            raise HTTPException(403, detail={"code": "account_inactive"})
    require_module(db, clinic.company_id, "campaigns")
    return clinic.company_id
