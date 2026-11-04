import json
from datetime import date, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import Column, Date, DateTime, Integer, MetaData, String, Table, create_engine, select

from utils.column_filters import ColumnFilter, build_column_filter_conditions

metadata = MetaData()
rows = Table(
    "rows",
    metadata,
    Column("id", Integer, primary_key=True),
    Column("name", String),
    Column("status", String),
    Column("day", Date),
    Column("created", DateTime),
)
COLUMNS = {
    "name": ColumnFilter(rows.c.name),
    "status": ColumnFilter(rows.c.status, "options"),
    "day": ColumnFilter(rows.c.day, "date"),
    "created": ColumnFilter(rows.c.created, "date"),
}


@pytest.fixture()
def conn():
    engine = create_engine("sqlite://")
    metadata.create_all(engine)
    with engine.begin() as connection:
        connection.execute(rows.insert(), [
            {"id": 1, "name": "Dana Cohen", "status": "active", "day": date(2026, 1, 1), "created": datetime(2026, 1, 1, 23, 30)},
            {"id": 2, "name": "Avi 100%_off", "status": "pending", "day": date(2026, 1, 15), "created": datetime(2026, 1, 15, 8)},
            {"id": 3, "name": None, "status": "closed", "day": date(2026, 2, 1), "created": datetime(2026, 2, 1, 8)},
        ])
        yield connection


def ids(conn, filters):
    raw = json.dumps(filters) if filters is not None else None
    query = select(rows.c.id).where(*build_column_filter_conditions(raw, COLUMNS)).order_by(rows.c.id)
    return [row.id for row in conn.execute(query)]


def test_no_filters_returns_everything(conn):
    assert ids(conn, None) == [1, 2, 3]
    assert ids(conn, {}) == [1, 2, 3]


def test_text_is_case_insensitive_contains(conn):
    assert ids(conn, {"name": "cohen"}) == [1]
    assert ids(conn, {"name": "  "}) == [1, 2, 3]


def test_text_escapes_like_wildcards(conn):
    assert ids(conn, {"name": "%"}) == [2]
    assert ids(conn, {"name": "_off"}) == [2]


def test_options_match_any_selected_value(conn):
    assert ids(conn, {"status": ["active", "closed"]}) == [1, 3]
    assert ids(conn, {"status": "pending"}) == [2]
    assert ids(conn, {"status": []}) == [1, 2, 3]


def test_date_range_is_inclusive_for_date_and_timestamp(conn):
    assert ids(conn, {"day": {"from": "2026-01-01", "to": "2026-01-15"}}) == [1, 2]
    assert ids(conn, {"created": {"to": "2026-01-01"}}) == [1]
    assert ids(conn, {"created": {"from": "2026-01-15"}}) == [2, 3]


def test_reversed_date_range_is_normalized(conn):
    assert ids(conn, {"day": {"from": "2026-01-15", "to": "2026-01-01"}}) == [1, 2]


def test_filters_combine_with_and(conn):
    assert ids(conn, {"status": ["active", "pending"], "name": "avi"}) == [2]


def test_derived_options_use_their_own_condition(conn):
    initials = {"open": rows.c.status.in_(["active", "pending"]), "done": rows.c.status == "closed"}
    columns = {"group": ColumnFilter(None, "options", option_condition=initials.get)}
    query = lambda filters: [
        row.id for row in conn.execute(
            select(rows.c.id).where(*build_column_filter_conditions(json.dumps(filters), columns)).order_by(rows.c.id)
        )
    ]
    assert query({"group": ["open"]}) == [1, 2]
    assert query({"group": ["open", "done"]}) == [1, 2, 3]
    assert query({"group": ["unknown"]}) == [1, 2, 3]


def test_unknown_keys_are_ignored(conn):
    assert ids(conn, {"not_a_column": "x"}) == [1, 2, 3]


@pytest.mark.parametrize("raw", ["not json", "[1]", json.dumps({"name": 5}), json.dumps({"status": [1]}), json.dumps({"day": "2026-01-01"}), json.dumps({"day": {"from": "01/01/2026"}})])
def test_malformed_filters_are_rejected(raw):
    with pytest.raises(HTTPException) as error:
        build_column_filter_conditions(raw, COLUMNS)
    assert error.value.status_code == 400
