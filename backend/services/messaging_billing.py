"""Company prepaid ledger, period allowances and verified one-time Allpay funding."""
from datetime import timedelta
from zoneinfo import ZoneInfo
from decimal import Decimal
from fastapi import HTTPException
from sqlalchemy import func
from models import Company, Subscription, Clinic, Settings
from campaign_models import (MessagingAccount, MessagingCatalog, MessagingClinic, MessagingLedger,
                            MessagingTopup, MessagingRefund, MessagingPeriod, CampaignDelivery, now, uid)
from services.subscription_service import aware
from services.saas_billing import month_after
from services import allpay
from config import settings

MICRO = 1_000_000
AGORA = 10_000

def reject(code, status=409):
    raise HTTPException(status, detail={'code': code})


def catalog(db):
    row = db.get(MessagingCatalog, 1)
    if not row:
        reject('messaging_not_configured')
    if row.effective_at and aware(row.effective_at) <= now() and row.pending_config:
        row = db.query(MessagingCatalog).filter_by(id=1).with_for_update().populate_existing().one()
        if row.pending_config and aware(row.effective_at) <= now():
            for key, value in row.pending_config.items(): setattr(row, key, value)
            row.revision += 1
            row.pending_config, row.effective_at = None, None
            db.flush()
    return row


def account(db, company_id):
    # Company lock serializes account creation as well as money/allowance operations.
    company = db.query(Company).filter_by(id=company_id).with_for_update().populate_existing().first()
    if not company: reject('scope_denied', 403)
    row = db.query(MessagingAccount).filter_by(company_id=company_id).with_for_update().populate_existing().first()
    if not row:
        row = MessagingAccount(company_id=company_id, balance=0, reserved=0, used=0, held=0, allowance=0)
        db.add(row)
        db.flush()
    refresh_period(db, row)
    return row


def cycle(db, row):
    """Only a paid term or explicitly anchored managed account grants monthly units."""
    sub = db.query(Subscription).filter_by(company_id=row.company_id).first()
    current = now()
    paid = sub and sub.status in ('active', 'past_due', 'cancelled', 'legacy_active')
    if sub and sub.access_override in ('suspended', 'read_only'):
        paid = False
    if sub and not paid:
        return None
    start = aware(sub.current_period_starts_at) if sub else None
    paid_end = aware(sub.current_period_ends_at) if sub else None
    if not start or not paid_end:
        start = aware(row.manual_anchor)
        if not start:
            return None
        paid_end = None
    elif not start <= current < paid_end:
        return None
    anchor = start
    end = month_after(start, anchor)
    while end <= current:
        start, end = end, month_after(end, anchor)
    if paid_end:
        end = min(end, paid_end)
    if not start <= current < end:
        return None
    count = db.query(func.count(Clinic.id)).filter_by(company_id=row.company_id, is_active=True).scalar() or 0
    if sub and sub.clinic_limit is not None:
        count = min(count, sub.clinic_limit)
    return start, end, int(count)


def current_period(db, row):
    if not row.period_start:
        return None
    return db.get(MessagingPeriod, (row.company_id, row.period_start))


def sync_email_alias(row, period):
    # Existing consumers continue seeing email-only values under the legacy names.
    row.allowance, row.used, row.held = period.email_limit, period.email_used, period.email_held


def refresh_period(db, row):
    prices = catalog(db)
    value = cycle(db, row)
    if not value:
        row.period_start = row.period_end = None
        row.allowance = row.used = row.held = 0
        return
    start, end, count = value
    db.flush()
    period = db.query(MessagingPeriod).filter_by(company_id=row.company_id, period_start=start).populate_existing().first()
    if not period:
        legacy = aware(row.period_start) == start
        period = MessagingPeriod(company_id=row.company_id, period_start=start, period_end=end,
            eligible_clinics=count, email_per_clinic=prices.email_per_clinic, sms_per_clinic=prices.sms_per_clinic,
            email_limit=max(row.allowance if legacy else 0, count * prices.email_per_clinic),
            email_used=row.used if legacy else 0, email_held=row.held if legacy else 0,
            sms_limit=count * prices.sms_per_clinic, sms_used=0, sms_held=0)
        db.add(period)
        db.flush()
    elif count > period.eligible_clinics:
        period.email_limit = max(period.email_limit, count * period.email_per_clinic)
        period.sms_limit = max(period.sms_limit, count * period.sms_per_clinic)
        period.eligible_clinics = count
    # Explicit owner overrides affect remaining availability, never rewrite used/held units.
    for channel, override in [('email', row.allowance_override), ('sms', row.sms_allowance_override)]:
        if override is not None:
            setattr(period, channel + '_limit', max(override, getattr(period, channel + '_used') + getattr(period, channel + '_held')))
    row.period_start, row.period_end = start, end
    sync_email_alias(row, period)


