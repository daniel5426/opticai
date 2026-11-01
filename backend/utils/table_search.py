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
    """Searchable text in the exact shape of the alembic 0012 trigram index expressions.

    Postgres only uses an expression index for an identical expression, so this must stay
    `coalesce(CAST(a AS varchar), '') || ' ' || coalesce(CAST(b AS varchar), '') ...`.
    """
    expression = None
    for part in parts:
        piece = func.coalesce(cast(part, String), literal(""))
        expression = piece if expression is None else expression + literal(" ") + piece
    return expression


# Day, month and year as zero-padded, unpadded and two-digit year, space separated.
DIGIT_DATE_COMPONENTS = "YYYY YY MM FMMM DD FMDD"


def _could_match_date(term: str) -> bool:
    """Rendered dates contain digits, and their digit runs are at most 4 long (YYYY), so
    words and long numbers such as phone or ID numbers can never match one."""
    if not any(character.isdigit() for character in term):
        return False
    return not (term.isdigit() and len(term) > 4)


def build_all_terms_search_condition(
    search_query: str | None,
    *,
    text_expressions: Sequence[ColumnElement],
    date_columns: Iterable[ColumnElement] = (),
) -> ColumnElement | None:
    terms = split_search_terms(search_query)
    if not terms:
        return None

    date_columns = list(date_columns)
    per_term_conditions = []
    for term in terms:
        like = f"%{term.lower()}%"
        # search_blob output is already NULL-safe; wrapping it again would stop the
        # trigram index from matching.
        matches = [func.lower(expression).like(like) for expression in text_expressions]
        # Skipping the ~28 to_char comparisons per date column keeps the text match
        # index-friendly when the term cannot be part of a rendered date.
        if _could_match_date(term):
            for date_column in date_columns:
                if term.isdigit():
                    # A bare number cannot span a date separator, so it can only fall inside one
                    # component; one rendering of every component replaces the 28 formats.
                    matches.append(func.to_char(date_column, DIGIT_DATE_COMPONENTS).like(f"%{term}%"))
                else:
                    matches.extend(DateSearchHelper.build_date_search_conditions(date_column, term))
        if matches:
            per_term_conditions.append(or_(*matches))

    if not per_term_conditions:
        return None
    return and_(*per_term_conditions)
