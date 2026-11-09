"""Provider-neutral sending outcomes. Unknown submission is never a safe retry."""
from dataclasses import dataclass
from typing import Protocol
import base64
import hashlib
import hmac
import json
import time
import httpx
from config import settings

@dataclass(frozen=True)
class Outcome:
    status: str  # submitted, failed, retry, uncertain
    provider_id: str | None = None
    code: str | None = None
    retry_after: int | None = None
    provider_cost: dict | None = None  # Native-currency charge, supplied only when known.

class SmsAdapter(Protocol):
    name: str
    def billing(self, text: str) -> tuple[int, dict]: ...
    def ready(self) -> bool: ...
    def send(self, *, destination: str, content: str, key: str) -> Outcome: ...
    def reconcile(self, provider_id: str) -> Outcome: ...
    def verify_event(self, body: bytes, headers: dict) -> dict: ...

_sms: SmsAdapter | None = None

def register_sms(adapter: SmsAdapter):
    global _sms
    _sms = adapter

def sms_adapter():
    if _sms is not None: return _sms
    from services.micropay_sms import MicropaySms
    return MicropaySms()

def segments(text):
    basic = set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà')
    extended = set('^{}\\[~]|€\f')
    if all(c in basic or c in extended for c in text):
        count = sum(2 if c in extended else 1 for c in text)
        return 1 if count <= 160 else (count + 152) // 153
    count = len(text.encode('utf-16-be')) // 2
    return 1 if count <= 70 else (count + 66) // 67

def email_ready():
    return bool((settings.CAMPAIGN_RESEND_API_KEY or settings.RESEND_API_KEY) and settings.CAMPAIGN_EMAIL_FROM and settings.CAMPAIGN_RESEND_WEBHOOK_SECRET)

def send_email(delivery, reply_to, unsubscribe, clinic_name):
    import html
    if not email_ready(): return Outcome('failed', code='email_not_configured')
    # A separate sending identity is mandatory; no arbitrary clinic From address.
    sender = settings.CAMPAIGN_EMAIL_FROM
    address = sender.split('<')[-1].rstrip('>').strip()
    safe_name = clinic_name.replace('\r', '').replace('\n', '').replace('"', '')
    payload = {'from': f'"{safe_name} via Prysm" <{address}>', 'to': [delivery.destination],
        'subject': delivery.subject, 'text': delivery.content + '\n\n' + unsubscribe,
        'html': '<div style="white-space:pre-wrap">' + html.escape(delivery.content) + '</div><p><a href="' + html.escape(unsubscribe, quote=True) + '">Unsubscribe · הסרה · Désinscription</a></p>',
        'headers': {'List-Unsubscribe': '<' + unsubscribe + '>', 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'},
        'tags': [{'name': 'delivery_id', 'value': delivery.id}]}
    if reply_to: payload['reply_to'] = reply_to
    try:
        response = httpx.post('https://api.resend.com/emails', json=payload,
            headers={'Authorization': 'Bearer ' + (settings.CAMPAIGN_RESEND_API_KEY or settings.RESEND_API_KEY), 'Idempotency-Key': delivery.id}, timeout=20)
        if response.status_code == 429:
            from datetime import UTC, datetime, timedelta
            try: code = response.json().get('name', '')
            except ValueError: code = ''
            current = datetime.now(UTC)
            if code == 'daily_quota_exceeded':
                delay = int(((current + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0) - current).total_seconds()) + 1
                return Outcome('retry', code='email_daily_quota', retry_after=delay)
            if code == 'monthly_quota_exceeded':
                return Outcome('retry', code='email_monthly_quota', retry_after=3600)
            try: delay = max(1, min(3600, int(response.headers.get('retry-after', 30))))
            except ValueError: delay = 30
            return Outcome('retry', code='rate_limited', retry_after=delay)
        if response.status_code >= 500: return Outcome('uncertain', code='provider_unavailable')
        if response.status_code >= 400: return Outcome('failed', code='provider_rejected')
        provider_id = response.json().get('id')
        return Outcome('submitted', provider_id) if provider_id else Outcome('uncertain', code='invalid_provider_response')
    except (httpx.HTTPError, ValueError):
        return Outcome('uncertain', code='provider_timeout')

def verify_resend(body, headers):
    secret = settings.CAMPAIGN_RESEND_WEBHOOK_SECRET
    timestamp, event_id = headers.get('svix-timestamp', ''), headers.get('svix-id', '')
    if not secret or abs(time.time() - int(timestamp)) > 300 or not event_id: raise ValueError('signature')
    key = base64.b64decode(secret.removeprefix('whsec_'))
    signed = event_id.encode() + b'.' + timestamp.encode() + b'.' + body
    expected = base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()
    signatures = headers.get('svix-signature', '').split()
    if not any(hmac.compare_digest('v1,' + expected, item) for item in signatures): raise ValueError('signature')
    payload = json.loads(body)
    from email.utils import parseaddr
    source = payload.get('data', {}).get('from')
    if isinstance(source, str) and parseaddr(source)[1].lower() != parseaddr(settings.CAMPAIGN_EMAIL_FROM)[1].lower():
        return {'ignored': True}  # Account webhooks also include other verified domains.
    tags = payload.get('data', {}).get('tags') or {}
    if isinstance(tags, list): tags = {t.get('name'): t.get('value') for t in tags if isinstance(t, dict)}
    return {'key': 'resend:' + event_id, 'provider_id': payload.get('data', {}).get('email_id'), 'type': payload.get('type', ''), 'delivery_id': tags.get('delivery_id')}
