from typing import Optional

from fastapi import HTTPException


SUPPORTED_CURRENCIES = frozenset({"ILS", "USD", "EUR"})
DEFAULT_CURRENCY = "ILS"


def normalize_currency(value: Optional[str], *, default: Optional[str] = DEFAULT_CURRENCY) -> Optional[str]:
    if value is None or not str(value).strip():
        return default
    currency = str(value).strip().upper()
    if currency not in SUPPORTED_CURRENCIES:
        raise HTTPException(status_code=422, detail="Currency must be one of ILS, USD, or EUR")
    return currency
