from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_, func, literal, cast, String, case
from typing import Optional
from database import get_db
from models import Client, OpticalExam, MedicalLog, Family, Referral, Appointment, Campaign

router = APIRouter(prefix="/search", tags=["search"])


@router.get("")
def unified_search(
    q: str = Query(..., min_length=1),
    clinic_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    # Split query into individual terms for better matching
    search_terms = q.strip().split()
    if not search_terms:
        search_terms = [q]

    # If no valid search terms, return empty result
    if not search_terms or all(not term.strip() for term in search_terms):
        return {"items": [], "total": 0}

    # Create efficient search conditions for each entity type
    def create_entity_condition(entity_class, fields, terms):
        """Create OR condition for an entity type across multiple fields and terms"""
        conditions = []
        for field in fields:
            for term in terms:
                conditions.append(field.ilike(f"%{term}%"))
        return or_(*conditions) if conditions else None

    # Create scoring function for relevance ranking
    def create_score_expression(fields, terms):
        """Create a score expression that counts how many search terms are matched"""
        score_conditions = []
        for term in terms:
            term_matches = []
            for field in fields:
                term_matches.append(field.ilike(f"%{term}%"))

            # Count how many fields match this term (0 or 1)
            score_conditions.append(
                case((or_(*term_matches), 1), else_=0)
            )

        return sum(score_conditions) if score_conditions else literal(0)

    items_selects = []
    counts = []

    # Clients
    client_fields = [
        Client.first_name, Client.last_name, Client.national_id,
        Client.phone_mobile, Client.phone_home, Client.email,
        Client.address_city, Client.address_street,
        cast(Client.date_of_birth, String)
    ]
    client_condition = create_entity_condition(Client, client_fields, search_terms)
    client_score = create_score_expression(client_fields, search_terms)

    clients_filter = []
    if client_condition is not None:
        clients_filter.append(client_condition)
    if clinic_id is not None:
        clients_filter.append(Client.clinic_id == clinic_id)

    clients_q = db.query(
        literal("client").label("type"),
        Client.id.label("id"),
        func.concat(func.coalesce(Client.first_name, ""), literal(" "), func.coalesce(Client.last_name, "")).label("title"),
        Client.national_id.label("subtitle"),
        func.concat(func.coalesce(Client.address_city, ""), literal(" "), func.coalesce(Client.address_street, "")).label("description"),
        client_score.label("score"),
        cast(Client.file_creation_date, String).label("sort_date"),
        Client.id.label("client_id"),
    ).filter(*clients_filter)
    items_selects.append(clients_q)
    counts.append(db.query(func.count(Client.id)).filter(*clients_filter))

    # Exams
    exam_fields = [OpticalExam.test_name, cast(OpticalExam.exam_date, String)]
    exam_condition = create_entity_condition(OpticalExam, exam_fields, search_terms)
    exam_score = create_score_expression(exam_fields, search_terms)

    exams_filter = []
    if exam_condition is not None:
        exams_filter.append(exam_condition)
    if clinic_id is not None:
        exams_filter.append(OpticalExam.clinic_id == clinic_id)

    exams_q = db.query(
        literal("exam").label("type"),
        OpticalExam.id.label("id"),
        func.coalesce(OpticalExam.test_name, literal("בדיקה")).label("title"),
        cast(OpticalExam.exam_date, String).label("subtitle"),
        literal("").label("description"),
        exam_score.label("score"),
        cast(OpticalExam.exam_date, String).label("sort_date"),
        OpticalExam.client_id.label("client_id"),
    ).filter(*exams_filter)
    items_selects.append(exams_q)
    counts.append(db.query(func.count(OpticalExam.id)).filter(*exams_filter))

    # Medical Logs
    medical_fields = [MedicalLog.log]
    medical_condition = create_entity_condition(MedicalLog, medical_fields, search_terms)
    medical_score = create_score_expression(medical_fields, search_terms)

    medical_filter = []
    if medical_condition is not None:
        medical_filter.append(medical_condition)
    if clinic_id is not None:
        medical_filter.append(MedicalLog.clinic_id == clinic_id)

    medical_q = db.query(
        literal("medical-log").label("type"),
        MedicalLog.id.label("id"),
        literal("רישום רפואי").label("title"),
        cast(MedicalLog.log_date, String).label("subtitle"),
        MedicalLog.log.label("description"),
        medical_score.label("score"),
        cast(MedicalLog.log_date, String).label("sort_date"),
        MedicalLog.client_id.label("client_id"),
    ).filter(*medical_filter)
    items_selects.append(medical_q)
    counts.append(db.query(func.count(MedicalLog.id)).filter(*medical_filter))

    # Families
    family_fields = [Family.name]
    family_condition = create_entity_condition(Family, family_fields, search_terms)
    family_score = create_score_expression(family_fields, search_terms)

    families_filter = []
    if family_condition is not None:
        families_filter.append(family_condition)
    if clinic_id is not None:
        families_filter.append(Family.clinic_id == clinic_id)

    families_q = db.query(
        literal("family").label("type"),
        Family.id.label("id"),
        Family.name.label("title"),
        literal("משפחה").label("subtitle"),
        Family.notes.label("description"),
        family_score.label("score"),
        cast(Family.created_date, String).label("sort_date"),
        literal(None).label("client_id"),
    ).filter(*families_filter)
    items_selects.append(families_q)
    counts.append(db.query(func.count(Family.id)).filter(*families_filter))

    # Referrals
    referral_fields = [
        Referral.referral_notes, Referral.prescription_notes,
        cast(Referral.date, String)
    ]
    referral_condition = create_entity_condition(Referral, referral_fields, search_terms)
    referral_score = create_score_expression(referral_fields, search_terms)

    referrals_filter = []
    if referral_condition is not None:
        referrals_filter.append(referral_condition)
    if clinic_id is not None:
        referrals_filter.append(Referral.clinic_id == clinic_id)

    referrals_q = db.query(
        literal("referral").label("type"),
        Referral.id.label("id"),
        literal("הפניה").label("title"),
        cast(Referral.date, String).label("subtitle"),
        Referral.referral_notes.label("description"),
        referral_score.label("score"),
        cast(Referral.date, String).label("sort_date"),
        Referral.client_id.label("client_id"),
    ).filter(*referrals_filter)
    items_selects.append(referrals_q)
    counts.append(db.query(func.count(Referral.id)).filter(*referrals_filter))

    # Appointments
    appointment_fields = [
        cast(Appointment.date, String), cast(Appointment.time, String),
        Appointment.exam_name, Appointment.note
    ]
    appointment_condition = create_entity_condition(Appointment, appointment_fields, search_terms)
    appointment_score = create_score_expression(appointment_fields, search_terms)

    appointments_filter = []
    if appointment_condition is not None:
        appointments_filter.append(appointment_condition)
    if clinic_id is not None:
        appointments_filter.append(Appointment.clinic_id == clinic_id)

    appointments_q = db.query(
        literal("appointment").label("type"),
        Appointment.id.label("id"),
        func.coalesce(Appointment.exam_name, literal("תור")).label("title"),
        func.concat(cast(Appointment.date, String), literal(" "), func.coalesce(Appointment.time, literal("")).cast(String)).label("subtitle"),
        Appointment.note.label("description"),
        appointment_score.label("score"),
        cast(Appointment.date, String).label("sort_date"),
        Appointment.client_id.label("client_id"),
    ).filter(*appointments_filter)
    items_selects.append(appointments_q)
    counts.append(db.query(func.count(Appointment.id)).filter(*appointments_filter))

    # Campaigns
    campaign_fields = [Campaign.name]
    campaign_condition = create_entity_condition(Campaign, campaign_fields, search_terms)
    campaign_score = create_score_expression(campaign_fields, search_terms)

    campaigns_filter = []
    if campaign_condition is not None:
        campaigns_filter.append(campaign_condition)
    if clinic_id is not None:
        campaigns_filter.append(Campaign.clinic_id == clinic_id)

    campaigns_q = db.query(
        literal("campaign").label("type"),
        Campaign.id.label("id"),
        Campaign.name.label("title"),
        literal("קמפיין").label("subtitle"),
        case((Campaign.active == True, literal("פעיל")), else_=literal("לא פעיל")).label("description"),
        campaign_score.label("score"),
        cast(Campaign.created_at, String).label("sort_date"),
        literal(None).label("client_id"),
    ).filter(*campaigns_filter)
    items_selects.append(campaigns_q)
    counts.append(db.query(func.count(Campaign.id)).filter(*campaigns_filter))

    # Union all
    union_query = items_selects[0]
    for qy in items_selects[1:]:
        union_query = union_query.union_all(qy)

    # Execute union query with pagination and scoring-based ordering
    # Use positional indexing to avoid column name issues
    subq = union_query.subquery()
    ordered = db.query(
        subq.c[0].label('type'),      # type
        subq.c[1].label('id'),        # id
        subq.c[2].label('title'),     # title
        subq.c[3].label('subtitle'),  # subtitle
        subq.c[4].label('description'), # description
        subq.c[5].label('score'),     # score
        subq.c[6].label('sort_date'), # sort_date
        subq.c[7].label('client_id')   # client_id
    ).order_by(
        func.coalesce(subq.c[5], 0).desc(),      # score column DESC
        subq.c[6].desc().nulls_last(),           # sort_date column DESC NULLS LAST
        subq.c[1].desc()                         # id column DESC
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


