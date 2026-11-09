"""Authoritative campaign previews, immutable runs and delivery settlement."""
import calendar
import hashlib
import hmac
import json
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from jose import jwt, JWTError
from fastapi import HTTPException
from sqlalchemy import func
from models import Campaign, CampaignClientExecution, Clinic, Client, Settings, User
from campaign_models import (CampaignDetails, CampaignRun, CampaignDelivery, CampaignContactClaim,
    MessagingEvent, MessagingSuppression, MessagingConsent, MessagingLedger, now, uid)
from services import campaign_filters as filters, campaign_providers as providers, messaging_billing as money
from services.subscription_service import aware
from security.entitlements import campaign_delivery
from config import settings

ACCEPTED = ('submitted', 'delivered', 'bounced', 'complained', 'undeliverable')
TERMINAL = (*ACCEPTED, 'failed', 'suppressed', 'cancelled')


def manager(user):
    if (user.role_level or 1) < 3: money.reject('manager_required', 403)


def details(db, campaign):
    row = db.get(CampaignDetails, campaign.id)
    if not row:
        row = CampaignDetails(campaign_id=campaign.id, revision=1, subject=campaign.name,
            status='needs_review', schedule={}, locale='he', all_clients=False)
        db.add(row)
        db.flush()
    return row


def serialize(db, campaign):
    d = details(db, campaign)
    return {**{key: getattr(campaign, key) for key in ('id', 'clinic_id', 'name', 'filters', 'email_enabled',
        'email_content', 'sms_enabled', 'sms_content', 'execute_once_per_client', 'created_at', 'active', 'last_executed', 'mail_sent', 'sms_sent', 'emails_sent_count', 'sms_sent_count')},
        **{key: getattr(d, key) for key in ('revision', 'subject', 'locale', 'all_clients', 'status', 'schedule',
            'next_run', 'max_cost', 'last_error')}}


def unsubscribe_url(delivery_id):
    digest = hmac.new(settings.SECRET_KEY.encode(), ('campaign-unsubscribe:' + delivery_id).encode(), hashlib.sha256).hexdigest()[:32]
    return (settings.CAMPAIGN_PUBLIC_URL or settings.API_PUBLIC_URL) + '/api/v1/messaging/unsubscribe/' + delivery_id + '.' + digest


def sms_unsubscribe_url(delivery_id):
    import base64
    raw = bytes.fromhex(delivery_id)
    if len(raw) != 16: raise ValueError('delivery_id')
    identifier = base64.urlsafe_b64encode(raw).decode().rstrip('=')
    mac = hmac.new(settings.SECRET_KEY.encode(), b'campaign-sms-unsubscribe:' + raw, hashlib.sha256).digest()[:12]
    token = identifier + base64.urlsafe_b64encode(mac).decode().rstrip('=')
    return (settings.CAMPAIGN_PUBLIC_URL or settings.API_PUBLIC_URL) + '/s/' + token


def decode_unsubscribe(token):
    try:
        if '.' not in token:
            import base64
            import re
            if not re.fullmatch(r'[A-Za-z0-9_-]{38}', token): raise ValueError()
            raw = base64.b64decode(token[:22] + '==', altchars=b'-_', validate=True)
            delivery_id = raw.hex()
            if not hmac.compare_digest(sms_unsubscribe_url(delivery_id).rsplit('/', 1)[-1], token): raise ValueError()
            return delivery_id
        delivery_id, signature = token.split('.')
        if len(delivery_id) != 32 or not hmac.compare_digest(unsubscribe_url(delivery_id).split('.')[-1], signature):
            raise ValueError()
        return delivery_id
    except (ValueError, TypeError):
        money.reject('invalid_link', 404)


def render(content, client, clinic, config):
    values = {'first_name': client.first_name or '', 'last_name': client.last_name or '', 'clinic_name': clinic.name,
        'clinic_phone': getattr(config, 'clinic_phone', '') or '', 'clinic_email': getattr(config, 'clinic_email', '') or '',
        'clinic_address': getattr(config, 'clinic_address', '') or ''}
    import re
    if set(re.findall(r'\{([^{}]+)\}', content or '')) - set(values): money.reject('invalid_placeholder', 422)
    return re.sub(r'\{([^{}]+)\}', lambda m: values[m.group(1)], content or '')


