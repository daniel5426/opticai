import pytest
from pydantic import ValidationError

from currency import normalize_currency
from schemas import BillingCreate, CompanyUpdate


def test_currency_codes_are_normalized_and_limited():
    assert normalize_currency(" usd ") == "USD"
    assert normalize_currency(None) == "ILS"
    assert CompanyUpdate(default_currency="eur").default_currency == "EUR"

    with pytest.raises(ValidationError):
        BillingCreate(order_id=1, currency="CAD")
