from datetime import date

from utils.date_search import DateSearchHelper


def test_parse_dates_supports_iso_israeli_and_us_formats():
    assert DateSearchHelper.parse_dates("2026-05-04") == [date(2026, 5, 4)]
    assert date(2026, 5, 4) in DateSearchHelper.parse_dates("04/05/2026")
    assert date(2026, 5, 4) in DateSearchHelper.parse_dates("05/04/2026")


def test_parse_dates_supports_two_digit_years():
    assert date(2026, 5, 4) in DateSearchHelper.parse_dates("04/05/26")


def test_parse_dates_rejects_invalid_dates():
    assert DateSearchHelper.parse_dates("31/02/2026") == []
