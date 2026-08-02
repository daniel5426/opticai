import os
import sys
from datetime import datetime
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

import EndPoints.appointments as appointments_endpoint
from models import Client, User
from schemas import AppointmentCreate


class _ClientQuery:
    def __init__(self, client):
        self.client = client

    def filter(self, *_args):
        return self

    def first(self):
        return self.client


class _SessionSpy:
    def __init__(self, client):
        self.client = client
        self.added = []
        self.flush_count = 0
        self.commit_count = 0
        self.refresh_count = 0

    def add(self, value):
        self.added.append(value)

    def flush(self):
        self.flush_count += 1
        self.added[0].id = 123

    def query(self, model):
        assert model is Client
        return _ClientQuery(self.client)

    def commit(self):
        self.commit_count += 1

    def refresh(self, _value):
        self.refresh_count += 1


def test_create_appointment_uses_one_commit_and_preserves_client_invalidation(monkeypatch):
    client = Client(id=7, clinic_id=3, ai_appointment_state="ready")
    db = _SessionSpy(client)
    current_user = User(id=4, username="examiner", role_level=2)
    payload = {
        "client_id": 7,
        "clinic_id": 3,
        "user_id": 4,
        "date": datetime(2026, 8, 2, 9, 0),
        "time": "09:00",
        "duration": 30,
        "exam_name": "Exam",
        "note": "",
    }

    monkeypatch.setattr(
        appointments_endpoint,
        "apply_clinic_user_scope",
        lambda _db, _user, _data: payload.copy(),
    )
    monkeypatch.setattr(
        appointments_endpoint,
        "normalize_user_id",
        lambda *_args: (_ for _ in ()).throw(AssertionError("duplicate user normalization")),
        raising=False,
    )
    monkeypatch.setattr(
        appointments_endpoint,
        "normalize_client_id",
        lambda *_args: (_ for _ in ()).throw(AssertionError("duplicate client normalization")),
        raising=False,
    )

    created = appointments_endpoint.create_appointment(
        AppointmentCreate(**payload),
        db,
        current_user,
    )

    assert created.id == 123
    assert db.flush_count == 1
    assert db.commit_count == 1
    assert db.refresh_count == 1
    assert client.ai_appointment_state is None
