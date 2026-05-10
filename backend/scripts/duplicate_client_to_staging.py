"""Duplicate one production client record into another database for staging tests.

Default mode is a dry run. Pass --execute to write to the target database.
"""
from __future__ import annotations

import argparse
import copy
import os
from pathlib import Path
import sys
from typing import Any

from sqlalchemy import create_engine, or_, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

# Keep model import from enforcing production runtime validation for this admin script.
os.environ.setdefault("APP_ENV", "development")

from models import (  # noqa: E402
    Appointment,
    Billing,
    Client,
    Clinic,
    ContactLensOrder,
    EmailLog,
    ExamLayout,
    ExamLayoutInstance,
    Family,
    File,
    MedicalLog,
    OpticalExam,
    Order,
    OrderLineItem,
    Referral,
    ReferralEye,
    User,
)


CLIENT_DEPENDENT_MODELS = (
    MedicalLog,
    OpticalExam,
    Order,
    ContactLensOrder,
    Referral,
    Appointment,
)


def _env_or_arg(value: str | None, env_name: str) -> str:
    resolved = value or os.getenv(env_name)
    if not resolved:
        raise SystemExit(f"Missing {env_name}. Pass the flag or set the environment variable.")
    return resolved


def _redacted_url(value: str) -> str:
    url = make_url(value)
    if url.password:
        url = url.set(password="***")
    return str(url)


def _db_identity(value: str) -> tuple[str, str | None, int | None, str | None, str | None]:
    url = make_url(value)
    return (
        url.get_backend_name(),
        url.host,
        url.port,
        url.database,
        url.username,
    )


def _create_session_factory(database_url: str) -> sessionmaker[Session]:
    url = make_url(database_url)
    kwargs: dict[str, Any] = {"pool_pre_ping": True}
    if url.get_backend_name() == "sqlite":
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["connect_args"] = {
            "connect_timeout": 10,
            "options": "-c statement_timeout=60000",
        }
    engine = create_engine(database_url, **kwargs)
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)


def _column_values(obj: Any, *, skip: set[str] | None = None) -> dict[str, Any]:
    ignored = {"id", *(skip or set())}
    values: dict[str, Any] = {}
    for column in obj.__table__.columns:
        if column.name in ignored:
            continue
        values[column.name] = copy.deepcopy(getattr(obj, column.name))
    return values


def _add_copy(target: Session, obj: Any, **overrides: Any) -> Any:
    values = _column_values(obj)
    values.update(overrides)
    copied = obj.__class__(**values)
    target.add(copied)
    target.flush()
    return copied


def _target_has_id(target: Session, model: type[Any], id_value: int | None) -> bool:
    return id_value is not None and target.get(model, id_value) is not None


def _mapped_user_id(target: Session, source_user_id: int | None) -> int | None:
    return source_user_id if _target_has_id(target, User, source_user_id) else None


def _mapped_layout_id(target: Session, source_layout_id: int | None) -> int | None:
    return source_layout_id if _target_has_id(target, ExamLayout, source_layout_id) else None


def _count_dependents(source: Session, client_id: int, *, include_file_metadata: bool) -> dict[str, int]:
    counts: dict[str, int] = {}
    for model in CLIENT_DEPENDENT_MODELS:
        counts[model.__tablename__] = len(
            source.scalars(select(model).where(model.client_id == client_id)).all()
        )

    exam_ids = list(source.scalars(select(OpticalExam.id).where(OpticalExam.client_id == client_id)))
    referral_ids = list(source.scalars(select(Referral.id).where(Referral.client_id == client_id)))
    order_ids = list(source.scalars(select(Order.id).where(Order.client_id == client_id)))
    contact_order_ids = [
        id_value for id_value in source.scalars(select(ContactLensOrder.id).where(ContactLensOrder.client_id == client_id))
    ]
    appointment_ids = [
        id_value for id_value in source.scalars(select(Appointment.id).where(Appointment.client_id == client_id))
    ]

    counts["exam_layout_instances"] = (
        len(source.scalars(select(ExamLayoutInstance).where(ExamLayoutInstance.exam_id.in_(exam_ids))).all())
        if exam_ids
        else 0
    )
    counts["referral_eye"] = (
        len(source.scalars(select(ReferralEye).where(ReferralEye.referral_id.in_(referral_ids))).all())
        if referral_ids
        else 0
    )
    billing_filter = []
    if order_ids:
        billing_filter.append(Billing.order_id.in_(order_ids))
    if contact_order_ids:
        billing_filter.append(Billing.contact_lens_id.in_(contact_order_ids))
    billings = source.scalars(select(Billing).where(or_(*billing_filter))).all() if billing_filter else []
    billing_ids = [billing.id for billing in billings]
    counts["billings"] = len(billings)
    counts["order_line_item"] = (
        len(source.scalars(select(OrderLineItem).where(OrderLineItem.billings_id.in_(billing_ids))).all())
        if billing_ids
        else 0
    )
    counts["email_logs"] = (
        len(source.scalars(select(EmailLog).where(EmailLog.appointment_id.in_(appointment_ids))).all())
        if appointment_ids
        else 0
    )
    counts["files"] = (
        len(source.scalars(select(File).where(File.client_id == client_id)).all()) if include_file_metadata else 0
    )
    return counts


