import json

import pytest

from tests.test_table_search import _client, _seed, _session_factory


@pytest.fixture()
def api():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)
    with _client(SessionLocal, ids["current_user_id"]) as client:
        import EndPoints.families as families_endpoint
        import EndPoints.users as users_endpoint

        # The shared helper predates families; register it with the same user override.
        client.app.include_router(families_endpoint.router, prefix="/api/v1")
        client.app.dependency_overrides[families_endpoint.get_current_user] = client.app.dependency_overrides[users_endpoint.get_current_user]

        def total(path, filters, **params):
            response = client.get(path, params={"clinic_id": ids["clinic_id"], "filters": json.dumps(filters), **params})
            assert response.status_code == 200, (path, filters, response.text)
            return response.json()["total"]

        total.client = client
        total.clinic_id = ids["clinic_id"]
        yield total


# Every seeded row belongs to client "John Smith"; each case lists (filters, expected total).
CASES = {
    "/api/v1/referrals/paginated": [
        ({"client": "smith"}, 1),
        ({"client": "cohen"}, 0),
        ({"urgency": ["routine", "urgent"]}, 1),
        ({"urgency": ["emergency"]}, 0),
        ({"type": "special"}, 1),
        ({"recipient": "clinic"}, 0),
        ({"date": {"from": "2026-05-08", "to": "2026-05-08"}}, 1),
        ({"date": {"from": "2026-05-09"}}, 0),
    ],
    "/api/v1/appointments/paginated": [
        ({"client": "john"}, 1),
        ({"time": "09"}, 1),
        ({"exam_name": ["Follow up"]}, 1),
        ({"exam_name": ["Contact lens"]}, 0),
        ({"examiner": ["Alice Optic"]}, 1),
        ({"examiner": ["Admin User"]}, 0),
        ({"note": "annual"}, 1),
        ({"date": {"to": "2026-05-06"}}, 0),
    ],
    "/api/v1/exams/enriched": [
        ({"client": "smith"}, 1),
        ({"test_name": ["Routine exam"]}, 1),
        ({"test_name": ["Other"]}, 0),
        ({"examiner": "alice"}, 1),
        ({"examiner": "admin"}, 0),
        ({"exam_date": {"from": "2026-05-06", "to": "2026-05-06"}}, 1),
        ({"exam_date": {"from": "2026-05-07"}}, 0),
    ],
    "/api/v1/files/paginated": [
        ({"file_name": "john-file"}, 1),
        ({"file_name": "missing"}, 0),
        ({"type": ["document"]}, 1),
        ({"type": ["image", "video"]}, 0),
        ({"client": "smith"}, 1),
    ],
    # Two seeded users in "Clinic A": Admin User (role 4) and Alice Optic (role 2), both active.
    "/api/v1/users/paginated": [
        ({"name": "alice"}, 1),
        ({"role": ["2"]}, 1),
        ({"role": ["2", "4"]}, 2),
        ({"status": ["active"]}, 2),
        ({"status": ["inactive"]}, 0),
        ({"clinic": "clinic a"}, 2),
        ({"clinic": "גלובלי"}, 0),
        ({"id": "999999"}, 0),
    ],
    # Two seeded clients: John Smith (full details) and Sarah Cohen (names only).
    "/api/v1/clients/paginated": [
        ({"first_name": "jo"}, 1),
        ({"last_name": "cohen"}, 1),
        ({"national_id": "1234"}, 1),
        ({"phone_mobile": "052"}, 1),
        ({"email": "example.test"}, 1),
        ({"first_name": "a", "last_name": "smith"}, 0),
    ],
}


def test_families_filter_both_count_and_page(api):
    from database import get_db
    from models import Family

    db = next(api.client.app.dependency_overrides[get_db]())
    clinic = api.clinic_id
    db.add_all([Family(clinic_id=clinic, company_id=1, name="Levi"), Family(clinic_id=clinic, company_id=1, name="Mizrahi")])
    db.commit()
    path = "/api/v1/families/paginated"
    response = api.client.get(path, params={"clinic_id": clinic, "filters": json.dumps({"name": "lev"})})
    assert response.status_code == 200, response.text
    assert response.json()["total"] == 1
    assert [item["name"] for item in response.json()["items"]] == ["Levi"]
    assert api(path, {"name": "zzz"}) == 0


@pytest.mark.parametrize(
    "path,filters,expected",
    [(path, filters, expected) for path, cases in CASES.items() for filters, expected in cases],
)
def test_column_filters_narrow_paginated_lists(api, path, filters, expected):
    assert api(path, filters) == expected


