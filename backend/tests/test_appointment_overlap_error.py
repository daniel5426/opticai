import os
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

from models import Appointment, Client, User
from services.appointment_schedule import overlap_error


class _Session:
    def __init__(self, *rows):
        self.rows = {(type(row), row.id): row for row in rows}

    def get(self, model, row_id):
        return self.rows.get((model, row_id))


def test_overlap_error_names_the_booked_appointment():
    conflict = Appointment(id=9, client_id=5, user_id=2, time="09:30", duration=45)
    db = _Session(Client(id=5, first_name="נועה", last_name="לוי"), User(id=2, full_name="ישראל ישראלי"))

    error = overlap_error(db, conflict)

    assert error.status_code == 409
    assert error.detail == {
        "code": "agent.slotUnavailable",
        "conflict": {"id": 9, "time": "09:30", "end_time": "10:15", "client_name": "נועה לוי", "user_name": "ישראל ישראלי"},
    }