def _find_client(args: argparse.Namespace, source: Session) -> Client:
    filters = []
    if args.source_client_id is not None:
        filters.append(Client.id == args.source_client_id)
    if args.national_id:
        filters.append(Client.national_id == args.national_id)
    if args.mobile:
        filters.append(Client.phone_mobile == args.mobile)
    if args.email:
        filters.append(Client.email == args.email)
    if not filters:
        raise SystemExit("Choose a client with --source-client-id, --national-id, --mobile, or --email.")

    clients = source.scalars(select(Client).where(*filters)).all()
    if not clients:
        raise SystemExit("No matching source client found.")
    if len(clients) > 1:
        matches = ", ".join(str(client.id) for client in clients[:20])
        raise SystemExit(f"Multiple source clients matched. Re-run with --source-client-id. Matches: {matches}")
    return clients[0]


def _copy_family(
    source: Session,
    target: Session,
    source_client: Client,
    *,
    target_company_id: int,
    target_clinic_id: int,
) -> int | None:
    if not source_client.family_id:
        return None
    source_family = source.get(Family, source_client.family_id)
    if not source_family:
        return None

    existing = target.scalars(
        select(Family).where(
            Family.clinic_id == target_clinic_id,
            Family.name == source_family.name,
        )
    ).first()
    if existing:
        return existing.id

    copied = _add_copy(
        target,
        source_family,
        company_id=target_company_id,
        clinic_id=target_clinic_id,
    )
    return copied.id


