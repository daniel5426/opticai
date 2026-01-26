from sqlalchemy.orm import Session
from models import LookupVAMeter, LookupVADecimal

VA_METER_VALUES = [
    '6/190', '6/150', '6/120', '6/96', '6/75', '6/60', '6/48', '6/38',
    '6/30', '6/24', '6/18', '6/15', '6/12', '6/9', '6/7.5', '6/6',
    '6/4.5', '6/3'
]

VA_DECIMAL_VALUES = [
    '-0.3', '-0.2', '-0.1', '0.0', '0.1', '0.2', '0.3', '0.4',
    '0.5', '0.6', '0.7', '0.8', '0.9', '1.0', '1.1', '1.2',
    '1.3', '1.4', '1.5'
]

def seed_va_values(db: Session):
    # Seed VA Meter values if empty
    if db.query(LookupVAMeter).count() == 0:
        for value in VA_METER_VALUES:
            db.add(LookupVAMeter(name=value))
        db.commit()
        print("Seeded LookupVAMeter with default values.")

    # Seed VA Decimal values if empty
    if db.query(LookupVADecimal).count() == 0:
        for value in VA_DECIMAL_VALUES:
            db.add(LookupVADecimal(name=value))
        db.commit()
        print("Seeded LookupVADecimal with default values.")
