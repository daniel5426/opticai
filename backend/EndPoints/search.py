from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session, aliased
from sqlalchemy import or_, func, literal, literal_column, cast, String, case
from typing import Optional
from database import get_db
from models import Client, OpticalExam, MedicalLog, Family, Referral, Appointment, Campaign, User, PrescriptionSearchIndex
from schemas import PrescriptionSearchRequest, PrescriptionSearchResponse
from auth import get_current_user
from security.scope import get_allowed_clinic_ids
from services.clinic_catalog import scope_conditions

router = APIRouter(prefix="/search", tags=["search"])


@router.post("/prescription", response_model=PrescriptionSearchResponse)
def prescription_search(
    request: PrescriptionSearchRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from services.prescription_matching import legacy_search
    allowed = get_allowed_clinic_ids(db, current_user, request.clinic_id)
    return legacy_search(db, allowed, request)


@router.get("")
def unified_search(
    q: str = Query(..., min_length=1),
    clinic_id: Optional[int] = Query(None),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Split query into individual terms for better matching
    search_terms = q.strip().split()
    if not search_terms:
        search_terms = [q]

    # If no valid search terms, return empty result
    if not search_terms or all(not term.strip() for term in search_terms):
        return {"items": [], "total": 0}

    allowed_clinic_ids = get_allowed_clinic_ids(db, current_user, clinic_id)
    if not allowed_clinic_ids:
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

    # Clients
    client_fields = [
        Client.first_name, Client.last_name, Client.national_id,
        Client.phone_mobile, Client.phone_home, Client.email,
        Client.address_city, Client.address_street,
        cast(Client.date_of_birth, String)
    ]
    client_condition = create_entity_condition(Client, client_fields, search_terms)
    client_score = create_score_expression(client_fields, search_terms)

    clients_filter = scope_conditions(Client, allowed_clinic_ids)
    if client_condition is not None:
        clients_filter.append(client_condition)
    clients_filter.append(Client.clinic_id.in_(allowed_clinic_ids))
    clients_filter.append(Client.merged_into_client_id.is_(None))

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

    # Exams
    exam_fields = [OpticalExam.test_name, cast(OpticalExam.exam_date, String)]
    exam_condition = create_entity_condition(OpticalExam, exam_fields, search_terms)
    exam_score = create_score_expression(exam_fields, search_terms)

    exams_filter = scope_conditions(OpticalExam, allowed_clinic_ids)
    if exam_condition is not None:
        exams_filter.append(exam_condition)
    exams_filter.append(OpticalExam.clinic_id.in_(allowed_clinic_ids))

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

    # Medical Logs
    medical_fields = [MedicalLog.log]
    medical_condition = create_entity_condition(MedicalLog, medical_fields, search_terms)
    medical_score = create_score_expression(medical_fields, search_terms)

    medical_filter = scope_conditions(MedicalLog, allowed_clinic_ids)
    if medical_condition is not None:
        medical_filter.append(medical_condition)
    medical_filter.append(MedicalLog.clinic_id.in_(allowed_clinic_ids))

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

    # Families
    family_fields = [Family.name]
    family_condition = create_entity_condition(Family, family_fields, search_terms)
    family_score = create_score_expression(family_fields, search_terms)

    families_filter = scope_conditions(Family, allowed_clinic_ids)
    if family_condition is not None:
        families_filter.append(family_condition)
    families_filter.append(Family.clinic_id.in_(allowed_clinic_ids))

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

    # Referrals
    referral_fields = [
        Referral.referral_notes, Referral.prescription_notes,
        cast(Referral.date, String)
    ]
    referral_condition = create_entity_condition(Referral, referral_fields, search_terms)
    referral_score = create_score_expression(referral_fields, search_terms)

    referrals_filter = scope_conditions(Referral, allowed_clinic_ids)
    if referral_condition is not None:
        referrals_filter.append(referral_condition)
    referrals_filter.append(Referral.clinic_id.in_(allowed_clinic_ids))

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

    # Appointments
    appointment_fields = [
        cast(Appointment.date, String), cast(Appointment.time, String),
        Appointment.exam_name, Appointment.note
    ]
    appointment_condition = create_entity_condition(Appointment, appointment_fields, search_terms)
    appointment_score = create_score_expression(appointment_fields, search_terms)

    appointments_filter = scope_conditions(Appointment, allowed_clinic_ids)
    if appointment_condition is not None:
        appointments_filter.append(appointment_condition)
    appointments_filter.append(Appointment.clinic_id.in_(allowed_clinic_ids))

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

    # Campaigns
    campaign_fields = [Campaign.name]
    campaign_condition = create_entity_condition(Campaign, campaign_fields, search_terms)
    campaign_score = create_score_expression(campaign_fields, search_terms)

    campaigns_filter = scope_conditions(Campaign, allowed_clinic_ids)
    if campaign_condition is not None:
        campaigns_filter.append(campaign_condition)
    campaigns_filter.append(Campaign.clinic_id.in_(allowed_clinic_ids))

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

    # Each entity is queried on its own: one UNION across all of them gave the planner
    # row estimates so wrong that searches hit the statement timeout. Every branch returns
    # its best `offset + limit` rows plus its exact match count (a window count, so no
    # second scan); merging them reproduces the global score/date/id ordering.
    rows = []
    total = 0
    for branch in items_selects:
        branch_rows = (
            branch.add_columns(func.count().over().label("branch_total"))
            .order_by(
                # Bare output names only: Postgres rejects aliases inside expressions. Scores
                # are `0 + CASE ...` sums, so they are never NULL.
                literal_column("score").desc(),
                literal_column("sort_date").desc().nulls_last(),
                literal_column("id").desc(),
            )
            .limit(offset + limit)
            .all()
        )
        if branch_rows:
            total += branch_rows[0][8]
        rows.extend(branch_rows)
    rows.sort(key=lambda row: row[1] or 0, reverse=True)
    rows.sort(key=lambda row: (row[6] is not None, row[6] or ""), reverse=True)
    rows.sort(key=lambda row: row[5] or 0, reverse=True)
    rows = rows[offset:offset + limit]

    items = [
        {
            "type": r[0],
            "id": r[1],
            "title": r[2],
            "subtitle": r[3],
            "description": r[4],
            "client_id": r[7],
        }
        for r in rows
    ]

    # Enrich only client hits on this page, with one clinic-scoped query.
    # Existing result fields remain intact for older desktop clients.
    client_ids = [item["id"] for item in items if item["type"] == "client"]
    if client_ids:
        detail_fields = (
            "national_id", "phone_mobile", "phone_home", "phone_work",
            "additional_phone", "email", "date_of_birth", "health_fund",
            "address_city", "address_street", "address_number", "postal_code",
        )
        clients = db.query(Client.id, *(getattr(Client, field) for field in detail_fields)).filter(
            Client.id.in_(client_ids),
            Client.clinic_id.in_(allowed_clinic_ids),
            Client.merged_into_client_id.is_(None),
        ).all()
        client_details = {
            client.id: {field: getattr(client, field) for field in detail_fields}
            for client in clients
        }
        for item in items:
            if item["type"] == "client" and item["id"] in client_details:
                item["client_details"] = client_details[item["id"]]

    return {"items": items, "total": total}