@pytest.mark.parametrize("path", list(CASES))
def test_unknown_columns_are_ignored_and_malformed_filters_rejected(api, path):
    assert api(path, {"no_such_column": "x"}) == api(path, {})
    response = api.client.get(path, params={"clinic_id": api.clinic_id, "filters": "not json"})
    assert response.status_code == 400


def test_imported_spellings_match_canonical_options(api):
    from datetime import date
    from database import get_db
    from models import Client, Referral

    db = next(api.client.app.dependency_overrides[get_db]())
    clinic = api.clinic_id
    company = db.query(Client).filter(Client.clinic_id == clinic).first().company_id
    db.add_all([
        Client(company_id=company, clinic_id=clinic, first_name="Imported", last_name="Male", gender="male"),
        Client(company_id=company, clinic_id=clinic, first_name="Hebrew", last_name="Male", gender="זכר"),
        Client(company_id=company, clinic_id=clinic, first_name="Imported", last_name="Female", gender=" Female "),
    ])
    db.flush()
    client_id = db.query(Client.id).filter(Client.first_name == "Imported").first()[0]
    db.add(Referral(client_id=client_id, clinic_id=clinic, date=date(2026, 5, 9), urgency_level="Urgent", referral_notes="Imported", referral_data={}))
    db.commit()

    clients = "/api/v1/clients/paginated"
    assert api(clients, {"gender": ["זכר"]}) == 2
    assert api(clients, {"gender": ["נקבה"]}) == 1
    assert api(clients, {"gender": ["זכר", "נקבה"]}) == 3
    assert api(clients, {}, gender="זכר") == 2  # toolbar select uses the same matching

    referrals = "/api/v1/referrals/paginated"
    assert api(referrals, {"urgency": ["urgent"]}) == 1
    assert api(referrals, {"urgency": ["routine", "urgent"]}) == 2
    assert api(referrals, {}, urgency_level="urgent") == 1


@pytest.mark.parametrize(
    "term,expected",
    [
        ("2026", 1),        # year of John's date of birth (2026-05-04)
        ("05", 1),          # month of the date of birth (John is the only client with dates/phone)
        ("4", 1),           # unpadded day of the date of birth
        ("0521234567", 1),  # long numbers match text (phone) and skip date conditions
        ("04/05/2026", 1),  # separated dates keep the full date matching
        ("1999", 0),
    ],
)
def test_client_search_digit_terms_match_dates_and_numbers(api, term, expected):
    response = api.client.get("/api/v1/clients/paginated", params={"clinic_id": api.clinic_id, "search": term})
    assert response.status_code == 200, response.text
    assert response.json()["total"] == expected


def test_client_exam_dates_span_live_exams_of_both_kinds(api):
    from datetime import date, datetime, timezone
    from database import get_db
    from models import Client, OpticalExam

    db = next(api.client.app.dependency_overrides[get_db]())
    john = db.query(Client).filter(Client.first_name == "John").one()   # seeded exam on 2026-05-06
    sarah = db.query(Client).filter(Client.first_name == "Sarah").one()  # no exams
    db.add_all([
        OpticalExam(client_id=john.id, clinic_id=john.clinic_id, exam_date=date(2024, 1, 2), type="opticlens"),
        OpticalExam(client_id=john.id, clinic_id=john.clinic_id, exam_date=date(2027, 1, 1), type="exam",
                    deleted_at=datetime.now(timezone.utc)),
    ])
    db.commit()

    response = api.client.get(f"/api/v1/clients/{john.id}/exam-dates")
    assert response.status_code == 200, response.text
    assert response.json() == {"first_exam_date": "2024-01-02", "last_exam_date": "2026-05-06"}
    assert api.client.get(f"/api/v1/clients/{sarah.id}/exam-dates").json() == {"first_exam_date": None, "last_exam_date": None}


def test_clients_last_exam_dates_cover_a_list_page(api):
    from datetime import date
    from database import get_db
    from models import Client, OpticalExam

    db = next(api.client.app.dependency_overrides[get_db]())
    john = db.query(Client).filter(Client.first_name == "John").one()   # seeded exam on 2026-05-06
    sarah = db.query(Client).filter(Client.first_name == "Sarah").one()  # no exams
    db.add(OpticalExam(client_id=john.id, clinic_id=john.clinic_id, exam_date=date(2024, 1, 2), type="opticlens"))
    db.commit()

    response = api.client.get("/api/v1/clients/last-exam-dates", params={"ids": [john.id, sarah.id, 999999]})
    assert response.status_code == 200, response.text
    assert response.json() == {str(john.id): "2026-05-06"}
