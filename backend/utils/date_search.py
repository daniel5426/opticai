from datetime import date, datetime
import re
from typing import List, Optional

from sqlalchemy import Column, String, func
from sqlalchemy.sql.elements import BinaryExpression


class DateSearchHelper:
    @staticmethod
    def _normalize_year(year: int) -> int:
        if year < 100:
            return 2000 + year if year <= 69 else 1900 + year
        return year

    @staticmethod
    def _make_date(year: int, month: int, day: int) -> Optional[date]:
        try:
            return date(DateSearchHelper._normalize_year(year), month, day)
        except ValueError:
            return None

    @staticmethod
    def parse_dates(search_query: str) -> List[date]:
        if not search_query:
            return []

        search_clean = search_query.strip()
        dates: List[date] = []

        def add(candidate: Optional[date]) -> None:
            if candidate and candidate not in dates:
                dates.append(candidate)

        year_first = re.match(r"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$", search_clean)
        if year_first:
            add(
                DateSearchHelper._make_date(
                    int(year_first.group(1)),
                    int(year_first.group(2)),
                    int(year_first.group(3)),
                )
            )
            return dates

        local_or_us = re.match(r"^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$", search_clean)
        if local_or_us:
            first = int(local_or_us.group(1))
            second = int(local_or_us.group(2))
            year = int(local_or_us.group(3))
            add(DateSearchHelper._make_date(year, second, first))  # Israeli: DD/MM/YYYY
            add(DateSearchHelper._make_date(year, first, second))  # English US: MM/DD/YYYY
            return dates

        for fmt in ("%B %d %Y", "%b %d %Y", "%d %B %Y", "%d %b %Y"):
            try:
                add(datetime.strptime(search_clean, fmt).date())
            except ValueError:
                continue

        return dates

    @staticmethod
    def parse_date(search_query: str) -> Optional[date]:
        return DateSearchHelper.parse_dates(search_query)[0] if search_query else None

    @staticmethod
    def build_date_search_conditions(date_column: Column, search_query: str) -> List[BinaryExpression]:
        like = f"%{search_query.strip()}%"
        exact_dates = DateSearchHelper.parse_dates(search_query)

        conditions = [
            func.cast(date_column, String).ilike(like),
            func.to_char(date_column, "DD/MM/YYYY").ilike(like),
            func.to_char(date_column, "DD-MM-YYYY").ilike(like),
            func.to_char(date_column, "DD.MM.YYYY").ilike(like),
            func.to_char(date_column, "FMDD/FMMM/YYYY").ilike(like),
            func.to_char(date_column, "FMDD-FMMM-YYYY").ilike(like),
            func.to_char(date_column, "FMDD.FMMM.YYYY").ilike(like),
            func.to_char(date_column, "MM/DD/YYYY").ilike(like),
            func.to_char(date_column, "MM-DD-YYYY").ilike(like),
            func.to_char(date_column, "MM.DD.YYYY").ilike(like),
            func.to_char(date_column, "FMMM/FMDD/YYYY").ilike(like),
            func.to_char(date_column, "FMMM-FMDD-YYYY").ilike(like),
            func.to_char(date_column, "FMMM.FMDD.YYYY").ilike(like),
            func.to_char(date_column, "DD/MM/YY").ilike(like),
            func.to_char(date_column, "DD-MM-YY").ilike(like),
            func.to_char(date_column, "MM/DD/YY").ilike(like),
            func.to_char(date_column, "MM-DD-YY").ilike(like),
            func.to_char(date_column, "YYYY-MM-DD").ilike(like),
            func.to_char(date_column, "YYYY/MM/DD").ilike(like),
            func.to_char(date_column, "YYYY.MM.DD").ilike(like),
            func.to_char(date_column, "YYYY-FMMM-FMDD").ilike(like),
            func.to_char(date_column, "YYYY/FMMM/FMDD").ilike(like),
            func.to_char(date_column, "YYYY.FMMM.FMDD").ilike(like),
            func.to_char(date_column, "YYYY-MM").ilike(like),
            func.to_char(date_column, "YYYY/FMMM").ilike(like),
            func.to_char(date_column, "MM/YYYY").ilike(like),
            func.to_char(date_column, "FMMM/YYYY").ilike(like),
            func.regexp_replace(func.cast(date_column, String), "-0([0-9])", "-\\1", "g").ilike(like),
        ]

        if exact_dates:
            conditions.append(func.date(date_column).in_(exact_dates))

        return conditions