def duplicate_client(args: argparse.Namespace) -> None:
    source_url = _env_or_arg(args.source_database_url, "PRODUCTION_DATABASE_URL")
    target_url = _env_or_arg(args.target_database_url, "STAGING_DATABASE_URL")
    if _db_identity(source_url) == _db_identity(target_url):
        raise SystemExit("Source and target database identities are the same; refusing to continue.")

    SourceSession = _create_session_factory(source_url)
    TargetSession = _create_session_factory(target_url)

    with SourceSession() as source, TargetSession() as target:
        source_client = _find_client(args, source)
        target_clinic_id = args.target_clinic_id or source_client.clinic_id
        if not target_clinic_id:
            raise SystemExit("Source client has no clinic_id. Pass --target-clinic-id.")

        target_clinic = target.get(Clinic, target_clinic_id)
        if not target_clinic:
            raise SystemExit(f"Target clinic {target_clinic_id} does not exist in staging.")

        counts = _count_dependents(source, source_client.id, include_file_metadata=args.include_file_metadata)
        client_name = " ".join(part for part in [source_client.first_name, source_client.last_name] if part)
        print(f"Source: {_redacted_url(source_url)}")
        print(f"Target: {_redacted_url(target_url)}")
        print(f"Client: {source_client.id} {client_name}".strip())
        print(f"Target clinic: {target_clinic.id} ({target_clinic.name})")
        for table, count in counts.items():
            print(f"{table}: {count}")

        if not args.execute:
            print("Dry run only. Re-run with --execute to copy these rows.")
            return

        try:
            target_family_id = _copy_family(
                source,
                target,
                source_client,
                target_company_id=target_clinic.company_id,
                target_clinic_id=target_clinic.id,
            )

            copied_client = _add_copy(
                target,
                source_client,
                company_id=target_clinic.company_id,
                clinic_id=target_clinic.id,
                family_id=target_family_id,
            )

            exam_id_map: dict[int, int] = {}
            for exam in source.scalars(select(OpticalExam).where(OpticalExam.client_id == source_client.id)).all():
                copied_exam = _add_copy(
                    target,
                    exam,
                    client_id=copied_client.id,
                    clinic_id=target_clinic.id,
                    user_id=_mapped_user_id(target, exam.user_id),
                )
                exam_id_map[exam.id] = copied_exam.id

            for source_exam_id, target_exam_id in exam_id_map.items():
                instances = source.scalars(
                    select(ExamLayoutInstance).where(ExamLayoutInstance.exam_id == source_exam_id)
                ).all()
                for instance in instances:
                    _add_copy(
                        target,
                        instance,
                        exam_id=target_exam_id,
                        layout_id=_mapped_layout_id(target, instance.layout_id),
                    )

            for log in source.scalars(select(MedicalLog).where(MedicalLog.client_id == source_client.id)).all():
                _add_copy(
                    target,
                    log,
                    client_id=copied_client.id,
                    clinic_id=target_clinic.id,
                    user_id=_mapped_user_id(target, log.user_id),
                )

            order_id_map: dict[int, int] = {}
            for order in source.scalars(select(Order).where(Order.client_id == source_client.id)).all():
                copied_order = _add_copy(
                    target,
                    order,
                    client_id=copied_client.id,
                    clinic_id=target_clinic.id,
                    user_id=_mapped_user_id(target, order.user_id),
                )
                order_id_map[order.id] = copied_order.id

            contact_order_id_map: dict[int, int] = {}
            for order in source.scalars(select(ContactLensOrder).where(ContactLensOrder.client_id == source_client.id)).all():
                copied_order = _add_copy(
                    target,
                    order,
                    client_id=copied_client.id,
                    clinic_id=target_clinic.id,
                    user_id=_mapped_user_id(target, order.user_id),
                    supply_in_clinic_id=(
                        order.supply_in_clinic_id
                        if _target_has_id(target, Clinic, order.supply_in_clinic_id)
                        else target_clinic.id
                    ),
                )
                contact_order_id_map[order.id] = copied_order.id

            billing_id_map: dict[int, int] = {}
            billing_filters = []
            if order_id_map:
                billing_filters.append(Billing.order_id.in_(order_id_map.keys()))
            if contact_order_id_map:
                billing_filters.append(Billing.contact_lens_id.in_(contact_order_id_map.keys()))
            billings = source.scalars(select(Billing).where(or_(*billing_filters))).all() if billing_filters else []
            for billing in billings:
                copied_billing = _add_copy(
                    target,
                    billing,
                    order_id=order_id_map.get(billing.order_id),
                    contact_lens_id=contact_order_id_map.get(billing.contact_lens_id),
                )
                billing_id_map[billing.id] = copied_billing.id

            for source_billing_id, target_billing_id in billing_id_map.items():
                line_items = source.scalars(
                    select(OrderLineItem).where(OrderLineItem.billings_id == source_billing_id)
                ).all()
                for line_item in line_items:
                    _add_copy(target, line_item, billings_id=target_billing_id)

            referral_id_map: dict[int, int] = {}
            for referral in source.scalars(select(Referral).where(Referral.client_id == source_client.id)).all():
                copied_referral = _add_copy(
                    target,
                    referral,
                    client_id=copied_client.id,
                    clinic_id=target_clinic.id,
                    user_id=_mapped_user_id(target, referral.user_id),
                )
                referral_id_map[referral.id] = copied_referral.id

            for source_referral_id, target_referral_id in referral_id_map.items():
                eyes = source.scalars(select(ReferralEye).where(ReferralEye.referral_id == source_referral_id)).all()
                for eye in eyes:
                    _add_copy(target, eye, referral_id=target_referral_id)

            appointment_id_map: dict[int, int] = {}
            for appointment in source.scalars(select(Appointment).where(Appointment.client_id == source_client.id)).all():
                copied_appointment = _add_copy(
                    target,
                    appointment,
                    client_id=copied_client.id,
                    clinic_id=target_clinic.id,
                    user_id=_mapped_user_id(target, appointment.user_id),
                    google_calendar_event_id=None,
                )
                appointment_id_map[appointment.id] = copied_appointment.id

            for source_appointment_id, target_appointment_id in appointment_id_map.items():
                logs = source.scalars(select(EmailLog).where(EmailLog.appointment_id == source_appointment_id)).all()
                for log in logs:
                    _add_copy(target, log, appointment_id=target_appointment_id)

            if args.include_file_metadata:
                for file in source.scalars(select(File).where(File.client_id == source_client.id)).all():
                    _add_copy(
                        target,
                        file,
                        client_id=copied_client.id,
                        clinic_id=target_clinic.id,
                        uploaded_by=_mapped_user_id(target, file.uploaded_by),
                    )

            target.commit()
            print(f"Copied source client {source_client.id} to staging client {copied_client.id}.")
        except Exception:
            target.rollback()
            raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Duplicate one client account from production into staging.",
    )
    parser.add_argument("--source-database-url", help="Production database URL. Defaults to PRODUCTION_DATABASE_URL.")
    parser.add_argument("--target-database-url", help="Staging database URL. Defaults to STAGING_DATABASE_URL.")
    selector = parser.add_argument_group("client selector")
    selector.add_argument("--source-client-id", type=int)
    selector.add_argument("--national-id")
    selector.add_argument("--mobile")
    selector.add_argument("--email")
    parser.add_argument("--target-clinic-id", type=int, help="Staging clinic id. Defaults to the source clinic id.")
    parser.add_argument(
        "--include-file-metadata",
        action="store_true",
        help="Copy files table rows only. This does not copy Supabase storage objects.",
    )
    parser.add_argument("--execute", action="store_true", help="Actually write to staging. Omit for a dry run.")
    return parser.parse_args()


if __name__ == "__main__":
    duplicate_client(parse_args())
