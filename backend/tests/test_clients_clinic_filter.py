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
