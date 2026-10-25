from datetime import date

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

import EndPoints.search as search_endpoint
from database import Base
from models import Client, Clinic, Company, User


def test_client_preview_is_paginated_and_clinic_scoped(monkeypatch):
    engine = create_engine("sqlite://")

    @event.listens_for(engine, "connect")
    def connect(connection, _record):
        connection.create_function("concat", -1, lambda *values: "".join(str(value) for value in values if value is not None))

    Base.metadata.create_all(engine)
    with sessionmaker(bind=engine)() as db:
        company = Company(name="Test", owner_full_name="Test")
        db.add(company)
        db.flush()
        clinic = Clinic(company_id=company.id, name="Allowed", unique_id="allowed")
        other = Clinic(company_id=company.id, name="Other", unique_id="other")
        db.add_all([clinic, other])
        db.flush()
        client = Client(company_id=company.id, clinic_id=clinic.id, first_name="Dana", national_id="001234567", phone_mobile="0501234567", email="dana@example.test", date_of_birth=date(1990, 4, 23), address_street="Herzl", address_number="12", address_city="Haifa", health_fund="Maccabi", hidden_note="Do not return")
        sparse = Client(company_id=company.id, clinic_id=clinic.id, first_name="Dana")
        foreign = Client(company_id=company.id, clinic_id=other.id, first_name="Dana", email="private@example.test")
        db.add_all([client, sparse, foreign])
        db.flush()
        merged = Client(company_id=company.id, clinic_id=clinic.id, first_name="Dana", merged_into_client_id=client.id)
        db.add(merged)
        db.commit()
        monkeypatch.setattr(search_endpoint, "get_allowed_clinic_ids", lambda *_args: [clinic.id])
        response = search_endpoint.unified_search(q="Dana", clinic_id=clinic.id, limit=1, offset=1, db=db, current_user=User())
        assert response["total"] == 2
        assert len(response["items"]) == 1
        item = response["items"][0]
        assert item["id"] == client.id
        assert item["title"] == "Dana "
        assert item["subtitle"] == "001234567"
        assert item["description"] == "Haifa Herzl"
        assert item["client_details"]["email"] == "dana@example.test"
        assert item["client_details"]["date_of_birth"] == date(1990, 4, 23)
        assert item["client_details"]["address_number"] == "12"
        assert item["client_details"]["phone_home"] is None
        assert "hidden_note" not in item["client_details"]
        assert "notes" not in item["client_details"]

        first_page = search_endpoint.unified_search(q="Dana", clinic_id=clinic.id, limit=1, offset=0, db=db, current_user=User())
        assert first_page["items"][0]["id"] == sparse.id
        assert first_page["items"][0]["client_details"]["email"] is None

        monkeypatch.setattr(search_endpoint, "get_allowed_clinic_ids", lambda *_args: [])
        assert search_endpoint.unified_search(q="Dana", clinic_id=clinic.id, limit=1, offset=0, db=db, current_user=User()) == {"items": [], "total": 0}
