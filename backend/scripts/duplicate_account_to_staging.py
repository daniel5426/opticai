"""Duplicate one production company/account into staging by CEO email.

Loads .env files automatically. Default mode is a dry run; pass --execute to write.
"""
from __future__ import annotations

import argparse
import copy
import os
from pathlib import Path
import sys
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine, or_, select
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = ROOT.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

load_dotenv(PROJECT_ROOT / ".env")
load_dotenv(ROOT / ".env")
load_dotenv()
os.environ.setdefault("APP_ENV", "development")

from models import (  # noqa: E402
    Appointment,
    AuthSession,
    Billing,
    Campaign,
    CampaignClientExecution,
    Chat,
    ChatMessage,
    Client,
    Clinic,
    ClinicDeviceTrust,
    Company,
    ContactLensOrder,
    EmailLog,
    ExamLayout,
    ExamLayoutInstance,
    Family,
    File,
    MedicalLog,
    MigrationSourceLink,
    OpticalExam,
    Order,
    OrderLineItem,
    Referral,
    ReferralEye,
    Settings,
    User,
    WorkShift,
)
from models import Base  # noqa: E402


LOOKUP_MODELS = [
    mapper.class_
    for mapper in Base.registry.mappers
    if getattr(mapper.class_, "__tablename__", "").startswith("lookup_")
]


def _first_env(*names: str) -> str | None:
    for name in names:
        value = os.getenv(name)
        if value:
            return value
    return None


def _resolve_database_urls(args: argparse.Namespace) -> tuple[str, str]:
    source_url = args.source_database_url or _first_env("PRODUCTION_DATABASE_URL", "SOURCE_DATABASE_URL")
    target_url = args.target_database_url or _first_env("STAGING_DATABASE_URL", "TARGET_DATABASE_URL", "DATABASE_URL")
    if not source_url:
        raise SystemExit("Missing production DB URL. Add PRODUCTION_DATABASE_URL to backend/.env or pass --source-database-url.")
    if not target_url:
        raise SystemExit("Missing staging DB URL. Add STAGING_DATABASE_URL or DATABASE_URL to backend/.env.")
    return source_url, target_url


def _redacted_url(value: str) -> str:
    url = make_url(value)
    return str(url.set(password="***")) if url.password else str(url)


def _db_identity(value: str) -> tuple[str, str | None, int | None, str | None, str | None]:
    url = make_url(value)
    return (url.get_backend_name(), url.host, url.port, url.database, url.username)


def _session_factory(database_url: str) -> sessionmaker[Session]:
    url = make_url(database_url)
    kwargs: dict[str, Any] = {"pool_pre_ping": True}
    if url.get_backend_name() == "sqlite":
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["connect_args"] = {"connect_timeout": 10, "options": "-c statement_timeout=120000"}
    return sessionmaker(bind=create_engine(database_url, **kwargs), autocommit=False, autoflush=False)


def _values(obj: Any, *, skip: set[str] | None = None) -> dict[str, Any]:
    ignored = {"id", *(skip or set())}
    return {
        column.name: copy.deepcopy(getattr(obj, column.name))
        for column in obj.__table__.columns
        if column.name not in ignored
    }


def _copy_row(target: Session, obj: Any, **overrides: Any) -> Any:
    values = _values(obj)
    values.update(overrides)
    copied = obj.__class__(**values)
    target.add(copied)
    target.flush()
    return copied


def _find_account(source: Session, ceo_email: str) -> tuple[Company, User]:
    email = ceo_email.strip().lower()
    user = source.scalars(select(User).where(User.email == email).order_by(User.role_level.desc())).first()
    if user and user.company_id:
        company = source.get(Company, user.company_id)
        if company:
            return company, user

    company = source.scalars(select(Company).where(Company.contact_email == email)).first()
    if company:
        user = source.scalars(
            select(User).where(User.company_id == company.id).order_by(User.role_level.desc())
        ).first()
        if user:
            return company, user

    raise SystemExit(f"No production account found for CEO/contact email {email}.")


