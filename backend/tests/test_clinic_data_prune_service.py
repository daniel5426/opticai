from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from database import Base
from models import (
    Client,
    Clinic,
    Company,
    ExamLayout,
    File,
    LookupSupplier,
    MigrationSourceLink,
    Settings,
    SoftOpticMigrationJob,
    User,
)
from services.clinic_data_prune_service import (
    create_prune_job,
    preview_counts,
    resume_prune_job,
    run_prune_job,
)


def _session_factory():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    return sessionmaker(autocommit=False, autoflush=False, bind=engine)


class FakeStorage:
    def __init__(self, fail_once=False):
        self.removed = []
        self.fail_once = fail_once

    def remove(self, bucket, key):
        if self.fail_once:
            self.fail_once = False
            raise RuntimeError("temporary storage failure")
        self.removed.append((bucket, key))


def test_prune_deletes_operational_data_and_preserves_configuration():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        company = Company(name="Company", owner_full_name="Owner")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Clinic", unique_id="prune-clinic")
        db.add(clinic)
        db.flush()
        ceo = User(company_id=company.id, clinic_id=None, username="ceo", role_level=4)
        clinic_user = User(company_id=company.id, clinic_id=clinic.id, username="worker", role_level=1)
        db.add_all([ceo, clinic_user])
        db.flush()
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Patient")
        db.add_all(
            [
                client,
                Settings(clinic_id=clinic.id, clinic_name="Configured name"),
                ExamLayout(clinic_id=clinic.id, name="Layout", layout_data="{}"),
                LookupSupplier(clinic_id=clinic.id, name="Configured supplier"),
            ]
        )
        db.flush()
        stored_file = File(
            clinic_id=clinic.id,
            client_id=client.id,
            file_name="scan.pdf",
            storage_bucket="clinic-files",
            storage_key="clinics/1/scan.pdf",
        )
        db.add(stored_file)
        db.flush()
        db.add(
            MigrationSourceLink(
                source_system="softoptic",
                source_table="account",
                raw_row_ref="account:1",
                source_primary_key_parts=[["account_code", "1"]],
                target_model="Client",
                target_id=client.id,
                clinic_id=clinic.id,
                company_id=company.id,
                payload={},
            )
        )
        db.add(
            SoftOpticMigrationJob(
                id="migration-audit",
                source_system="softoptic",
                clinic_id=clinic.id,
                company_id=company.id,
                user_id=ceo.id,
                status="completed",
                step="Completed",
                progress=100,
                source_metadata={},
                export_summary={},
                validation_summary={},
                import_summary={},
                checkpoint={},
                warnings=[],
                errors=[],
                bundle_storage_bucket="softoptic-migrations",
                bundle_storage_key="clinics/1/bundle.zip",
            )
        )
        db.commit()

        counts = preview_counts(db, clinic.id)
        assert "users" not in counts
        assert set(preview_counts(db, clinic.id, section="people")) == {"clients", "families"}
        job = create_prune_job(db, clinic=clinic, requested_by=ceo, counts=counts)
        storage = FakeStorage(fail_once=True)
        run_prune_job(db, job, storage)

        db.refresh(job)
        db.refresh(clinic)
        assert job.status == "failed"
        assert clinic.maintenance_mode is True

        resume_prune_job(db, job)
        run_prune_job(db, job, storage)
        db.refresh(job)
        db.refresh(clinic)
        assert job.status == "completed"
        assert clinic.maintenance_mode is False
        assert db.query(Client).filter_by(clinic_id=clinic.id).count() == 0
        assert db.query(User).filter_by(clinic_id=clinic.id).count() == 1
        assert db.get(User, clinic_user.id) is not None
        assert db.query(MigrationSourceLink).filter_by(clinic_id=clinic.id).count() == 0
        assert db.query(Settings).filter_by(clinic_id=clinic.id).count() == 1
        assert db.query(ExamLayout).filter_by(clinic_id=clinic.id).count() == 1
        assert db.query(LookupSupplier).filter_by(clinic_id=clinic.id).count() == 1
        assert db.get(User, ceo.id) is not None
        assert db.get(SoftOpticMigrationJob, "migration-audit") is not None
        assert ("clinic-files", "clinics/1/scan.pdf") in storage.removed
        assert ("softoptic-migrations", "clinics/1/bundle.zip") in storage.removed