def allowances(db, row):
    period = current_period(db, row)
    return {channel: {
        'limit': getattr(period, channel + '_limit', 0),
        'used': getattr(period, channel + '_used', 0),
        'reserved': getattr(period, channel + '_held', 0),
        'remaining': max(0, getattr(period, channel + '_limit', 0) - getattr(period, channel + '_used', 0) - getattr(period, channel + '_held', 0))
    } for channel in ('email', 'sms')}


def clinic_settings(db, clinic_id):
    clinic = db.get(Clinic, clinic_id)
    if not clinic: reject('scope_denied', 403)
    row = db.get(MessagingClinic, clinic_id)
    if not row:
        from services.campaign_filters import normalize
        legacy = db.query(Settings).filter_by(clinic_id=clinic_id).first()
        row = MessagingClinic(clinic_id=clinic_id, company_id=clinic.company_id, reply_to=normalize('email', getattr(legacy, 'clinic_email', None)))
        db.add(row)
        db.flush()
    return row


def entry(db, company_id, key, kind, amount=0, clinic_id=None, reference=None):
    db.add(MessagingLedger(company_id=company_id, clinic_id=clinic_id, key=key,
        kind=kind, amount=amount, reference=reference))


def reserve(db, acct, deliveries):
    total = sum(d.cost for d in deliveries)
    free = {channel: sum(d.allowance for d in deliveries if d.channel == channel) for channel in ('email', 'sms')}
    period = current_period(db, acct)
    if acct.balance - acct.reserved < total: reject('insufficient_balance', 402)
    available = allowances(db, acct)
    if any(free[c] > available[c]['remaining'] for c in free): reject('quote_stale')
    by_clinic = {}
    for d in deliveries: by_clinic[d.clinic_id] = by_clinic.get(d.clinic_id, 0) + d.cost
    for clinic_id, value in by_clinic.items():
        config = clinic_settings(db, clinic_id)
        if config.budget is not None:
            if not acct.period_start: reject('allowance_period_required')
            spent = db.query(func.coalesce(func.sum(CampaignDelivery.cost), 0)).filter(
                CampaignDelivery.clinic_id == clinic_id, CampaignDelivery.created_at >= acct.period_start,
                CampaignDelivery.status.in_(['queued', 'sending', 'uncertain', 'submitted', 'delivered', 'bounced', 'complained', 'undeliverable'])).scalar()
            if spent + value > config.budget: reject('clinic_budget_exceeded', 402)
    acct.reserved += total
    if period:
        period.email_held += free['email']
        period.sms_held += free['sms']
        sync_email_alias(acct, period)
    for d in deliveries:
        d.period_start = acct.period_start
        entry(db, acct.company_id, 'reserve:' + d.id, 'reserve', -d.cost, d.clinic_id, d.id)


def settle_delivery(db, delivery, billable):
    if delivery.settled: return
    acct = account(db, delivery.company_id)
    acct.reserved -= delivery.cost
    db.flush()
    period = db.query(MessagingPeriod).filter_by(company_id=delivery.company_id, period_start=delivery.period_start).populate_existing().first() if delivery.period_start else None
    if period and delivery.allowance:
        channel = delivery.channel
        setattr(period, channel + '_held', getattr(period, channel + '_held') - delivery.allowance)
        if billable:
            setattr(period, channel + '_used', getattr(period, channel + '_used') + delivery.allowance)
        if aware(delivery.period_start) == aware(acct.period_start):
            sync_email_alias(acct, period)
    if billable: acct.balance -= delivery.cost
    delivery.settled = True
    entry(db, acct.company_id, 'settle:' + delivery.id, 'release', delivery.cost, delivery.clinic_id, delivery.id)
    if billable:
        entry(db, acct.company_id, 'usage:' + delivery.id, 'usage', -delivery.cost, delivery.clinic_id, delivery.id)
    if not billable:
        from campaign_models import CampaignContactClaim
        db.query(CampaignContactClaim).filter_by(delivery_id=delivery.id).delete(synchronize_session=False)


def payment_options(row):
    return {'messaging': True, 'integration_login': row.provider_login or settings.ALLPAY_API_LOGIN, 'test_mode': row.test_mode}


