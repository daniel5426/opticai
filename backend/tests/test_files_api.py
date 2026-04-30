import os

from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")
os.environ.setdefault("TOKEN_ENCRYPTION_KEY", "development-encryption-key-for-tests")

import EndPoints.files as files_endpoint
from database import Base, get_db
from models import Client, Clinic, Company, File, User


DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


class FakeStorage:
    def __init__(self):
        self.uploads = []
        self.removes = []
        self.fail_remove = False

    def upload(self, bucket, key, data, content_type):
        self.uploads.append((bucket, key, data, content_type))

    def remove(self, bucket, key):
        if self.fail_remove:
            raise HTTPException(status_code=502, detail="remove failed")
        self.removes.append((bucket, key))

    def create_signed_url(self, bucket, key, expires_in=3600):
        return f"https://signed.example/{bucket}/{key}?ttl={expires_in}"


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal


def _seed(db):
    company_a = Company(name="A", owner_full_name="Owner A")
    company_b = Company(name="B", owner_full_name="Owner B")
    db.add_all([company_a, company_b])
    db.flush()

    clinic_a = Clinic(company_id=company_a.id, name="Clinic A", unique_id="clinic-a")
    clinic_b = Clinic(company_id=company_b.id, name="Clinic B", unique_id="clinic-b")
    db.add_all([clinic_a, clinic_b])
    db.flush()

    user_a = User(company_id=company_a.id, clinic_id=clinic_a.id, username="user-a", role_level=2, is_active=True)
    user_b = User(company_id=company_b.id, clinic_id=clinic_b.id, username="user-b", role_level=2, is_active=True)
    client_a = Client(company_id=company_a.id, clinic_id=clinic_a.id, first_name="Client", last_name="A")
    client_b = Client(company_id=company_b.id, clinic_id=clinic_b.id, first_name="Client", last_name="B")
    db.add_all([user_a, user_b, client_a, client_b])
    db.flush()

    file_a = File(
        client_id=client_a.id,
        clinic_id=clinic_a.id,
        file_name="old.pdf",
        original_file_name="old.pdf",
        storage_bucket="opticai",
        storage_key="clinics/1/clients/1/files/existing.pdf",
        file_size=3,
        file_type="application/pdf",
        uploaded_by=user_a.id,
        notes="",
    )
    db.add(file_a)
    db.commit()
    return {
        "user_a": user_a.id,
        "user_b": user_b.id,
        "client_a": client_a.id,
        "client_b": client_b.id,
        "clinic_b": clinic_b.id,
        "file_a": file_a.id,
    }


def _client(SessionLocal, current_user_id, storage):
    app = FastAPI()
    app.include_router(files_endpoint.router, prefix="/api/v1")

    def override_get_db():
        session = SessionLocal()
        try:
            yield session
        finally:
            session.close()

    def override_current_user():
        session = SessionLocal()
        try:
            return session.query(User).filter(User.id == current_user_id).one()
        finally:
            session.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[files_endpoint.get_current_user] = override_current_user
    app.dependency_overrides[files_endpoint.get_file_storage_service] = lambda: storage
    return TestClient(app)


