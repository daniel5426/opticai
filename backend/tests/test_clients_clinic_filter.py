from models import Client, Clinic, User
from tests.test_table_search import _client, _seed, _session_factory


def test_clients_paginated_filters_by_clinic_or_all_clinics():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)
        owner = db.get(User, ids["current_user_id"])
        branch = Clinic(company_id=owner.company_id, name="Clinic B", unique_id="clinic-b")
        db.add(branch)
        db.flush()
        db.add(Client(company_id=owner.company_id, clinic_id=branch.id, first_name="Dana", last_name="Levi"))
        db.commit()
        main_clinic_id, branch_id = ids["clinic_id"], branch.id

    def names(client, **params):
        response = client.get("/api/v1/clients/paginated", params=params)
        assert response.status_code == 200
        return {item["last_name"] for item in response.json()["items"]}

    with _client(SessionLocal, ids["current_user_id"]) as client:
        assert names(client, clinic_id=branch_id) == {"Levi"}
        assert names(client, clinic_id=main_clinic_id) == {"Smith", "Cohen"}
        assert names(client, clinic_id=main_clinic_id, all_clinics="true") == {"Smith", "Cohen", "Levi"}


def test_new_client_gets_todays_file_date_unless_one_is_given(monkeypatch):
    from datetime import date, datetime
    from EndPoints import clients as endpoint

    class IsraelEvening(datetime):
        @classmethod
        def now(cls, tz=None):
            # 01:30 in Israel is still the previous day in UTC.
            return datetime(2026, 11, 16, 1, 30, tzinfo=tz)

    monkeypatch.setattr(endpoint, "datetime", IsraelEvening)
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)

    with _client(SessionLocal, ids["current_user_id"]) as client:
        quick = client.post("/api/v1/clients/", json={"first_name": "Quick", "last_name": "Booking", "clinic_id": ids["clinic_id"]})
        chosen = client.post("/api/v1/clients/", json={"first_name": "Old", "last_name": "File", "clinic_id": ids["clinic_id"],
                                                       "file_creation_date": "2020-05-01"})
    assert quick.status_code == chosen.status_code == 200
    assert quick.json()["file_creation_date"] == "2026-11-16"
    assert chosen.json()["file_creation_date"] == "2020-05-01"
    with SessionLocal() as db:
        assert db.get(Client, quick.json()["id"]).file_creation_date == date(2026, 11, 16)