def topup(db, user, amount_minor, request_key, locale):
    if user.role_level < 4: reject('ceo_required', 403)
    from services.campaign_filters import normalize
    if not normalize('email', user.email): reject('billing_email_required', 422)
    prices = catalog(db)
    if amount_minor not in prices.packs: reject('invalid_pack', 422)
    acct = account(db, user.company_id)
    previous = db.query(MessagingTopup).filter_by(company_id=user.company_id, request_key=request_key).first()
    if previous:
        if previous.amount_minor != amount_minor: reject('request_conflict')
        return previous
    if settings.MESSAGING_ALLPAY_CHECKOUT_MODE not in ('redirect', 'hosted_fields'): reject('billing_not_configured')
    login, _ = allpay.credentials(messaging=True)
    row = MessagingTopup(id=uid(), company_id=user.company_id, request_key=request_key,
        amount_minor=amount_minor, test_mode=settings.MESSAGING_ALLPAY_TEST_MODE, status='pending',
        provider_login=login, checkout_mode=settings.MESSAGING_ALLPAY_CHECKOUT_MODE)
    db.add(row)
    db.commit()  # Persist the provider order before any external operation.
    body = {'order_id': row.id, 'items': [{'name': 'Prysm messaging', 'qty': 1, 'price': amount_minor / 100, 'vat': 1}],
        'currency_display': 'ILS', 'currency_payment': 'ILS', 'lang': locale.upper(),
        'client_name': user.full_name or user.username, 'client_email': user.email,
        'webhook_url': (settings.MESSAGING_PAYMENT_PUBLIC_URL or settings.API_PUBLIC_URL) + '/api/v1/subscriptions/webhooks/allpay',
        'success_url': settings.SITE_URL + '/account/billing?messaging_topup=' + row.id,
        'expire': int((now() + timedelta(days=7)).timestamp())}
    try:
        result = allpay.request('getpayment', body, **payment_options(row))
        account(db, user.company_id)
        row = db.query(MessagingTopup).filter_by(id=body['order_id']).with_for_update().populate_existing().one()
        row.payment_url = result.get('payment_url')
        if not row.payment_url or not row.payment_url.startswith('https://'):
            if row.status not in ('paid', 'refunded', 'partially_refunded'): row.status = 'uncertain'
        db.commit()
    except allpay.AllpayError as error:
        db.rollback()
        account(db, user.company_id)
        row = db.query(MessagingTopup).filter_by(id=body['order_id']).with_for_update().populate_existing().one()
        if row.status in ('paid', 'refunded', 'partially_refunded'):
            db.commit()
            return row
        row.status = 'uncertain' if error.uncertain else 'failed'
        db.commit()
        reject('payment_pending' if error.uncertain else 'payment_failed', 503)
    return row


