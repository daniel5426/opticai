from sqlalchemy.orm import Session

from services.lookup_defaults import seed_default_lookup_values_for_all_clinics

def seed_va_values(db: Session):
    seed_default_lookup_values_for_all_clinics(db)
    db.commit()
