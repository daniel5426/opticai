"""Allpay v15 boundary. Secrets and tokens must never enter logs or responses."""
import hashlib
import hmac
from decimal import Decimal

import httpx
from config import settings


class AllpayError(Exception):
    def __init__(self, code: str, *, uncertain: bool = False):
        self.code = str(code)
        self.uncertain = uncertain
        super().__init__(self.code)


def signature(data: dict, key: str) -> str:
    chunks = []
    def empty(value):
        return value is None or value == ""
    def value(item):
        if isinstance(item, bool):
            return "1" if item else "0"
        if isinstance(item, (float, Decimal)):
            return format(Decimal(str(item)).normalize(), "f")
        return str(item)
    for name in sorted(data):
        item = data[name]
        if name == "sign" or empty(item):
            continue
        if isinstance(item, (list, dict)):
            entries = item if isinstance(item, list) else [item[k] for k in sorted(item)]
            for entry in entries:
                if isinstance(entry, dict):
                    chunks.extend(value(entry[k]) for k in sorted(entry) if not empty(entry[k]))
                elif not empty(entry):
                    chunks.append(value(entry))
        else:
            chunks.append(value(item))
    chunks.append(key)
    return hashlib.sha256(":".join(chunks).encode()).hexdigest()


def verify(payload: dict) -> bool:
    supplied = payload.get("sign")
    return bool(settings.ALLPAY_API_KEY and isinstance(supplied, str) and hmac.compare_digest(supplied, signature(payload, settings.ALLPAY_API_KEY)))


def request(endpoint: str, data: dict) -> dict:
    if not settings.ALLPAY_API_LOGIN or not settings.ALLPAY_API_KEY:
        raise AllpayError("billing_not_configured")
    if endpoint in {"getpayment", "capturetoken", "refund"} and not settings.BILLING_CHARGING_ENABLED:
        raise AllpayError("billing_disabled")
    if endpoint in {"getpayment", "capturetoken", "refund"} and not settings.ALLPAY_TEST_MODE and not settings.ALLPAY_LIVE_PAYMENTS_ENABLED:
        raise AllpayError("billing_live_disabled")
    body = {**data, "login": settings.ALLPAY_API_LOGIN}
    if endpoint in {"getpayment", "capturetoken"}:
        body["test_mode"] = int(settings.ALLPAY_TEST_MODE)
    body["sign"] = signature(body, settings.ALLPAY_API_KEY)
    try:
        response = httpx.post("https://allpay.to/app/", params={"show": endpoint, "mode": "api15"}, json=body, timeout=25)
        response.raise_for_status()
        result = response.json()
        if not isinstance(result, dict):
            raise ValueError("invalid response")
    except (httpx.HTTPError, ValueError) as exc:
        raise AllpayError("provider_unavailable", uncertain=True) from exc
    if result.get("error_code"):
        raise AllpayError(str(result.get("decline_code") or result["error_code"]))
    return result