def reconcile(db, topup_id, include_reverts=False):
    stub = db.get(MessagingTopup, topup_id)
    if not stub: reject('payment_not_found', 404)
    if stub.test_mode != (settings.MESSAGING_ALLPAY_TEST_MODE if stub.provider_login else settings.ALLPAY_TEST_MODE): reject('payment_environment_mismatch')
    try:
        payload = allpay.request('paymentstatus', {'order_id': topup_id}, **payment_options(stub))
    except allpay.AllpayError:
        reject('reconciliation_pending', 503)
    reverts = []
    if include_reverts:
        today = now().astimezone(ZoneInfo('Asia/Jerusalem')).date()
        page = 1
        while page:
            try:
                exported = allpay.request('gettransactions', {'order_id': stub.id, 'type': 'chargeback_revert',
                    'date_from': (today - timedelta(days=30)).isoformat(), 'date_to': today.isoformat(), 'page': page}, **payment_options(stub))
            except allpay.AllpayError: reject('reconciliation_pending', 503)
            if not isinstance(exported.get('transactions'), list): reject('reconciliation_pending', 503)
            reverts.extend(exported['transactions'])
            page = int(exported.get('next_page', 0))
            if page > 100: reject('reconciliation_pending', 503)
    acct = account(db, stub.company_id)
    row = db.query(MessagingTopup).filter_by(id=topup_id).with_for_update().populate_existing().one()
    if str(payload.get('order_id')) != row.id: reject('payment_mismatch')
    if payload.get('currency_display') != 'ILS' or payload.get('currency_payment') != 'ILS' or Decimal(str(payload.get('currency_course', 1))) != 1:
        reject('payment_mismatch')
    gross = Decimal(str(payload.get('order_amount', payload.get('amount', 0)))) * 100
    if int(payload.get('status', 0)) in (1, 3, 4) and gross != row.amount_minor: reject('payment_mismatch')
    for transaction in reverts:
        if transaction.get('type') != 'chargeback_revert' or transaction.get('order_id') != row.id or transaction.get('currency_payment') != 'ILS':
            reject('payment_mismatch')
        key = 'allpay-revert:' + str(transaction['transaction_id'])
        if not db.query(MessagingLedger.id).filter_by(key=key).first():
            amount = int(Decimal(str(transaction['amount'])) * MICRO)
            if amount <= 0 or amount > row.reversed: reject('reconciliation_pending', 503)
            acct.balance += amount
            row.reversed -= amount
            entry(db, row.company_id, key, 'chargeback_revert', amount, reference=row.id)
            db.flush()  # Include this restoration in the aggregate below with autoflush disabled.
    restored = db.query(func.coalesce(func.sum(MessagingLedger.amount), 0)).filter_by(
        company_id=row.company_id, kind='chargeback_revert', reference=row.id).scalar()
    status = int(payload.get('status', 0))
    if status in (1, 3, 4):
        if not db.query(MessagingLedger.id).filter_by(key='topup:' + row.id).first():
            acct.balance += row.amount_minor * AGORA
            entry(db, row.company_id, 'topup:' + row.id, 'topup', row.amount_minor * AGORA, reference=row.id)
        row.status = 'paid'
        receipt = payload.get('receipt', '')
        if isinstance(receipt, str) and receipt.startswith('https://'): row.receipt_url = receipt
        if status in (3, 4):
            refunded = max(0, min(row.amount_minor * AGORA, int(Decimal(str(payload.get('refunded', payload.get('amount', 0)))) * MICRO)) - restored)
            if refunded > row.reversed:
                delta = refunded - row.reversed
                acct.balance -= delta
                entry(db, row.company_id, f'reversal:{row.id}:{refunded}:{restored}', 'reversal', -delta, reference=row.id)
                row.reversed = refunded
            row.status = 'paid' if refunded == 0 else 'refunded' if refunded == row.amount_minor * AGORA else 'partially_refunded'
            for refund in db.query(MessagingRefund).filter_by(topup_id=row.id, status='submitted').all():
                if refunded >= refund.reversed_before + refund.amount_minor * AGORA:
                    acct.reserved -= refund.amount_minor * AGORA
                    refund.status = 'paid'
                    entry(db, row.company_id, 'refund-release:' + refund.id, 'release', refund.amount_minor * AGORA, reference=row.id)
    elif payload.get('decline_code'):
        row.status = 'failed'
    elif aware(row.created_at) + timedelta(days=7) < now():
        row.status = 'expired'
    db.commit()
    return row


def refund(db, topup_id, amount_minor, owner, reason):
    from services.saas_billing import audit
    stub = db.get(MessagingTopup, topup_id)
    if not stub: reject('payment_not_found', 404)
    acct = account(db, stub.company_id)
    row = db.query(MessagingTopup).filter_by(id=topup_id).with_for_update().populate_existing().one()
    if row.test_mode != (settings.MESSAGING_ALLPAY_TEST_MODE if row.provider_login else settings.ALLPAY_TEST_MODE): reject('payment_environment_mismatch')
    if row.status not in ('paid', 'partially_refunded'): reject('refund_not_available')
    pending = db.query(MessagingRefund).filter_by(topup_id=row.id, status='submitted').first()
    if pending: reject('reconciliation_pending')
    amount = amount_minor * AGORA
    if not 0 < amount <= min(acct.balance - acct.reserved, row.amount_minor * AGORA - row.reversed): reject('refund_not_available')
    item = MessagingRefund(id=uid(), topup_id=row.id, amount_minor=amount_minor, reversed_before=row.reversed, status='submitted')
    db.add(item)
    acct.reserved += amount
    entry(db, row.company_id, 'refund-reserve:' + item.id, 'reserve', -amount, reference=row.id)
    audit(db, row.company_id, owner.id, 'messaging_refund', reason, {}, {'refund_id': item.id, 'amount_minor': amount_minor})
    db.commit()
    try:
        allpay.request('refund', {'order_id': row.id, 'amount': amount_minor / 100}, **payment_options(row))
    except allpay.AllpayError as error:
        if not error.uncertain:
            acct = account(db, row.company_id)
            item = db.query(MessagingRefund).filter_by(id=item.id).with_for_update().populate_existing().one()
            if item.status == 'submitted':
                acct.reserved -= amount
                item.status = 'failed'
                entry(db, row.company_id, 'refund-release:' + item.id, 'release', amount, reference=row.id)
                db.commit()
        reject('reconciliation_pending' if error.uncertain else 'refund_failed', 503)
    reconcile(db, row.id)
    return {'id': item.id, 'status': item.status}
