import os
from pathlib import Path

from sqlalchemy import text

from backend.database import SessionLocal
from backend.models import Clinic
from backend.migration.pipeline.common import (
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
    migrate_contact_lens_orders,
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


def _delete_order_and_later_artifacts(db, clinic_id: int) -> None:
    db.execute(
        text(
            """
            DELETE FROM order_line_item
            WHERE billings_id IN (
                SELECT id FROM billings
                WHERE order_id IN (SELECT id FROM orders WHERE clinic_id = :clinic_id)
                   OR contact_lens_id IN (SELECT id FROM contact_lens_orders WHERE clinic_id = :clinic_id)
            )
            """
        ),
        {"clinic_id": clinic_id},
    )
    db.execute(
        text(
            """
            DELETE FROM billings
            WHERE order_id IN (SELECT id FROM orders WHERE clinic_id = :clinic_id)
               OR contact_lens_id IN (SELECT id FROM contact_lens_orders WHERE clinic_id = :clinic_id)
            """
        ),
        {"clinic_id": clinic_id},
    )
    regular_deleted = db.execute(
        text("DELETE FROM orders WHERE clinic_id = :clinic_id"),
        {"clinic_id": clinic_id},
    ).rowcount
    contact_deleted = db.execute(
        text("DELETE FROM contact_lens_orders WHERE clinic_id = :clinic_id"),
        {"clinic_id": clinic_id},
    ).rowcount
    referrals_deleted = db.execute(
        text("DELETE FROM referrals WHERE clinic_id = :clinic_id"),
        {"clinic_id": clinic_id},
    ).rowcount
    files_deleted = db.execute(
        text("DELETE FROM files WHERE clinic_id = :clinic_id"),
        {"clinic_id": clinic_id},
    ).rowcount
    logs_deleted = db.execute(
        text("DELETE FROM medical_logs WHERE clinic_id = :clinic_id"),
        {"clinic_id": clinic_id},
    ).rowcount
    appointments_deleted = db.execute(
        text("DELETE FROM appointments WHERE clinic_id = :clinic_id"),
        {"clinic_id": clinic_id},
    ).rowcount
    db.commit()
    print(
        "[resume] deleted "
        f"orders={regular_deleted}, contact_lens_orders={contact_deleted}, "
        f"referrals={referrals_deleted}, files={files_deleted}, "
        f"medical_logs={logs_deleted}, appointments={appointments_deleted}",
        flush=True,
    )


def _build_account_map(csv_dir: str, clinic_id: int) -> dict[str, int]:
    account_to_client: dict[str, int] = {}
    for row in read_csv_streaming(csv_dir, "account.csv"):
        if not is_client_account(row):
            continue
        account_code = str(row.get("account_code") or "").strip()
        if not account_code:
            continue
        account_to_client[account_code] = create_composite_client_id(clinic_id, account_code)
    return account_to_client


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

        print(f"[resume] clinic={clinic.name} id={clinic.id} company_id={company_id}", flush=True)
        print(f"[resume] csv_dir={csv_dir}", flush=True)

        _delete_order_and_later_artifacts(db, clinic_id)

        company = get_company_by_id(db, company_id)
        admin_user = get_or_create_admin_user(db, company, clinic)
        admin_user_id = admin_user.id

        branch_to_clinic = {None: clinic_id, "": clinic_id}
        for branch_code in collect_branch_codes(csv_dir):
            branch_to_clinic[branch_code] = clinic_id

        account_to_client = _build_account_map(csv_dir, clinic_id)
        print(f"[resume] account_to_client={len(account_to_client)}", flush=True)

        print("[resume] migrating contact lens orders", flush=True)
        presc_code_to_order_id = migrate_contact_lens_orders(
            db, csv_dir, account_to_client, branch_to_clinic, admin_user_id
        )
        db.commit()
        print(f"[resume] contact_lens_order_map={len(presc_code_to_order_id)}", flush=True)

        print("[resume] migrating regular orders", flush=True)
        migrate_regular_orders(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

        print("[resume] enriching contact lens checks", flush=True)
        enrich_from_contact_lens_chk(db, csv_dir, account_to_client, presc_code_to_order_id)
        db.commit()

        print("[resume] migrating referrals", flush=True)
        migrate_referrals(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

        print("[resume] migrating files", flush=True)
        migrate_files(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

        print("[resume] migrating medical logs", flush=True)
        migrate_medical_logs(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

        print("[resume] migrating appointments", flush=True)
        migrate_appointments(db, csv_dir, account_to_client, branch_to_clinic, admin_user_id)
        db.commit()

    print("[resume] completed successfully", flush=True)


if __name__ == "__main__":
    main()
