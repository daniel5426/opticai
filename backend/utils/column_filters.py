import json
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Callable, Literal, Mapping, Optional

from fastapi import HTTPException
from sqlalchemy import String, cast, func, literal, or_
from sqlalchemy.sql.elements import ColumnElement

ColumnFilterKind = Literal["text", "options", "date"]

MAX_TEXT_LENGTH = 200
MAX_OPTION_VALUES = 50


@dataclass(frozen=True)
class ColumnFilter:
    expression: Optional[ColumnElement]
    kind: ColumnFilterKind = "text"
    # Options whose stored value is derived (e.g. a category computed from a MIME type) map each
    # selected option to its own condition; the selections are OR-ed together.
    option_condition: Optional[Callable[[str], Optional[ColumnElement]]] = None


def _invalid(message: str) -> HTTPException:
    return HTTPException(status_code=400, detail=f"Invalid column filters: {message}")


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _parse_date(value: object, key: str) -> date | None:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise _invalid(f"'{key}' date bounds must be YYYY-MM-DD strings")
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise _invalid(f"'{key}' has an invalid date '{value}'") from error


def parse_column_filters(raw: str | None) -> dict[str, object]:
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as error:
        raise _invalid("expected a JSON object") from error
    if not isinstance(parsed, dict):
        raise _invalid("expected a JSON object")
    return parsed


def build_column_filter_conditions(
    raw: str | None,
    columns: Mapping[str, ColumnFilter],
) -> list[ColumnElement]:
    """Translate whitelisted column filters into SQL conditions.

    Unknown keys are ignored so stale links and older clients keep working.
    """
    conditions: list[ColumnElement] = []
    for key, value in parse_column_filters(raw).items():
        column = columns.get(key)
        if column is None:
            continue

        if column.kind == "text":
            if not isinstance(value, str):
                raise _invalid(f"'{key}' expects text")
            text = value.strip()[:MAX_TEXT_LENGTH]
            if not text:
                continue
            haystack = func.lower(func.coalesce(cast(column.expression, String), literal("")))
            conditions.append(haystack.like(f"%{_escape_like(text.lower())}%", escape="\\"))

        elif column.kind == "options":
            values = [value] if isinstance(value, str) else value
            if not isinstance(values, list) or not all(isinstance(item, str) for item in values):
                raise _invalid(f"'{key}' expects a list of options")
            values = [item for item in values if item][:MAX_OPTION_VALUES]
            if not values:
                continue
            if column.option_condition is not None:
                matches = [condition for condition in map(column.option_condition, values) if condition is not None]
                if matches:
                    conditions.append(or_(*matches))
            else:
                conditions.append(cast(column.expression, String).in_(values))

        elif column.kind == "date":
            if not isinstance(value, dict):
                raise _invalid(f"'{key}' expects a date range")
            start = _parse_date(value.get("from"), key)
            end = _parse_date(value.get("to"), key)
            if start and end and start > end:
                start, end = end, start
            # Half-open bounds keep DATE and TIMESTAMP columns correct and index-friendly.
            if start:
                conditions.append(column.expression >= start)
            if end:
                conditions.append(column.expression < end + timedelta(days=1))

    return conditions
