"""Shared provider quota gates. No customer wallet or subscription credit is inferred here."""
from datetime import datetime, timedelta
import copy
import httpx
from campaign_models import MessagingCatalog, MessagingProviderState, now
from config import settings
from services.subscription_service import aware


def state(db, provider):
    row = db.get(MessagingProviderState, provider)
    if row is None:
        # Serializes first creation across API replicas; never assumes a process-local lock.
        db.query(MessagingCatalog).filter_by(id=1).with_for_update().first()
        row = db.query(MessagingProviderState).filter_by(provider=provider).populate_existing().first()
        if row is None:
            row = MessagingProviderState(provider=provider)
            db.add(row)
            db.flush()
    return row


def refresh(db, provider=None):
    for name in ([provider] if provider else ['micropay', 'resend']):
        row = state(db, name)
        try:
            if name == 'micropay':
                from services.micropay_sms import MicropaySms
                row.credit_units = MicropaySms().credit()
            else:
                response = httpx.get('https://api.resend.com/usage',
                    headers={'Authorization': 'Bearer ' + (settings.CAMPAIGN_RESEND_API_KEY or settings.RESEND_API_KEY)}, timeout=15)
                response.raise_for_status()
                usage = response.json()['emails']
                for key in ('daily', 'monthly'):
                    if not isinstance(usage[key]['used'], int) or usage[key]['used'] < 0:
                        raise ValueError('invalid_usage')
                    if usage[key]['limit'] is not None and not isinstance(usage[key]['limit'], int):
                        raise ValueError('invalid_usage')
                # Only non-identifying email totals, never contacts or other account data.
                row.usage = usage
            row.checked_at, row.error = now(), None
        except (httpx.HTTPError, KeyError, ValueError, TypeError, AttributeError):
            row.error = 'provider_usage_unavailable'
    db.flush()


def email_slot(db):
    row = state(db, 'resend')
    row = db.query(MessagingProviderState).filter_by(provider='resend').with_for_update().populate_existing().one()
    current = now()
    for value in (row.blocked_until, row.next_request_at):
        if value and aware(value) > current:
            return aware(value), row.blocked_reason or 'rate_limited'
    if not row.checked_at or current - aware(row.checked_at) > timedelta(seconds=60):
        refresh(db, 'resend')
    if row.error or not row.usage:
        return current + timedelta(minutes=5), 'provider_usage_unavailable'
    usage = copy.deepcopy(row.usage)
    for period, info in usage.items():
        if info['limit'] is not None and info['used'] >= info['limit']:
            try: retry = datetime.fromisoformat(info['resets_at'].replace('Z', '+00:00'))
            except (KeyError, ValueError): retry = current + timedelta(hours=1)
            # Refresh expired snapshots instead of resetting their counts speculatively.
            if aware(retry) <= current: retry = current + timedelta(minutes=1)
            row.blocked_until, row.blocked_reason = retry, 'email_' + period + '_quota'
            return retry, row.blocked_reason
        info['used'] += 1  # Includes the submission reserved by this replica.
    row.usage = usage
    row.blocked_reason, row.blocked_until = None, None
    row.next_request_at = current + timedelta(seconds=1)
    return None


def email_outcome(db, outcome):
    if outcome.status != 'retry':
        return
    row = state(db, 'resend')
    row.blocked_reason = outcome.code
    row.blocked_until = now() + timedelta(seconds=outcome.retry_after or 30)
