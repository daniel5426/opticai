from sqlalchemy.orm import Session

try:
    from backend.models import Clinic, LookupVADecimal, LookupVAMeter
except ModuleNotFoundError:
    from models import Clinic, LookupVADecimal, LookupVAMeter


VA_METER_VALUES = [
    "6/190", "6/150", "6/120", "6/96", "6/75", "6/60", "6/48", "6/38",
    "6/30", "6/24", "6/18", "6/15", "6/12", "6/9", "6/7.5", "6/6",
    "6/4.5", "6/3",
]

VA_DECIMAL_VALUES = [
    "-0.3", "-0.2", "-0.1", "0.0", "0.1", "0.2", "0.3", "0.4",
    "0.5", "0.6", "0.7", "0.8", "0.9", "1.0", "1.1", "1.2",
    "1.3", "1.4", "1.5",
]


def _seed_values(db: Session, model, clinic_id: int, values: list[str]) -> None:
    existing = {
        row[0]
        for row in db.query(model.name)
        .filter(model.clinic_id == clinic_id)
        .filter(model.name.in_(values))
        .all()
    }
    for value in values:
        if value not in existing:
            db.add(model(clinic_id=clinic_id, name=value))


def seed_default_lookup_values_for_clinic(db: Session, clinic_id: int) -> None:
    _seed_values(db, LookupVAMeter, clinic_id, VA_METER_VALUES)
    _seed_values(db, LookupVADecimal, clinic_id, VA_DECIMAL_VALUES)


def seed_default_lookup_values_for_all_clinics(db: Session) -> None:
    clinic_ids = [row[0] for row in db.query(Clinic.id).all()]
    for clinic_id in clinic_ids:
        seed_default_lookup_values_for_clinic(db, clinic_id)
