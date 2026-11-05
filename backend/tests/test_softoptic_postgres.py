"""Real PostgreSQL checks on the explicitly disposable fixture, never DATABASE_URL."""
import csv
import zipfile
import pytest
from sqlalchemy import text, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import IntegrityError
from backend.tests.test_company_record_migration import pg_engine
from backend.tests.test_softoptic_migration_service import _write_bundle, _seed_job
from database import Base
from models import Client, Clinic, Company, SoftOpticMigrationJob, OpticalExam
from workers import softoptic_migration_worker as worker


@pytest.fixture(scope="module", autouse=True)
def utf8_connections(pg_engine):
    # The shared fixture uses --no-locale, which defaults to SQL_ASCII.
    event.listen(pg_engine, "connect", lambda connection, _: connection.set_client_encoding("UTF8"))
    pg_engine.dispose()


def test_postgres_skips_occupied_sequence_ids_and_commits_progress(pg_engine, tmp_path, monkeypatch):
    Base.metadata.create_all(pg_engine)
    sessions = sessionmaker(bind=pg_engine, autoflush=False)
    bundle, export = _write_bundle(tmp_path)
    with (export / "optic_eye_tests.csv").open("w", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=["code", "account_code", "branch_code", "test_date", "test_name"])
        writer.writeheader()
        writer.writerow({"code": "1", "account_code": "101", "branch_code": "A", "test_date": "2024-01-01", "test_name": "Imported"})
    with zipfile.ZipFile(bundle, "a") as archive:
        archive.write(export / "optic_eye_tests.csv", "optic_eye_tests.csv")
    with sessions() as db:
        job, clinic = _seed_job(db, bundle)
        job.status = "running"
        company = Company(name="Other", owner_full_name="Owner")
        db.add(company)
        db.flush()
        other = Clinic(company_id=company.id, name="Other", unique_id="other")
        db.add(other)
        db.flush()
        occupied = int(f"{clinic.id}101")
        db.add(Client(id=occupied, company_id=company.id, clinic_id=other.id, first_name="Keep"))
        db.commit()
        db.execute(text("SELECT setval(pg_get_serial_sequence('clients','id'), :n)"), {"n": occupied - 1})
        db.commit()
        job_id, clinic_id = job.id, clinic.id
    monkeypatch.setattr(worker, "SessionLocal", sessions)
    monkeypatch.setattr(worker, "get_file_storage_service", lambda: None)
    monkeypatch.setattr(worker, "claim_next_job", lambda db, name: db.get(SoftOpticMigrationJob, job_id))
    assert worker.run_once("isolated-worker")
    with sessions() as db:
        job = db.get(SoftOpticMigrationJob, job_id)
        assert job.status == "completed", job.error
        assert job.progress == 100
        assert db.get(Client, occupied).first_name == "Keep"
        imported = db.query(Client).filter_by(clinic_id=clinic_id).one()
        assert imported.id != occupied
        assert db.query(OpticalExam).filter_by(clinic_id=clinic_id).one().client_id == imported.id


def test_postgres_failed_insert_persists_failure_outside_rolled_back_transaction(pg_engine, tmp_path, monkeypatch):
    # A second isolated job/clinic in the same disposable database.
    Base.metadata.create_all(pg_engine)
    sessions = sessionmaker(bind=pg_engine, autoflush=False)
    bundle, _ = _write_bundle(tmp_path)
    with sessions() as db:
        job, clinic = _seed_job(db, bundle, job_id="failure-job", clinic_unique_id="failure-clinic", username="failure-admin")
        job.status = "running"
        db.commit()
        job_id, clinic_id = job.id, clinic.id
    monkeypatch.setattr(worker, "SessionLocal", sessions)
    monkeypatch.setattr(worker, "get_file_storage_service", lambda: None)
    monkeypatch.setattr(worker, "claim_next_job", lambda db, name: db.get(SoftOpticMigrationJob, job_id))
    def fail(connection, cursor, statement, parameters, context, executemany):
        if statement.startswith("INSERT INTO clients"):
            raise IntegrityError(statement, {"private": "patient"}, Exception("rejected client batch"))
    event.listen(pg_engine, "before_cursor_execute", fail)
    try:
        assert worker.run_once("isolated-worker")
    finally:
        event.remove(pg_engine, "before_cursor_execute", fail)
    with sessions() as db:
        job = db.get(SoftOpticMigrationJob, job_id)
        assert job.status == "failed"
        assert job.error == "rejected client batch"
        assert "patient" not in str(job.errors)
        assert job.lease_until is None
        assert db.query(Client).filter_by(clinic_id=clinic_id).count() == 0


@pytest.mark.parametrize("outcome", ["returns", "raises"])
def test_worker_cannot_leave_a_finished_attempt_running(pg_engine, tmp_path, monkeypatch, outcome):
    Base.metadata.create_all(pg_engine)
    sessions = sessionmaker(bind=pg_engine, autoflush=False)
    bundle, _ = _write_bundle(tmp_path)
    with sessions() as db:
        job, _ = _seed_job(db, bundle, job_id=outcome, clinic_unique_id=outcome, username=outcome)
        job.status = "running"
        db.commit()
        job_id = job.id
    monkeypatch.setattr(worker, "SessionLocal", sessions)
    monkeypatch.setattr(worker, "get_file_storage_service", lambda: None)
    monkeypatch.setattr(worker, "claim_next_job", lambda db, name: db.get(SoftOpticMigrationJob, job_id))
    def finish(*args, **kwargs):
        if outcome == "raises":
            raise RuntimeError("worker test failure")
    monkeypatch.setattr(worker, "run_migration_import", finish)
    worker.run_once("isolated-worker")
    with sessions() as db:
        job = db.get(SoftOpticMigrationJob, job_id)
        assert job.status == "failed"
        assert job.error == ("worker test failure" if outcome == "raises" else "softoptic.workerExited")
        assert job.lease_until is None