def _login_conflicts(target: Session, users: list[User]) -> tuple[set[int], list[str]]:
    emails = [user.email for user in users if user.email]
    usernames = [user.username for user in users if user.username]
    conflicts: list[str] = []
    company_ids: set[int] = set()
    if emails:
        rows = target.scalars(select(User).where(User.email.in_(emails))).all()
        conflicts.extend(f"email:{row.email}" for row in rows)
        company_ids.update(row.company_id for row in rows)
    if usernames:
        rows = target.scalars(select(User).where(User.username.in_(usernames))).all()
        conflicts.extend(f"username:{row.username}" for row in rows)
        company_ids.update(row.company_id for row in rows)
    return company_ids, sorted(set(conflicts))


def _delete_rows(target: Session, model: type[Any], *filters: Any) -> int:
    if not filters:
        return 0
    return target.query(model).filter(*filters).delete(synchronize_session=False)


def _delete_target_accounts(target: Session, company_ids: set[int]) -> None:
    if not company_ids:
        return

    clinic_ids = list(target.scalars(select(Clinic.id).where(Clinic.company_id.in_(company_ids))))
    user_ids = list(target.scalars(select(User.id).where(User.company_id.in_(company_ids))))
    client_ids = list(target.scalars(select(Client.id).where(Client.company_id.in_(company_ids))))
    exam_ids = list(target.scalars(select(OpticalExam.id).where(OpticalExam.client_id.in_(client_ids)))) if client_ids else []
    order_ids = list(target.scalars(select(Order.id).where(Order.client_id.in_(client_ids)))) if client_ids else []
    contact_order_ids = (
        list(target.scalars(select(ContactLensOrder.id).where(ContactLensOrder.client_id.in_(client_ids))))
        if client_ids
        else []
    )
    referral_ids = list(target.scalars(select(Referral.id).where(Referral.client_id.in_(client_ids)))) if client_ids else []
    appointment_ids = (
        list(target.scalars(select(Appointment.id).where(Appointment.client_id.in_(client_ids)))) if client_ids else []
    )
    campaign_ids = list(target.scalars(select(Campaign.id).where(Campaign.clinic_id.in_(clinic_ids)))) if clinic_ids else []
    chat_ids = list(target.scalars(select(Chat.id).where(Chat.clinic_id.in_(clinic_ids)))) if clinic_ids else []
    layout_ids = (
        list(target.scalars(select(ExamLayout.id).where(ExamLayout.clinic_id.in_(clinic_ids)))) if clinic_ids else []
    )
    billing_filters = []
    if order_ids:
        billing_filters.append(Billing.order_id.in_(order_ids))
    if contact_order_ids:
        billing_filters.append(Billing.contact_lens_id.in_(contact_order_ids))
    billing_ids = list(target.scalars(select(Billing.id).where(or_(*billing_filters)))) if billing_filters else []

    deleted: dict[str, int] = {}
    if appointment_ids:
        deleted["email_logs"] = _delete_rows(target, EmailLog, EmailLog.appointment_id.in_(appointment_ids))
    if billing_ids:
        deleted["order_line_item"] = _delete_rows(target, OrderLineItem, OrderLineItem.billings_id.in_(billing_ids))
        deleted["billings"] = _delete_rows(target, Billing, Billing.id.in_(billing_ids))
    if referral_ids:
        deleted["referral_eye"] = _delete_rows(target, ReferralEye, ReferralEye.referral_id.in_(referral_ids))
    if exam_ids:
        deleted["exam_layout_instances"] = _delete_rows(
            target,
            ExamLayoutInstance,
            ExamLayoutInstance.exam_id.in_(exam_ids),
        )
    if campaign_ids:
        deleted["campaign_client_executions"] = _delete_rows(
            target,
            CampaignClientExecution,
            CampaignClientExecution.campaign_id.in_(campaign_ids),
        )
    if client_ids:
        deleted["campaign_client_executions"] = deleted.get("campaign_client_executions", 0) + _delete_rows(
            target,
            CampaignClientExecution,
            CampaignClientExecution.client_id.in_(client_ids),
        )
        deleted["files"] = _delete_rows(target, File, File.client_id.in_(client_ids))
        deleted["medical_logs"] = _delete_rows(target, MedicalLog, MedicalLog.client_id.in_(client_ids))
        deleted["optical_exams"] = _delete_rows(target, OpticalExam, OpticalExam.client_id.in_(client_ids))
        deleted["orders"] = _delete_rows(target, Order, Order.client_id.in_(client_ids))
        deleted["contact_lens_orders"] = _delete_rows(
            target,
            ContactLensOrder,
            ContactLensOrder.client_id.in_(client_ids),
        )
        deleted["referrals"] = _delete_rows(target, Referral, Referral.client_id.in_(client_ids))
        deleted["appointments"] = _delete_rows(target, Appointment, Appointment.client_id.in_(client_ids))
        deleted["clients"] = _delete_rows(target, Client, Client.id.in_(client_ids))
    if user_ids:
        deleted["auth_sessions"] = _delete_rows(target, AuthSession, AuthSession.user_id.in_(user_ids))
        deleted["work_shifts"] = _delete_rows(target, WorkShift, WorkShift.user_id.in_(user_ids))
    if chat_ids:
        deleted["chat_messages"] = _delete_rows(target, ChatMessage, ChatMessage.chat_id.in_(chat_ids))
        deleted["chats"] = _delete_rows(target, Chat, Chat.id.in_(chat_ids))
    if layout_ids:
        target.query(ExamLayout).filter(ExamLayout.id.in_(layout_ids)).update(
            {ExamLayout.parent_layout_id: None},
            synchronize_session=False,
        )
        deleted["exam_layouts"] = _delete_rows(target, ExamLayout, ExamLayout.id.in_(layout_ids))
    if clinic_ids:
        deleted["settings"] = _delete_rows(target, Settings, Settings.clinic_id.in_(clinic_ids))
        for model in LOOKUP_MODELS:
            count = _delete_rows(target, model, model.clinic_id.in_(clinic_ids))
            deleted["lookups"] = deleted.get("lookups", 0) + count
        deleted["campaigns"] = _delete_rows(target, Campaign, Campaign.clinic_id.in_(clinic_ids))
        deleted["clinic_device_trusts"] = _delete_rows(
            target,
            ClinicDeviceTrust,
            ClinicDeviceTrust.clinic_id.in_(clinic_ids),
        )
        deleted["migration_source_links"] = _delete_rows(
            target,
            MigrationSourceLink,
            MigrationSourceLink.clinic_id.in_(clinic_ids),
        )
    deleted["auth_sessions"] = deleted.get("auth_sessions", 0) + _delete_rows(
        target,
        AuthSession,
        AuthSession.company_id.in_(company_ids),
    )
    deleted["clinic_device_trusts"] = deleted.get("clinic_device_trusts", 0) + _delete_rows(
        target,
        ClinicDeviceTrust,
        ClinicDeviceTrust.company_id.in_(company_ids),
    )
    deleted["families"] = _delete_rows(target, Family, Family.company_id.in_(company_ids))
    deleted["users"] = _delete_rows(target, User, User.company_id.in_(company_ids))
    if clinic_ids:
        deleted["clinics"] = _delete_rows(target, Clinic, Clinic.id.in_(clinic_ids))
    deleted["companies"] = _delete_rows(target, Company, Company.id.in_(company_ids))

    summary = ", ".join(f"{name}:{count}" for name, count in deleted.items() if count)
    print(f"Deleted existing target account data for company ids {sorted(company_ids)}.")
    if summary:
        print(f"Deleted rows: {summary}")


