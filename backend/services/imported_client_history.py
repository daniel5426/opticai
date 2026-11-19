"""OpticPlus profile history is reference data, not a clinical encounter."""
from sqlalchemy import and_, or_
from models import OpticalExam


def clinical_exam_filter(*, include_softoptic_order_visits=False):
    # Reserved importer name; keep NULL names and every other clinical exam.
    clinical = or_(OpticalExam.test_name.is_(None), OpticalExam.test_name != 'opticplus.exam.history')
    if include_softoptic_order_visits:
        return clinical
    return and_(clinical, or_(OpticalExam.type.is_(None), OpticalExam.type != "softoptic_contact_order"))
