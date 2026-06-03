from typing import Iterable, Sequence

from sqlalchemy import String, and_, cast, func, literal, or_
from sqlalchemy.sql.elements import ColumnElement

from utils.date_search import DateSearchHelper


def split_search_terms(search_query: str | None) -> list[str]:
    if not search_query:
        return []
    return [term for term in search_query.strip().split() if term]


def spaced_concat(*parts: ColumnElement) -> ColumnElement:
    expression = literal("")
    for index, part in enumerate(parts):
        if index > 0:
            expression = expression + literal(" ")
        expression = expression + func.coalesce(cast(part, String), literal(""))
    return expression


def search_blob(*parts: ColumnElement) -> ColumnElement:
    return spaced_concat(*parts)


def build_all_terms_search_condition(
    search_query: str | None,
    *,
    text_expressions: Sequence[ColumnElement],
    date_columns: Iterable[ColumnElement] = (),
) -> ColumnElement | None:
    terms = split_search_terms(search_query)
    if not terms:
        return None

    per_term_conditions = []
    for term in terms:
        like = f"%{term.lower()}%"
        matches = [
            func.lower(func.coalesce(cast(expression, String), literal(""))).like(like)
            for expression in text_expressions
        ]
        for date_column in date_columns:
            matches.extend(DateSearchHelper.build_date_search_conditions(date_column, term))
        if matches:
            per_term_conditions.append(or_(*matches))

    if not per_term_conditions:
        return None
    return and_(*per_term_conditions)