def audience(db, campaign, d, test_destinations=None):
    clinic = db.get(Clinic, campaign.clinic_id)
    config = db.query(Settings).filter_by(clinic_id=clinic.id).first()
    cfg = money.clinic_settings(db, clinic.id)
    today = now().astimezone(ZoneInfo(cfg.timezone)).date()
    skipped = {}
    targets, seen = [], set()
    blocked = {(r.channel, r.destination) for r in db.query(MessagingSuppression).filter(MessagingSuppression.scope.in_([0, clinic.company_id])).all()}
    consented = {(r.channel, r.destination) for r in db.query(MessagingConsent).filter_by(company_id=clinic.company_id, granted=True)}
    claimed = set()
    if campaign.execute_once_per_client:
        claimed = {(r.client_id, r.channel) for r in db.query(CampaignContactClaim).filter_by(campaign_id=campaign.id)}
        for r in db.query(CampaignClientExecution).filter_by(campaign_id=campaign.id, status='success'):
            for channel in ([r.channel] if r.channel in ('email', 'sms') else ['email', 'sms']): claimed.add((r.client_id, channel))
    def skip(code): skipped[code] = skipped.get(code, 0) + 1
    clients = filters.clients_query(db, campaign, d, clinic.company_id, today).order_by(Client.id).yield_per(500)
    if test_destinations is not None:
        if len(test_destinations) > 3: money.reject('test_limit', 422)
        # Synthetic personalization; tests never select real patients.
        clients = [Client(id=None, first_name='Test', last_name='', send_notifications=True,
            email=item.get('email'), phone_mobile=item.get('sms')) for item in test_destinations]
    for client in clients:
        for channel, enabled, raw, content in [('email', campaign.email_enabled, client.email, campaign.email_content),
                ('sms', campaign.sms_enabled, client.phone_mobile, campaign.sms_content)]:
            if not enabled: continue
            if not client.send_notifications: skip('opted_out'); continue
            destination = filters.normalize(channel, raw)
            if not destination: skip('invalid_' + channel); continue
            if (channel, destination) in blocked: skip('suppressed'); continue
            if test_destinations is None and (channel, destination) not in consented: skip('consent_required'); continue
            if (channel, destination) in seen: skip('duplicate'); continue
            if campaign.execute_once_per_client and client.id and (client.id, channel) in claimed:
                skip('already_contacted'); continue
            if not content or not content.strip(): money.reject('empty_' + channel, 422)
            body = render(content, client, clinic, config)
            subject = render(d.subject or campaign.name, client, clinic, config)
            if channel == 'sms': body += '\n' + sms_unsubscribe_url('0' * 32)
            count = providers.segments(body) if channel == 'sms' else 1
            if count > 10: money.reject('sms_too_long', 422)
            units, policy = 1, None
            if channel == 'sms':
                try: units, policy = providers.sms_adapter().billing(body)
                except (ValueError, TypeError): money.reject('sms_tariff_not_configured', 422)
            seen.add((channel, destination))
            targets.append({'client_id': client.id, 'channel': channel, 'destination': destination,
                'content': body, 'subject': subject, 'segments': count, 'billing_units': units, 'billing_policy': policy})
    return targets, skipped