def _prepare_target_for_copy(target: Session, users: list[User]) -> None:
    company_ids, conflicts = _login_conflicts(target, users)
    if conflicts:
        preview = ", ".join(conflicts[:20])
        print(f"Target has conflicting login values; deleting matching target account data first: {preview}")
        _delete_target_accounts(target, company_ids)
        target.flush()

    _, remaining = _login_conflicts(target, users)
    if remaining:
        preview = ", ".join(remaining[:20])
        raise SystemExit(f"Target still has conflicting login values after cleanup: {preview}")


def _mapped(mapping: dict[int, int], value: int | None) -> int | None:
    return mapping.get(value) if value is not None else None


def _unique_clinic_id(target: Session, source_unique_id: str, source_id: int) -> str:
    if not target.scalars(select(Clinic.id).where(Clinic.unique_id == source_unique_id)).first():
        return source_unique_id
    base = f"{source_unique_id}-staging-{source_id}"
    candidate = base
    index = 2
    while target.scalars(select(Clinic.id).where(Clinic.unique_id == candidate)).first():
        candidate = f"{base}-{index}"
        index += 1
    return candidate


def _print_counts(source: Session, company_id: int, clinic_ids: list[int], user_ids: list[int], client_ids: list[int]) -> None:
    def count(model: Any, *filters: Any) -> int:
        return len(source.scalars(select(model).where(*filters)).all())

    exam_ids = list(source.scalars(select(OpticalExam.id).where(OpticalExam.client_id.in_(client_ids)))) if client_ids else []
    order_ids = list(source.scalars(select(Order.id).where(Order.client_id.in_(client_ids)))) if client_ids else []
    contact_order_ids = (
        list(source.scalars(select(ContactLensOrder.id).where(ContactLensOrder.client_id.in_(client_ids))))
        if client_ids
        else []
    )
    referral_ids = list(source.scalars(select(Referral.id).where(Referral.client_id.in_(client_ids)))) if client_ids else []
    appointment_ids = (
        list(source.scalars(select(Appointment.id).where(Appointment.client_id.in_(client_ids)))) if client_ids else []
    )
    billing_filters = []
    if order_ids:
        billing_filters.append(Billing.order_id.in_(order_ids))
    if contact_order_ids:
        billing_filters.append(Billing.contact_lens_id.in_(contact_order_ids))
    billing_ids = (
        list(source.scalars(select(Billing.id).where(or_(*billing_filters)))) if billing_filters else []
    )

    rows = {
        "companies": 1,
        "clinics": len(clinic_ids),
        "users": len(user_ids),
        "settings": count(Settings, Settings.clinic_id.in_(clinic_ids)) if clinic_ids else 0,
        "lookups": sum(count(model, model.clinic_id.in_(clinic_ids)) for model in LOOKUP_MODELS) if clinic_ids else 0,
        "exam_layouts": count(ExamLayout, ExamLayout.clinic_id.in_(clinic_ids)) if clinic_ids else 0,
        "families": count(Family, Family.clinic_id.in_(clinic_ids)) if clinic_ids else 0,
        "clients": len(client_ids),
        "medical_logs": count(MedicalLog, MedicalLog.client_id.in_(client_ids)) if client_ids else 0,
        "optical_exams": len(exam_ids),
        "exam_layout_instances": count(ExamLayoutInstance, ExamLayoutInstance.exam_id.in_(exam_ids)) if exam_ids else 0,
        "orders": len(order_ids),
        "contact_lens_orders": len(contact_order_ids),
        "billings": len(billing_ids),
        "order_line_item": count(OrderLineItem, OrderLineItem.billings_id.in_(billing_ids)) if billing_ids else 0,
        "referrals": len(referral_ids),
        "referral_eye": count(ReferralEye, ReferralEye.referral_id.in_(referral_ids)) if referral_ids else 0,
        "appointments": len(appointment_ids),
        "email_logs": count(EmailLog, EmailLog.appointment_id.in_(appointment_ids)) if appointment_ids else 0,
        "campaigns": count(Campaign, Campaign.clinic_id.in_(clinic_ids)) if clinic_ids else 0,
        "work_shifts": count(WorkShift, WorkShift.user_id.in_(user_ids)) if user_ids else 0,
        "chats": count(Chat, Chat.clinic_id.in_(clinic_ids)) if clinic_ids else 0,
        "files": count(File, File.client_id.in_(client_ids)) if client_ids else 0,
    }
    for table, value in rows.items():
        print(f"{table}: {value}")


