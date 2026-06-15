import csv
import zipfile

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import Client, Clinic, Company, MigrationSourceLink, SoftOpticMigrationJob, User
from services.softoptic_migration_service import (
    SOFTOPTIC_SOURCE_SYSTEM,
    assert_safe_to_import,
    run_softoptic_import,
    validate_export_bundle,
)


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)
    return SessionLocal


def _write_bundle(tmp_path, first_name="שם"):
    export_dir = tmp_path / "export"
    export_dir.mkdir()
    with (export_dir / "account.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "account_code",
                "account_type",
                "branch_code",
                "head_of_family",
                "first_name",
                "last_name",
            ],
        )
        writer.writeheader()
        writer.writerow(
            {
                "account_code": "101",
                "account_type": "CUST",
                "branch_code": "A",
                "head_of_family": "101",
                "first_name": first_name,
                "last_name": "כהן",
            }
        )
    bundle_path = tmp_path / "bundle.zip"
    with zipfile.ZipFile(bundle_path, "w") as archive:
        archive.write(export_dir / "account.csv", "account.csv")
    return bundle_path, export_dir


def _seed_job(db, bundle_path, job_id="job1"):
    company = Company(name="A", owner_full_name="Owner")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="Clinic", unique_id="clinic-a")
    user = User(company_id=company.id, clinic_id=None, username="admin", role_level=4, is_active=True)
    db.add_all([clinic, user])
    db.flush()
    job = SoftOpticMigrationJob(
        id=job_id,
        clinic_id=clinic.id,
        company_id=company.id,
        user_id=user.id,
        status="queued",
        step="queued",
        progress=0,
        source_metadata={},
        export_summary={},
        validation_summary={},
        import_summary={},
        warnings=[],
        errors=[],
        bundle_path=str(bundle_path),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job, clinic


def test_validate_export_bundle_counts_required_csv(tmp_path):
    _, export_dir = _write_bundle(tmp_path)

    result = validate_export_bundle(export_dir)

    assert result["errors"] == []
    assert result["counts"]["clients"] == 1
    assert result["tables"]["account.csv"] == 1


def test_softoptic_import_tracks_and_replaces_previous_run(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        job, clinic = _seed_job(db, bundle_path)
        updates = []

        run_softoptic_import(db, job=job, storage=None, on_progress=lambda **kwargs: updates.append(kwargs))

        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 1
        assert (
            db.query(MigrationSourceLink)
            .filter_by(source_system=SOFTOPTIC_SOURCE_SYSTEM, clinic_id=clinic.id, target_model="Client")
            .count()
            == 1
        )

        second_job = SoftOpticMigrationJob(
            id="job2",
            clinic_id=clinic.id,
            company_id=clinic.company_id,
            user_id=job.user_id,
            status="queued",
            step="queued",
            progress=0,
            source_metadata={},
            export_summary={},
            validation_summary={},
            import_summary={},
            warnings=[],
            errors=[],
            bundle_path=str(bundle_path),
        )
        db.add(second_job)
        db.commit()
        run_softoptic_import(db, job=second_job, storage=None, on_progress=lambda **kwargs: None)

        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 1
        assert db.query(MigrationSourceLink).filter_by(source_system=SOFTOPTIC_SOURCE_SYSTEM, clinic_id=clinic.id).count() > 0


def test_untracked_existing_data_blocks_import(tmp_path):
    SessionLocal = _session_factory()
    bundle_path, _ = _write_bundle(tmp_path)

    with SessionLocal() as db:
        _, clinic = _seed_job(db, bundle_path)
        db.add(Client(company_id=clinic.company_id, clinic_id=clinic.id, first_name="Existing"))
        db.commit()

        try:
            assert_safe_to_import(db, clinic.id)
            assert False, "expected guard to block"
        except RuntimeError as exc:
            assert "untracked data" in str(exc)