def estimate(db, campaign, d, acct, test_destinations=None, retry_run=None):
    prices = money.catalog(db)
    targets, skipped = audience(db, campaign, d, test_destinations)
    if retry_run:
        source = db.query(CampaignRun).filter_by(id=retry_run, campaign_id=campaign.id, company_id=acct.company_id).first()
        if not source or source.snapshot.get('test') or source.snapshot.get('revision') != d.revision:
            money.reject('quote_stale')
        failed = {(r.client_id, r.channel, r.destination) for r in db.query(CampaignDelivery).filter_by(run_id=retry_run, status='failed')}
        targets = [r for r in targets if (r['client_id'], r['channel'], r['destination']) in failed]
    free = {channel: value['remaining'] for channel, value in money.allowances(db, acct).items()}
    channels = {channel: {'included_units': 0, 'paid_units': 0, 'cost': 0} for channel in free}
    total, included = 0, 0
    errors = []
    if not prices.enabled or not settings.CAMPAIGN_SENDING_ENABLED: errors.append('sending_disabled')
    if campaign.email_enabled and not providers.email_ready(): errors.append('email_not_configured')
    if campaign.email_enabled and not money.clinic_settings(db, campaign.clinic_id).reply_to: errors.append('reply_to_required')
    adapter = providers.sms_adapter()
    if campaign.sms_enabled and (not adapter or not adapter.ready()): errors.append('sms_not_configured')
    if not acct.period_start: errors.append('allowance_period_required')
    for t in targets:
        rate = prices.email_rate if t['channel'] == 'email' else prices.sms_rate
        channel = t['channel']
        t['allowance'] = min(t['billing_units'], free[channel])
        free[channel] -= t['allowance']
        included += t['allowance']
        channels[channel]['included_units'] += t['allowance']
        channels[channel]['paid_units'] += t['billing_units'] - t['allowance']
        if rate is None: errors.append('pricing_not_configured')
        t['cost'] = (rate or 0) * (t['billing_units'] - t['allowance'])
        channels[channel]['cost'] += t['cost']
        total += t['cost']
    if not targets: errors.append('no_recipients')
    if total > acct.balance - acct.reserved: errors.append('insufficient_balance')
    digest = hashlib.sha256(json.dumps({'targets': targets, 'revision': d.revision, 'catalog': prices.revision}, sort_keys=True).encode()).hexdigest()
    return {'targets': targets, 'excluded': skipped, 'total_cost': total, 'included': included, 'channels': channels,
        'emails': sum(t['channel'] == 'email' for t in targets),
        'sms': sum(t['channel'] == 'sms' for t in targets), 'billing_units': sum(t['billing_units'] for t in targets if t['channel'] == 'sms'), 'segments': sum(t['segments'] for t in targets if t['channel'] == 'sms'),
        'errors': sorted(set(errors)), 'fingerprint': digest, 'catalog_revision': prices.revision}


def preview(db, campaign, user, tests=None, retry_run=None):
    acct = money.account(db, user.company_id)
    d = details(db, campaign)
    value = estimate(db, campaign, d, acct, tests, retry_run)
    claims = {'purpose': 'campaign-quote', 'company': user.company_id, 'user': user.id, 'campaign': campaign.id,
        'fingerprint': value['fingerprint'], 'tests': tests, 'retry_run': retry_run, 'exp': now() + timedelta(minutes=10)}
    return {key: val for key, val in value.items() if key not in ('targets', 'fingerprint')} | {
        'quote': jwt.encode(claims, settings.SECRET_KEY, algorithm=settings.ALGORITHM),
        'sample': [{'channel': t['channel'], 'content': t['content'], 'subject': t['subject'], 'segments': t['segments']} for t in value['targets'][:2]]}


