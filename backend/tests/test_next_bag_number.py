from datetime import date, datetime

from models import Clinic, Company, ContactLensOrder, Order
from tests.test_table_search import _client, _seed, _session_factory


def _order(client_id, clinic_id, bag_number, **extra):
    details = {} if bag_number is ... else {"bag_number": bag_number}
    return Order(client_id=client_id, clinic_id=clinic_id, order_date=date(2026, 5, 5), type="Glasses", order_data={"details": details}, **extra)


def test_next_bag_number_matches_client_parse_int_across_order_kinds():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)
        clinic_id = ids["clinic_id"]
        client_id = db.query(Order.client_id).first()[0]
        other_company = Company(name="B", owner_full_name="Owner B")
        db.add(other_company)
        db.flush()
        other_clinic = Clinic(company_id=other_company.id, name="Clinic B", unique_id="clinic-b")
        db.add(other_clinic)
        db.flush()
        db.add_all([
            _order(client_id, clinic_id, "7"),
            _order(client_id, clinic_id, 12),            # stored as a JSON number
            _order(client_id, clinic_id, "15abc"),       # parseInt keeps the leading integer
            _order(client_id, clinic_id, " 3"),
            _order(client_id, clinic_id, "x"),           # parseInt gives NaN, ignored
            _order(client_id, clinic_id, ""),
            _order(client_id, clinic_id, ...),           # no bag number at all
            _order(client_id, clinic_id, "99", deleted_at=datetime(2026, 1, 1)),  # deleted orders are hidden
            _order(client_id, other_clinic.id, "500"),   # another company's clinic is out of scope
            ContactLensOrder(client_id=client_id, clinic_id=clinic_id, order_date=date(2026, 5, 6), type="CL", order_data={"details": {"bag_number": "20"}}),
        ])
        db.commit()

    with _client(SessionLocal, ids["current_user_id"]) as client:
        response = client.get("/api/v1/orders/next-bag-number", params={"clinic_id": clinic_id})
        assert response.status_code == 200
        assert response.json() == {"next_bag_number": "21"}


def test_next_bag_number_starts_at_one():
    SessionLocal = _session_factory()
    with SessionLocal() as db:
        ids = _seed(db)
        db.query(Order).delete()
        db.commit()

    with _client(SessionLocal, ids["current_user_id"]) as client:
        response = client.get("/api/v1/orders/next-bag-number", params={"clinic_id": ids["clinic_id"]})
        assert response.status_code == 200
        assert response.json() == {"next_bag_number": "1"}
