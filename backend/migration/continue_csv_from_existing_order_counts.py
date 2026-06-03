import os
from pathlib import Path

from sqlalchemy import func, text

from backend.database import SessionLocal
from backend.models import Appointment, Clinic, ContactLensOrder, File, MedicalLog, Order, Referral
from backend.migration.pipeline.common import (
    clean_legacy_text,
    create_composite_client_id,
    get_company_by_id,
    get_or_create_admin_user,
    read_csv_streaming,
)
from backend.migration.pipeline.steps import (
    collect_branch_codes,
    enrich_from_contact_lens_chk,
    is_client_account,
    migrate_appointments,
    migrate_files,
    migrate_medical_logs,
    migrate_referrals,
    migrate_regular_orders,
)


def _required_int_env(name: str) -> int:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} is required")
    return int(value)


def _csv_dir() -> str:
    default_dir = Path(__file__).resolve().parent / "csv_files_new"
    return os.environ.get("CSV_DIR", str(default_dir))


def _build_account_map(csv_dir: str, clinic_id: int) -> dict[str, int]:
    account_to_client: dict[str, int] = {}
    for row in read_csv_streaming(csv_dir, "account.csv"):
        if not is_client_account(row):
            continue
        account_code = clean_legacy_text(row.get("account_code"))
        if not account_code:
            continue
        account_to_client[account_code] = create_composite_client_id(clinic_id, account_code)
    return account_to_client


def _rebuild_contact_order_map(db, csv_dir: str, clinic_id: int, account_to_client: dict[str, int]) -> dict[str, int]:
    existing_ids = [
        row[0]
        for row in db.query(ContactLensOrder.id)
        .filter(ContactLensOrder.clinic_id == clinic_id)
        .order_by(ContactLensOrder.id.asc())
        .all()
    ]
    mapping: dict[str, int] = {}
    expected = 0
    for row in read_csv_streaming(csv_dir, "optic_contact_presc.csv"):
        account_code = clean_legacy_text(row.get("account_code"))
        if not account_code or account_code not in account_to_client:
            continue
        if expected >= len(existing_ids):
            raise RuntimeError(
                f"Existing contact lens orders ended early: have {len(existing_ids)}, need more"
            )
        code = clean_legacy_text(row.get("code"))
        if code:
            mapping[code] = existing_ids[expected]
        expected += 1
    if expected != len(existing_ids):
        raise RuntimeError(
            f"Existing contact lens order count mismatch: csv={expected}, db={len(existing_ids)}"
        )
    return mapping


def _delete_later_artifacts(db, clinic_id: int) -> None:
    deleted = {
        "referrals": db.execute(
            text("DELETE FROM referrals WHERE clinic_id = :clinic_id"), {"clinic_id": clinic_id}
        ).rowcount,
        "files": db.execute(
            text("DELETE FROM files WHERE clinic_id = :clinic_id"), {"clinic_id": clinic_id}
        ).rowcount,
        "medical_logs": db.execute(
            text("DELETE FROM medical_logs WHERE clinic_id = :clinic_id"), {"clinic_id": clinic_id}
        ).rowcount,
        "appointments": db.execute(
            text("DELETE FROM appointments WHERE clinic_id = :clinic_id"), {"clinic_id": clinic_id}
        ).rowcount,
    }
    db.commit()
    print(f"[continue] deleted later artifacts: {deleted}", flush=True)


def main() -> None:
    clinic_id = _required_int_env("TARGET_CLINIC_ID")
    company_id = _required_int_env("COMPANY_ID")
    csv_dir = _csv_dir()

    with SessionLocal() as db:
        clinic = db.get(Clinic, clinic_id)
        if not clinic:
            raise RuntimeError(f"Clinic {clinic_id} not found")
        if clinic.company_id != company_id:
            raise RuntimeError(
                f"Clinic {clinic_id} belongs to company {clinic.company_id}, not {company_id}"
            )

        print(f"[continue] clinic={clinic.name} id={clinic.id} company_id={company_id}", flush=True)
        print(f"[continue] csv_dir={csv_dir}", flush=True)

        existing_regular_orders = (
            db.query(func.count(Order.id)).filter(Order.clinic_id == clinic_id).scalar() or 0
        )
        existing_contact_orders = (
            db.query(func.count(ContactLensOrder.id))
            .filter(ContactLensOrder.clinic_id == clinic_id)
            .scalar()
            or 0
        )
        print(
            f"[continue] existing regular_orders={existing_regular_orders}, "
            f"contact_lens_orders={existing_contact_orders}",
            flush=True,
        )

        company = get_company_by_id(db, company_id)
        admin_user = get_or_create_admin_user(db, company, clinic)
        admin_user_id = admin_user.id

        branch_to_clinic = {None: clinic_id, "": clinic_id}
        for branch_code in collect_branch_codes(csv_dir):
            branch_to_clinic[branch_code] = clinic_id

        account_to_client = _build_account_map(csv_dir, clinic_id)
        print(f"[continue] account_to_client={len(account_to_client)}", flush=True)

        presc_code_to_order_id = _rebuild_contact_order_map(
            db, csv_dir, clinic_id, account_to_client
        )
        print(f"[continue] contact_lens_order_map={len(presc_code_to_order_id)}", flush=True)

        _delete_later_artifacts(db, clinic_id)

        os.environ["MIGRATION_REGULAR_ORDER_SKIP_ROWS"] = str(existing_regular_orders)
        print("[continue] migrating remaining regular orders", flush=True)
        migrate_regular_orders(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

        print("[continue] enriching contact lens checks", flush=True)
        enrich_from_contact_lens_chk(db, csv_dir, account_to_client, presc_code_to_order_id)
        db.commit()

        print("[continue] migrating referrals", flush=True)
        migrate_referrals(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

        print("[continue] migrating files", flush=True)
        migrate_files(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

        print("[continue] migrating medical logs", flush=True)
        migrate_medical_logs(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

        print("[continue] migrating appointments", flush=True)
        migrate_appointments(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

    print("[continue] completed successfully", flush=True)


if __name__ == "__main__":
    main()