def create_run(db, campaign, user, request_key, quote=None, tests=None, scheduled=False, retry_run=None):
    manager(user)
    acct = money.account(db, user.company_id)
    d = db.query(CampaignDetails).filter_by(campaign_id=campaign.id).with_for_update().populate_existing().first() or details(db, campaign)
    previous = db.query(CampaignRun).filter_by(campaign_id=campaign.id, request_key=request_key).first()
    if previous:
        db.commit()
        return previous
    campaign_delivery(db, campaign.clinic_id, user.id)
    if d.status == 'archived': money.reject('campaign_archived')
    value = estimate(db, campaign, d, acct, tests, retry_run)
    if value['errors']: money.reject(value['errors'][0])
    if not scheduled:
        try:
            claims = jwt.decode(quote or '', settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
            if any([claims.get('purpose') != 'campaign-quote', claims.get('user') != user.id,
                claims.get('company') != user.company_id, claims.get('campaign') != campaign.id,
                claims.get('fingerprint') != value['fingerprint'], claims.get('tests') != tests, claims.get('retry_run') != retry_run]): raise ValueError()
        except (JWTError, ValueError): money.reject('quote_stale')
    elif d.approved_catalog != value['catalog_revision'] or d.max_cost is None or value['total_cost'] > d.max_cost:
        money.reject('schedule_review_required')
    if not scheduled and d.status in ('needs_review', 'blocked', 'paused', 'completed'):
        d.status, d.last_error = 'draft', None
    run = CampaignRun(id=uid(), company_id=user.company_id, clinic_id=campaign.clinic_id,
        campaign_id=campaign.id, request_key=request_key, actor_id=user.id,
        snapshot={'revision': d.revision, 'catalog': value['catalog_revision'], 'cost': value['total_cost'], 'excluded': value['excluded'], 'test': tests is not None, 'retry_run': retry_run})
    deliveries = []
    for target in value['targets']:
        delivery = CampaignDelivery(id=uid(), run_id=run.id, campaign_id=campaign.id, company_id=user.company_id,
            clinic_id=campaign.clinic_id, **target, test=tests is not None, status='queued')
        if delivery.channel == 'sms': delivery.content = delivery.content.replace(sms_unsubscribe_url('0' * 32), sms_unsubscribe_url(delivery.id))
        deliveries.append(delivery)
    money.reserve(db, acct, deliveries)
    db.add(run)
    db.flush()
    db.add_all(deliveries)
    db.flush()  # Batch recipients before claims; avoids one network round trip per recipient.
    if campaign.execute_once_per_client:
        db.add_all([CampaignContactClaim(campaign_id=campaign.id, client_id=delivery.client_id,
            channel=delivery.channel, delivery_id=delivery.id) for delivery in deliveries if delivery.client_id])
    campaign.last_executed = now()
    db.commit()
    return run


def next_occurrence(schedule, after):
    try:
        zone = ZoneInfo(schedule.get('timezone', 'Asia/Jerusalem'))
        kind = schedule.get('kind', 'once')
        first = datetime.fromisoformat(schedule['start'].replace('Z', '+00:00'))
        if first.tzinfo is None: first = first.replace(tzinfo=zone)
        first = first.astimezone(zone)
        if first > after: return first.astimezone(UTC)
        if kind == 'once': return None
        if kind not in ('daily', 'monthly', 'yearly', 'custom'): raise ValueError()
        interval = int(schedule.get('days', 1)) if kind == 'custom' else 1
        if not 1 <= interval <= 3660: raise ValueError()
        current = first
        # Advance calendar components from the original anchor, avoiding Jan31 -> Feb28 -> Mar28 drift.
        step = 1
        while current <= after:
            if kind in ('daily', 'custom'): current = first + timedelta(days=step * interval)
            else:
                months = step * (12 if kind == 'yearly' else 1)
                year, month0 = divmod(first.year * 12 + first.month - 1 + months, 12)
                current = first.replace(year=year, month=month0 + 1, day=min(first.day, calendar.monthrange(year, month0 + 1)[1]))
            step += 1
            if step > 40000: raise ValueError()
        # Round-trip nonexistent local times forward through UTC; fold=0 chooses first ambiguous time.
        return current.astimezone(UTC)
    except (KeyError, ValueError, TypeError, ZoneInfoNotFoundError, OverflowError):
        money.reject('invalid_schedule', 422)


def run_summary(db, run):
    counts = dict(db.query(CampaignDelivery.status, func.count()).filter_by(run_id=run.id).group_by(CampaignDelivery.status).all())
    return {'id': run.id, 'campaign_id': run.campaign_id, 'created_at': run.created_at, 'status': run.status,
        'snapshot': run.snapshot, 'counts': counts,
        'charged': sum(d.cost for d in db.query(CampaignDelivery).filter_by(run_id=run.id) if d.settled and d.status in ACCEPTED),
        'reserved': sum(d.cost for d in db.query(CampaignDelivery).filter_by(run_id=run.id) if not d.settled)}


def finish_run(db, run_id):
    # Production sessions disable autoflush; aggregate the delivery's new state.
    db.flush()
    run = db.get(CampaignRun, run_id)
    states = {x[0] for x in db.query(CampaignDelivery.status).filter_by(run_id=run_id).all()}
    if not states.intersection({'queued', 'sending', 'uncertain'}):
        run.status = 'cancelled' if states == {'cancelled'} else 'completed' if states.issubset(set(ACCEPTED)) else 'completed_with_errors'


def apply_outcome(db, delivery, outcome):
    if delivery.settled: return
    delivery.provider_id = outcome.provider_id or delivery.provider_id
    delivery.error = outcome.code
    if outcome.provider_cost is not None: delivery.provider_cost = outcome.provider_cost
    if outcome.status == 'retry':
        delivery.status = 'queued'
        delivery.next_attempt = now() + timedelta(seconds=outcome.retry_after or min(3600, 30 * 2 ** min(delivery.attempts, 6)))
    else:
        delivery.status = 'failed' if outcome.status == 'retry' else outcome.status
        if delivery.status in TERMINAL:
            money.settle_delivery(db, delivery, delivery.status in ACCEPTED)
            if delivery.status in ACCEPTED and not delivery.test:
                campaign = db.get(Campaign, delivery.campaign_id)
                if delivery.channel == 'email': campaign.emails_sent_count = (campaign.emails_sent_count or 0) + 1; campaign.mail_sent = True
                else: campaign.sms_sent_count = (campaign.sms_sent_count or 0) + 1; campaign.sms_sent = True
    delivery.lease_until = None
    finish_run(db, delivery.run_id)


def provider_event(db, event, provider):
    from services.campaign_monitoring import state
    prior = db.get(MessagingEvent, event['key'])
    if prior and prior.kind != 'pending': return
    stub = db.query(CampaignDelivery).filter_by(provider=provider, provider_id=event.get('provider_id')).first() if event.get('provider_id') else None
    if not stub and event.get('delivery_id'): stub = db.get(CampaignDelivery, event['delivery_id'])
    if not stub and provider == 'micropay':
        state(db, provider).last_callback_at = now()
        if not prior: db.add(MessagingEvent(key=event['key'], kind='pending', payload=event))
        db.commit()
        return
    if not stub or stub.provider != provider: money.reject('event_not_matched', 503)  # provider retries races with send response
    if event.get('destination') and event['destination'] != stub.destination: money.reject('event_not_matched', 400)
    acct = money.account(db, stub.company_id)
    state(db, provider).last_callback_at = now()
    prior = db.query(MessagingEvent).filter_by(key=event['key']).populate_existing().first()
    if prior and prior.kind != 'pending':
        db.commit()
        return
    d = db.query(CampaignDelivery).filter_by(id=stub.id).with_for_update().populate_existing().one()
    kind = event['type'].split('.')[-1]
    mapping = {'sent': 'submitted', 'delivered': 'delivered', 'bounced': 'bounced', 'complained': 'complained', 'failed': 'failed', 'undeliverable': 'undeliverable'}
    if kind in mapping:
        state = mapping[kind]
        if state in ACCEPTED and not d.settled: apply_outcome(db, d, providers.Outcome(state, event.get('provider_id')))
        elif not d.settled and state == 'failed': apply_outcome(db, d, providers.Outcome('failed', code='provider_failed'))
        elif d.settled and state == 'failed' and d.status in ACCEPTED:
            d.status, d.error = 'undeliverable', 'delivery_failed'
        if state == 'undeliverable' and d.status == 'submitted': d.status, d.error = 'undeliverable', 'delivery_failed'
        if state in ('bounced', 'complained') or state == 'delivered' and d.status not in ('bounced', 'complained'):
            d.status = state
        if state in ('bounced', 'complained') and not filters.suppressed(db, 0, d.channel, d.destination):
            db.add(MessagingSuppression(scope=0, channel=d.channel, destination=d.destination, reason=state))
    if prior:
        prior.delivery_id, prior.kind, prior.payload = d.id, kind, None
    else: db.add(MessagingEvent(key=event['key'], delivery_id=d.id, kind=kind))
    finish_run(db, d.run_id)
    db.commit()
