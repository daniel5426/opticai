"""OpticPlus profile history is reference data, not a clinical encounter."""
from sqlalchemy import or_
from models import OpticalExam


def clinical_exam_filter():
    # Reserved importer name; keep NULL names and every other clinical exam.
    return or_(OpticalExam.test_name.is_(None), OpticalExam.test_name != 'opticplus.exam.history')