def duplicate_account(args: argparse.Namespace) -> None:
    source_url, target_url = _resolve_database_urls(args)
    if _db_identity(source_url) == _db_identity(target_url):
        raise SystemExit("Source and target database identities are the same; refusing to continue.")

    Source = _session_factory(source_url)
    Target = _session_factory(target_url)

    with Source() as source, Target() as target:
        company, ceo_user = _find_account(source, args.ceo_email)
        clinics = source.scalars(select(Clinic).where(Clinic.company_id == company.id).order_by(Clinic.id)).all()
        clinic_ids = [clinic.id for clinic in clinics]
        users = source.scalars(select(User).where(User.company_id == company.id).order_by(User.id)).all()
        user_ids = [user.id for user in users]
        clients = source.scalars(select(Client).where(Client.company_id == company.id).order_by(Client.id)).all()
        client_ids = [client.id for client in clients]

        print(f"Source: {_redacted_url(source_url)}")
        print(f"Target: {_redacted_url(target_url)}")
        print(f"Account: {company.id} {company.name}")
        print(f"Matched CEO/user: {ceo_user.id} {ceo_user.email}")
        _print_counts(source, company.id, clinic_ids, user_ids, client_ids)

        if not args.execute:
            print("Dry run only. Re-run with --execute to copy this account.")
            return

        try:
            _prepare_target_for_copy(target, users)

            copied_company = _copy_row(
                target,
                company,
                whatsapp_access_token=None,
                whatsapp_phone_number_id=None,
                whatsapp_business_account_id=None,
                whatsapp_verify_token=None,
            )

            clinic_map: dict[int, int] = {}
            for clinic in clinics:
                copied = _copy_row(
                    target,
                    clinic,
                    company_id=copied_company.id,
                    unique_id=_unique_clinic_id(target, clinic.unique_id, clinic.id),
                )
                clinic_map[clinic.id] = copied.id

            user_map: dict[int, int] = {}
            for user in users:
                copied = _copy_row(
                    target,
                    user,
                    company_id=copied_company.id,
                    clinic_id=_mapped(clinic_map, user.clinic_id),
                    google_account_connected=False,
                    google_account_email=None,
                    google_access_token=None,
                    google_refresh_token=None,
                )
                user_map[user.id] = copied.id

            for settings in source.scalars(select(Settings).where(Settings.clinic_id.in_(clinic_ids))).all():
                _copy_row(
                    target,
                    settings,
                    clinic_id=clinic_map[settings.clinic_id],
                    email_password=None,
                )

            for model in LOOKUP_MODELS:
                for row in source.scalars(select(model).where(model.clinic_id.in_(clinic_ids))).all():
                    _copy_row(target, row, clinic_id=clinic_map[row.clinic_id])

            layout_map: dict[int, int] = {}
            layouts = source.scalars(select(ExamLayout).where(ExamLayout.clinic_id.in_(clinic_ids)).order_by(ExamLayout.id)).all()
            for layout in layouts:
                copied = _copy_row(
                    target,
                    layout,
                    clinic_id=clinic_map.get(layout.clinic_id),
                    parent_layout_id=None,
                )
                layout_map[layout.id] = copied.id
            for layout in layouts:
                if layout.parent_layout_id and layout.parent_layout_id in layout_map:
                    target.get(ExamLayout, layout_map[layout.id]).parent_layout_id = layout_map[layout.parent_layout_id]
            target.flush()

            family_map: dict[int, int] = {}
            for family in source.scalars(select(Family).where(Family.clinic_id.in_(clinic_ids)).order_by(Family.id)).all():
                copied = _copy_row(
                    target,
                    family,
                    company_id=copied_company.id,
                    clinic_id=clinic_map.get(family.clinic_id),
                )
                family_map[family.id] = copied.id

            client_map: dict[int, int] = {}
            for client in clients:
                copied = _copy_row(
                    target,
                    client,
                    company_id=copied_company.id,
                    clinic_id=_mapped(clinic_map, client.clinic_id),
                    family_id=_mapped(family_map, client.family_id),
                )
                client_map[client.id] = copied.id

            for log in source.scalars(select(MedicalLog).where(MedicalLog.client_id.in_(client_ids))).all():
                _copy_row(
                    target,
                    log,
                    client_id=client_map[log.client_id],
                    clinic_id=_mapped(clinic_map, log.clinic_id),
                    user_id=_mapped(user_map, log.user_id),
                )

            exam_map: dict[int, int] = {}
            for exam in source.scalars(select(OpticalExam).where(OpticalExam.client_id.in_(client_ids)).order_by(OpticalExam.id)).all():
                copied = _copy_row(
                    target,
                    exam,
                    client_id=client_map[exam.client_id],
                    clinic_id=_mapped(clinic_map, exam.clinic_id),
                    user_id=_mapped(user_map, exam.user_id),
                )
                exam_map[exam.id] = copied.id

            if exam_map:
                for instance in source.scalars(select(ExamLayoutInstance).where(ExamLayoutInstance.exam_id.in_(exam_map.keys()))).all():
                    _copy_row(
                        target,
                        instance,
                        exam_id=exam_map[instance.exam_id],
                        layout_id=_mapped(layout_map, instance.layout_id),
                    )

            order_map: dict[int, int] = {}
            for order in source.scalars(select(Order).where(Order.client_id.in_(client_ids)).order_by(Order.id)).all():
                copied = _copy_row(
                    target,
                    order,
                    client_id=client_map[order.client_id],
                    clinic_id=_mapped(clinic_map, order.clinic_id),
                    user_id=_mapped(user_map, order.user_id),
                )
                order_map[order.id] = copied.id

            contact_order_map: dict[int, int] = {}
            for order in source.scalars(select(ContactLensOrder).where(ContactLensOrder.client_id.in_(client_ids)).order_by(ContactLensOrder.id)).all():
                copied = _copy_row(
                    target,
                    order,
                    client_id=client_map[order.client_id],
                    clinic_id=_mapped(clinic_map, order.clinic_id),
                    user_id=_mapped(user_map, order.user_id),
                    supply_in_clinic_id=_mapped(clinic_map, order.supply_in_clinic_id),
                )
                contact_order_map[order.id] = copied.id

            billing_filters = []
            if order_map:
                billing_filters.append(Billing.order_id.in_(order_map.keys()))
            if contact_order_map:
                billing_filters.append(Billing.contact_lens_id.in_(contact_order_map.keys()))
            billing_map: dict[int, int] = {}
            billings = source.scalars(select(Billing).where(or_(*billing_filters))).all() if billing_filters else []
            for billing in billings:
                copied = _copy_row(
                    target,
                    billing,
                    order_id=_mapped(order_map, billing.order_id),
                    contact_lens_id=_mapped(contact_order_map, billing.contact_lens_id),
                )
                billing_map[billing.id] = copied.id

            if billing_map:
                for item in source.scalars(select(OrderLineItem).where(OrderLineItem.billings_id.in_(billing_map.keys()))).all():
                    _copy_row(target, item, billings_id=billing_map[item.billings_id])

            referral_map: dict[int, int] = {}
            for referral in source.scalars(select(Referral).where(Referral.client_id.in_(client_ids)).order_by(Referral.id)).all():
                copied = _copy_row(
                    target,
                    referral,
                    client_id=client_map[referral.client_id],
                    clinic_id=_mapped(clinic_map, referral.clinic_id),
                    user_id=_mapped(user_map, referral.user_id),
                )
                referral_map[referral.id] = copied.id

            if referral_map:
                for eye in source.scalars(select(ReferralEye).where(ReferralEye.referral_id.in_(referral_map.keys()))).all():
                    _copy_row(target, eye, referral_id=referral_map[eye.referral_id])

            appointment_map: dict[int, int] = {}
            for appointment in source.scalars(select(Appointment).where(Appointment.client_id.in_(client_ids)).order_by(Appointment.id)).all():
                copied = _copy_row(
                    target,
                    appointment,
                    client_id=client_map[appointment.client_id],
                    clinic_id=_mapped(clinic_map, appointment.clinic_id),
                    user_id=_mapped(user_map, appointment.user_id),
                    google_calendar_event_id=None,
                )
                appointment_map[appointment.id] = copied.id

            if appointment_map:
                for log in source.scalars(select(EmailLog).where(EmailLog.appointment_id.in_(appointment_map.keys()))).all():
                    _copy_row(target, log, appointment_id=appointment_map[log.appointment_id])

            campaign_map: dict[int, int] = {}
            for campaign in source.scalars(select(Campaign).where(Campaign.clinic_id.in_(clinic_ids)).order_by(Campaign.id)).all():
                copied = _copy_row(target, campaign, clinic_id=_mapped(clinic_map, campaign.clinic_id), active=False)
                campaign_map[campaign.id] = copied.id

            if campaign_map:
                for execution in source.scalars(
                    select(CampaignClientExecution).where(CampaignClientExecution.campaign_id.in_(campaign_map.keys()))
                ).all():
                    if execution.client_id in client_map:
                        _copy_row(
                            target,
                            execution,
                            campaign_id=campaign_map[execution.campaign_id],
                            client_id=client_map[execution.client_id],
                        )

            for shift in source.scalars(select(WorkShift).where(WorkShift.user_id.in_(user_ids))).all():
                _copy_row(target, shift, user_id=user_map[shift.user_id])

            chat_map: dict[int, int] = {}
            for chat in source.scalars(select(Chat).where(Chat.clinic_id.in_(clinic_ids)).order_by(Chat.id)).all():
                copied = _copy_row(target, chat, clinic_id=_mapped(clinic_map, chat.clinic_id))
                chat_map[chat.id] = copied.id
            if chat_map:
                for message in source.scalars(select(ChatMessage).where(ChatMessage.chat_id.in_(chat_map.keys()))).all():
                    _copy_row(target, message, chat_id=chat_map[message.chat_id])

            if args.include_file_metadata:
                for file in source.scalars(select(File).where(File.client_id.in_(client_ids))).all():
                    _copy_row(
                        target,
                        file,
                        client_id=client_map[file.client_id],
                        clinic_id=_mapped(clinic_map, file.clinic_id),
                        uploaded_by=_mapped(user_map, file.uploaded_by),
                    )

            target.commit()
            print(f"Copied production account {company.id} to staging account {copied_company.id}.")
        except Exception:
            target.rollback()
            raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Duplicate a production account into staging by CEO email.")
    parser.add_argument("ceo_email", help="CEO/contact email for the production account.")
    parser.add_argument("--source-database-url", help="Defaults to PRODUCTION_DATABASE_URL from .env.")
    parser.add_argument("--target-database-url", help="Defaults to STAGING_DATABASE_URL, TARGET_DATABASE_URL, then DATABASE_URL.")
    parser.add_argument(
        "--include-file-metadata",
        action="store_true",
        help="Copy files table rows only. This does not copy Supabase storage objects.",
    )
    parser.add_argument("--execute", action="store_true", help="Actually write to staging. Omit for a dry run.")
    return parser.parse_args()


if __name__ == "__main__":
    duplicate_account(parse_args())
