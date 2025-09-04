from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, func, literal, cast, String, case
from typing import Optional
from database import get_db
from models import Client, OpticalExam, MedicalLog, Family, Referral, Appointment, Campaign

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def unified_search(
    q: str = Query(..., min_length=1),
    clinic_id: Optional[int] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    term = f"%{q}%"

    items_selects = []
    counts = []

    # Clients
    clients_filter = [
        or_(
            Client.first_name.ilike(term),
            Client.last_name.ilike(term),
            Client.national_id.ilike(term),
            Client.phone_mobile.ilike(term),
            Client.phone_home.ilike(term),
            Client.email.ilike(term),
            Client.address_city.ilike(term),
            Client.address_street.ilike(term),
            cast(Client.date_of_birth, String).ilike(term),
        )
    ]
    if clinic_id is not None:
        clients_filter.append(Client.clinic_id == clinic_id)
    clients_q = db.query(
        literal("client").label("type"),
        Client.id.label("id"),
        func.concat(func.coalesce(Client.first_name, ""), literal(" "), func.coalesce(Client.last_name, "")).label("title"),
        Client.national_id.label("subtitle"),
        func.concat(func.coalesce(Client.address_city, ""), literal(" "), func.coalesce(Client.address_street, "")).label("description"),
        cast(Client.file_creation_date, String).label("sort_date"),
        Client.id.label("client_id"),
    ).filter(*clients_filter)
    items_selects.append(clients_q)
    counts.append(db.query(func.count(Client.id)).filter(*clients_filter))

    # Exams
    exams_filter = [
        or_(
            cast(OpticalExam.exam_date, String).ilike(term),
            OpticalExam.test_name.ilike(term),
        )
    ]
    if clinic_id is not None:
        exams_filter.append(OpticalExam.clinic_id == clinic_id)
    exams_q = db.query(
        literal("exam").label("type"),
        OpticalExam.id.label("id"),
        func.coalesce(OpticalExam.test_name, literal("בדיקה")).label("title"),
        cast(OpticalExam.exam_date, String).label("subtitle"),
        literal("").label("description"),
        cast(OpticalExam.exam_date, String).label("sort_date"),
        OpticalExam.client_id.label("client_id"),
    ).filter(*exams_filter)
    items_selects.append(exams_q)
    counts.append(db.query(func.count(OpticalExam.id)).filter(*exams_filter))

    # Medical Logs
    medical_filter = [MedicalLog.log.ilike(term)]
    if clinic_id is not None:
        medical_filter.append(MedicalLog.clinic_id == clinic_id)
    medical_q = db.query(
        literal("medical-log").label("type"),
        MedicalLog.id.label("id"),
        literal("רישום רפואי").label("title"),
        cast(MedicalLog.log_date, String).label("subtitle"),
        MedicalLog.log.label("description"),
        cast(MedicalLog.log_date, String).label("sort_date"),
        MedicalLog.client_id.label("client_id"),
    ).filter(*medical_filter)
    items_selects.append(medical_q)
    counts.append(db.query(func.count(MedicalLog.id)).filter(*medical_filter))

    # Families
    families_filter = [Family.name.ilike(term)]
    if clinic_id is not None:
        families_filter.append(Family.clinic_id == clinic_id)
    families_q = db.query(
        literal("family").label("type"),
        Family.id.label("id"),
        Family.name.label("title"),
        literal("משפחה").label("subtitle"),
        Family.notes.label("description"),
        cast(Family.created_date, String).label("sort_date"),
        literal(None).label("client_id"),
    ).filter(*families_filter)
    items_selects.append(families_q)
    counts.append(db.query(func.count(Family.id)).filter(*families_filter))

    # Referrals
    referrals_filter = [
        or_(
            Referral.referral_notes.ilike(term),
            Referral.prescription_notes.ilike(term),
            cast(Referral.date, String).ilike(term),
        )
    ]
    if clinic_id is not None:
        referrals_filter.append(Referral.clinic_id == clinic_id)
    referrals_q = db.query(
        literal("referral").label("type"),
        Referral.id.label("id"),
        literal("הפניה").label("title"),
        cast(Referral.date, String).label("subtitle"),
        Referral.referral_notes.label("description"),
        cast(Referral.date, String).label("sort_date"),
        Referral.client_id.label("client_id"),
    ).filter(*referrals_filter)
    items_selects.append(referrals_q)
    counts.append(db.query(func.count(Referral.id)).filter(*referrals_filter))

    # Appointments
    appointments_filter = [
        or_(
            cast(Appointment.date, String).ilike(term),
            cast(Appointment.time, String).ilike(term),
            Appointment.exam_name.ilike(term),
            Appointment.note.ilike(term),
        )
    ]
    if clinic_id is not None:
        appointments_filter.append(Appointment.clinic_id == clinic_id)
    appointments_q = db.query(
        literal("appointment").label("type"),
        Appointment.id.label("id"),
        func.coalesce(Appointment.exam_name, literal("תור")).label("title"),
        func.concat(cast(Appointment.date, String), literal(" "), func.coalesce(Appointment.time, literal("")).cast(String)).label("subtitle"),
        Appointment.note.label("description"),
        cast(Appointment.date, String).label("sort_date"),
        Appointment.client_id.label("client_id"),
    ).filter(*appointments_filter)
    items_selects.append(appointments_q)
    counts.append(db.query(func.count(Appointment.id)).filter(*appointments_filter))

    # Campaigns
    campaigns_filter = [Campaign.name.ilike(term)]
    if clinic_id is not None:
        campaigns_filter.append(Campaign.clinic_id == clinic_id)
    campaigns_q = db.query(
        literal("campaign").label("type"),
        Campaign.id.label("id"),
        Campaign.name.label("title"),
        literal("קמפיין").label("subtitle"),
        case((Campaign.active == True, literal("פעיל")), else_=literal("לא פעיל")).label("description"),
        cast(Campaign.created_at, String).label("sort_date"),
        literal(None).label("client_id"),
    ).filter(*campaigns_filter)
    items_selects.append(campaigns_q)
    counts.append(db.query(func.count(Campaign.id)).filter(*campaigns_filter))

    # Union all
    union_query = items_selects[0]
    for qy in items_selects[1:]:
        union_query = union_query.union_all(qy)

    # Create subquery and query with explicit column access
    subq = union_query.subquery()
    ordered = db.query(
        subq.c.type,
        subq.c.id,
        subq.c.title,
        subq.c.subtitle,
        subq.c.description,
        subq.c.sort_date,
        subq.c.client_id
    ).order_by(
        func.nulls_last(func.desc(subq.c.sort_date)),
        func.desc(subq.c.id)
    ).offset(offset).limit(limit)

    rows = ordered.all()
    total = 0
    for cnt in counts:
        total += cnt.scalar() or 0

    items = [
        {
            "type": r[0],
            "id": r[1],
            "title": r[2],
            "subtitle": r[3],
            "description": r[4],
            "client_id": r[6],
        }
        for r in rows
    ]

    return {"items": items, "total": total}