def test_upload_derives_scope_and_uses_ascii_storage_key():
    SessionLocal = _session_factory()
    storage = FakeStorage()
    with SessionLocal() as db:
        ids = _seed(db)

    with _client(SessionLocal, ids["user_a"], storage) as client:
        response = client.post(
            "/api/v1/files/",
            data={
                "client_id": str(ids["client_a"]),
                "clinic_id": str(ids["clinic_b"]),
                "uploaded_by": str(ids["user_b"]),
                "notes": "note",
            },
            files={"upload": ("הזמנה רגילה מלכה כהן.docx", b"docx-bytes", DOCX_MIME)},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["client_id"] == ids["client_a"]
    assert payload["uploaded_by"] == ids["user_a"]
    assert payload["file_name"] == "הזמנה רגילה מלכה כהן.docx"
    assert payload["original_file_name"] == "הזמנה רגילה מלכה כהן.docx"
    assert "file_path" not in payload
    assert "storage_key" not in payload
    assert storage.uploads
    bucket, key, data, content_type = storage.uploads[0]
    assert bucket == "opticai"
    assert key.startswith(f"clinics/{payload['clinic_id']}/clients/{ids['client_a']}/files/")
    assert key.endswith(".docx")
    assert key.encode("ascii")
    assert data == b"docx-bytes"
    assert content_type == DOCX_MIME


def test_cross_company_file_routes_are_forbidden():
    SessionLocal = _session_factory()
    storage = FakeStorage()
    with SessionLocal() as db:
        ids = _seed(db)

    with _client(SessionLocal, ids["user_b"], storage) as client:
        assert client.get(f"/api/v1/files/{ids['file_a']}").status_code == 403
        assert client.patch(f"/api/v1/files/{ids['file_a']}", json={"file_name": "x.pdf"}).status_code == 403
        assert client.get(f"/api/v1/files/{ids['file_a']}/download-url").status_code == 403
        assert client.delete(f"/api/v1/files/{ids['file_a']}").status_code == 403


def test_rename_updates_display_name_only():
    SessionLocal = _session_factory()
    storage = FakeStorage()
    with SessionLocal() as db:
        ids = _seed(db)
        original_key = db.query(File).filter(File.id == ids["file_a"]).one().storage_key

    with _client(SessionLocal, ids["user_a"], storage) as client:
        response = client.patch(f"/api/v1/files/{ids['file_a']}", json={"file_name": "renamed.pdf"})

    assert response.status_code == 200
    with SessionLocal() as db:
        row = db.query(File).filter(File.id == ids["file_a"]).one()
        assert row.file_name == "renamed.pdf"
        assert row.storage_key == original_key


def test_strict_delete_keeps_row_when_storage_delete_fails():
    SessionLocal = _session_factory()
    storage = FakeStorage()
    storage.fail_remove = True
    with SessionLocal() as db:
        ids = _seed(db)

    with _client(SessionLocal, ids["user_a"], storage) as client:
        response = client.delete(f"/api/v1/files/{ids['file_a']}")

    assert response.status_code == 502
    with SessionLocal() as db:
        assert db.query(File).filter(File.id == ids["file_a"]).first() is not None


def test_upload_rejects_oversized_and_disallowed_files():
    SessionLocal = _session_factory()
    storage = FakeStorage()
    with SessionLocal() as db:
        ids = _seed(db)

    with _client(SessionLocal, ids["user_a"], storage) as client:
        too_large = client.post(
            "/api/v1/files/",
            data={"client_id": str(ids["client_a"])},
            files={"upload": ("large.pdf", b"x" * (25 * 1024 * 1024 + 1), "application/pdf")},
        )
        exe = client.post(
            "/api/v1/files/",
            data={"client_id": str(ids["client_a"])},
            files={"upload": ("bad.exe", b"bad", "application/x-msdownload")},
        )

    assert too_large.status_code == 413
    assert exe.status_code == 415
    assert storage.uploads == []


def test_db_failure_after_upload_removes_uploaded_object(monkeypatch):
    SessionLocal = _session_factory()
    storage = FakeStorage()
    with SessionLocal() as db:
        ids = _seed(db)

    def fail_commit(self):
        raise Exception("commit failed")

    monkeypatch.setattr(SessionLocal.class_, "commit", fail_commit)

    with _client(SessionLocal, ids["user_a"], storage) as client:
        response = client.post(
            "/api/v1/files/",
            data={"client_id": str(ids["client_a"])},
            files={"upload": ("doc.pdf", b"pdf", "application/pdf")},
        )

    assert response.status_code == 500
    assert len(storage.uploads) == 1
    assert storage.removes == [(storage.uploads[0][0], storage.uploads[0][1])]
