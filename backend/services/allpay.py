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


def credentials(*, messaging=False, integration_login=None):
    if not messaging:
        login, key = settings.ALLPAY_API_LOGIN, settings.ALLPAY_API_KEY
    elif integration_login:
        if integration_login == settings.MESSAGING_ALLPAY_API_LOGIN:
            login, key = integration_login, settings.MESSAGING_ALLPAY_API_KEY
        elif integration_login == settings.ALLPAY_API_LOGIN:
            login, key = integration_login, settings.ALLPAY_API_KEY
        else:
            raise AllpayError('payment_configuration_changed')
    else:
        if bool(settings.MESSAGING_ALLPAY_API_LOGIN) != bool(settings.MESSAGING_ALLPAY_API_KEY):
            raise AllpayError('billing_not_configured')
        login = settings.MESSAGING_ALLPAY_API_LOGIN or settings.ALLPAY_API_LOGIN
        key = settings.MESSAGING_ALLPAY_API_KEY or settings.ALLPAY_API_KEY
    if not login or not key:
        raise AllpayError('billing_not_configured')
    return login, key


def verify(payload: dict, *, messaging=False, integration_login=None) -> bool:
    supplied = payload.get('sign')
    try:
        if messaging and integration_login:
            key = credentials(messaging=True, integration_login=integration_login)[1]
        elif messaging:
            key = settings.MESSAGING_ALLPAY_API_KEY or settings.ALLPAY_API_KEY
        else:
            key = settings.ALLPAY_API_KEY
    except AllpayError:
        return False
    return bool(key and isinstance(supplied, str) and hmac.compare_digest(supplied, signature(payload, key)))


def request(endpoint: str, data: dict, *, messaging: bool = False, integration_login=None, test_mode=None) -> dict:
    login, key = credentials(messaging=messaging, integration_login=integration_login)
    selected_test_mode = test_mode if test_mode is not None else settings.MESSAGING_ALLPAY_TEST_MODE if messaging else settings.ALLPAY_TEST_MODE
    if endpoint in {"getpayment", "capturetoken", "refund"} and not (settings.MESSAGING_TOPUPS_ENABLED if messaging else settings.BILLING_CHARGING_ENABLED):
        raise AllpayError("billing_disabled")
    if endpoint in {"getpayment", "capturetoken", "refund"} and not selected_test_mode and not settings.ALLPAY_LIVE_PAYMENTS_ENABLED:
        raise AllpayError("billing_live_disabled")
    body = {**data, "login": login}
    if endpoint in {"getpayment", "capturetoken"}:
        body["test_mode"] = int(selected_test_mode)
    body["sign"] = signature(body, key)
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
