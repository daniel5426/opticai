from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Company, Clinic
from sqlalchemy.exc import IntegrityError
from schemas import CompanyCreate, CompanyUpdate, Company as CompanySchema
from auth import get_current_user
from models import User
from utils.storage import upload_base64_image
from security.scope import assert_company_access, require_company_admin, resolve_company_id


CEO_LEVEL = 4

router = APIRouter(prefix="/companies", tags=["companies"])

@router.get("/public", response_model=List[CompanySchema])
def get_companies_public(db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Legacy public company lookup is disabled",
    )

@router.post("/public", response_model=CompanySchema)
def create_company_public(
    company: CompanyCreate,
    db: Session = Depends(get_db)
):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Legacy public company creation is disabled; use /auth/register/start and /auth/register/complete",
    )

@router.post("/", response_model=CompanySchema)
def create_company(data: CompanyCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    raise HTTPException(
        status_code=status.HTTP_410_GONE,
        detail="Authenticated company creation is disabled; use registration setup",
    )

@router.get("/", response_model=List[CompanySchema])
def get_companies(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    company_id = resolve_company_id(db, current_user)
    return db.query(Company).filter(Company.id == company_id).all()

@router.get("/{company_id}", response_model=CompanySchema)
def get_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    company = db.query(Company).filter(Company.id == company_id).first()
    if company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    assert_company_access(db, current_user, company_id)
    return company

@router.put("/{company_id}", response_model=CompanySchema)
def update_company(
    company_id: int,
    company: CompanyUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_company_admin(db, current_user, company_id)
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if db_company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    update_fields = company.dict(exclude_unset=True)
    if update_fields.get('logo_path'):
        try:
            update_fields['logo_path'] = upload_base64_image(update_fields['logo_path'], f"companies/{company_id}")
        except Exception:
            pass
    for field, value in update_fields.items():
        setattr(db_company, field, value)
    
    db.commit()
    db.refresh(db_company)
    return db_company

@router.delete("/{company_id}")
def delete_company(
    company_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    require_company_admin(db, current_user, company_id)
    db_company = db.query(Company).filter(Company.id == company_id).first()
    if db_company is None:
        raise HTTPException(status_code=404, detail="Company not found")
    
    db.delete(db_company)
    db.commit()
    return {"message": "Company deleted successfully"}
