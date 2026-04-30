from __future__ import annotations

from pathlib import Path
import sys

sys.path.append(str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.migration.optitech.src import phase2, records
from backend.migration.optitech.src.trace import load_trace_index
from models import Base, Client, Clinic, Company


def _build_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    return Session()


def _create_company_and_clinic(db):
    company = Company(name="Test Co", owner_full_name="Owner")
    db.add(company)
    db.flush()
    clinic = Clinic(company_id=company.id, name="Clinic", unique_id="clinic-test", is_active=True)
    db.add(clinic)
    db.commit()
    db.refresh(company)
    db.refresh(clinic)
    return company, clinic


def test_family_seed_prefers_head_name_and_detects_mixed_variants():
    client_seeds = [
        records.normalize_client_row({"PerId": "10", "LastName": "כהן", "FamId": "10"}),
        records.normalize_client_row({"PerId": "11", "LastName": "כהן", "FamId": "10"}),
        records.normalize_client_row({"PerId": "20", "LastName": "לוי", "FamId": "99"}),
        records.normalize_client_row({"PerId": "21", "LastName": "ל-וי", "FamId": "99"}),
        records.normalize_client_row({"PerId": "22", "LastName": "מזרחי", "FamId": "99"}),
    ]

    family_seeds, summary = phase2.build_family_seeds(client_seeds)

    assert [seed.legacy_family_id for seed in family_seeds] == [10, 99]
    assert family_seeds[0].family_name == "כהן"
    assert family_seeds[0].source_ref.raw_row_ref == "tblPerData_FamId:FamId=10"
    assert family_seeds[1].family_name in {"לוי", "ל-וי"}
    assert summary["head_name_match_count"] == 1
    assert summary["source_family_count"] == 2
    assert summary["mixed_last_name_family_sample"][0]["legacy_family_id"] == 99


def test_user_payload_mapping_applies_role_and_inactive_rules():
    inactive_seed = records.normalize_user_row(
        {"UserId": "203", "FirstName": "ראשונה", "LastName": "הפעלה", "LevelId": "5"}
    )
    active_seed = records.normalize_user_row(
        {"UserId": "248", "FirstName": "לנה", "LastName": "צרניאקוב", "LevelId": "4", "CellPhone": "050"}
    )

    inactive_payload = phase2.user_payload_from_seed(inactive_seed, clinic_id=1, company_id=2)
    active_payload = phase2.user_payload_from_seed(active_seed, clinic_id=1, company_id=2)

    assert inactive_payload["username"] == "optitech-user-203"
    assert inactive_payload["role_level"] == 4
    assert inactive_payload["is_active"] is False
    assert inactive_payload["password"] is None
    assert active_payload["role_level"] == 3
    assert active_payload["is_active"] is True
    assert active_payload["phone"] == "050"


def test_client_trace_rerun_updates_existing_target_without_duplicates():
    db = _build_session()
    company, clinic = _create_company_and_clinic(db)

    seed_v1 = records.normalize_client_row(
        {"PerId": "123", "FirstName": "Dana", "LastName": "Levi", "CellPhone": "050-111", "FamId": "0"}
    )
    counters_v1, skipped_v1 = phase2.upsert_clients(
        db,
        client_seeds=[seed_v1],
        family_target_ids={},
        clinic_id=clinic.id,
        company_id=company.id,
        unmapped_report={},
    )
    db.commit()

    seed_v2 = records.normalize_client_row(
        {"PerId": "123", "FirstName": "Dana", "LastName": "Levi", "CellPhone": "050-222", "FamId": "0"}
    )
    counters_v2, skipped_v2 = phase2.upsert_clients(
        db,
        client_seeds=[seed_v2],
        family_target_ids={},
        clinic_id=clinic.id,
        company_id=company.id,
        unmapped_report={},
    )
    db.commit()

    clients = db.query(Client).all()
    links_by_raw_ref, _ = load_trace_index(db, clinic_id=clinic.id, target_model="Client")

    assert skipped_v1 == []
    assert skipped_v2 == []
    assert counters_v1.created == 1
    assert counters_v2.updated == 1
    assert len(clients) == 1
    assert clients[0].phone_mobile == "050-222"
    assert links_by_raw_ref["tblPerData:PerId=123"].target_id == clients[0].id


def test_client_trace_recreates_deleted_target_and_repoints_trace():
    db = _build_session()
    company, clinic = _create_company_and_clinic(db)

    seed = records.normalize_client_row(
        {"PerId": "777", "FirstName": "Noa", "LastName": "Bar", "CellPhone": "050-111", "FamId": "0"}
    )
    phase2.upsert_clients(
        db,
        client_seeds=[seed],
        family_target_ids={},
        clinic_id=clinic.id,
        company_id=company.id,
        unmapped_report={},
    )
    db.commit()
    first_client = db.query(Client).one()
    first_client_id = first_client.id

    db.delete(first_client)
    db.commit()

    counters, skipped = phase2.upsert_clients(
        db,
        client_seeds=[seed],
        family_target_ids={},
        clinic_id=clinic.id,
        company_id=company.id,
        unmapped_report={},
    )
    db.commit()

    recreated_client = db.query(Client).one()
    links_by_raw_ref, _ = load_trace_index(db, clinic_id=clinic.id, target_model="Client")

    assert skipped == []
    assert counters.recreated == 1
    assert db.query(Client).count() == 1
    assert recreated_client.first_name == "Noa"
    assert links_by_raw_ref["tblPerData:PerId=777"].target_id == recreated_client.id
