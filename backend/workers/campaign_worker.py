"""API-owned durable scheduler/consumer; replicas coordinate with database row locks."""
import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from datetime import timedelta
from sqlalchemy import or_
from database import SessionLocal
from models import Campaign, Clinic, Client, User
from campaign_models import CampaignDetails, CampaignDelivery, MessagingCatalog, now
from services import campaign_engine as engine, campaign_providers as providers, messaging_billing as money, campaign_monitoring as monitoring
from services.subscription_service import aware
from config import settings

logger = logging.getLogger(__name__)


def schedule_once(sessions=SessionLocal):
    with sessions() as db:
        if not settings.CAMPAIGN_SENDING_ENABLED or not money.catalog(db).enabled: return False
        candidate = db.query(CampaignDetails.campaign_id).filter(CampaignDetails.status == 'scheduled', CampaignDetails.next_run <= now()).order_by(CampaignDetails.next_run).first()
        if not candidate: return False
        c = db.get(Campaign, candidate[0])
        clinic = db.get(Clinic, c.clinic_id)
        money.account(db, clinic.company_id)
        d = db.query(CampaignDetails).filter_by(campaign_id=c.id).with_for_update().populate_existing().one()
        if d.status != 'scheduled' or not d.next_run or aware(d.next_run) > now(): return False
        due = aware(d.next_run)
        try:
            user = db.get(User, d.actor_id)
            if not user or not user.is_active: money.reject('account_inactive')
            engine.create_run(db, c, user, 'schedule:' + due.isoformat(), scheduled=True)
            # create_run commits its claim/run; reacquire for schedule advancement.
            money.account(db, clinic.company_id)
            d = db.query(CampaignDetails).filter_by(campaign_id=c.id).with_for_update().populate_existing().one()
            if d.status == 'scheduled':
                d.next_run = engine.next_occurrence(d.schedule, now())
                if not d.next_run: d.status = 'completed'; c.active = False
            db.commit()
        except Exception as error:
            db.rollback()
            money.account(db, clinic.company_id)
            d = db.query(CampaignDetails).filter_by(campaign_id=c.id).with_for_update().populate_existing().one()
            code = getattr(error, 'detail', {})
            d.status, d.next_run, c.active = 'blocked', None, False
            d.last_error = code.get('code', 'execution_failed') if isinstance(code, dict) else 'execution_failed'
            db.commit()
        return True


def deliver_once(sessions=SessionLocal):
    with sessions() as db:
        candidate = db.query(CampaignDelivery.id, CampaignDelivery.company_id).filter(
            or_(CampaignDelivery.status == 'queued', (CampaignDelivery.status == 'sending') & (CampaignDelivery.lease_until < now())),
            or_(CampaignDelivery.next_attempt.is_(None), CampaignDelivery.next_attempt <= now())).order_by(CampaignDelivery.created_at).first()
        if not candidate: return False
        money.account(db, candidate[1])
        delivery = db.query(CampaignDelivery).filter_by(id=candidate[0]).with_for_update().populate_existing().one()
        if delivery.status == 'sending':
            if delivery.lease_until and aware(delivery.lease_until) < now():
                delivery.status, delivery.error = 'uncertain', 'worker_interrupted'
                db.commit()
                return True
            return False
        if delivery.status != 'queued': return False
        c = db.get(Campaign, delivery.campaign_id)
        d = engine.details(db, c)
        try:
            if not settings.CAMPAIGN_SENDING_ENABLED or not money.catalog(db).enabled: return False
            actor_id = db.get(engine.CampaignRun, delivery.run_id).actor_id
            actor = db.get(User, actor_id)
            if not actor: money.reject('account_inactive')
            engine.manager(actor)
            from security.scope import get_scoped_campaign
            get_scoped_campaign(db, actor, delivery.campaign_id)
            engine.campaign_delivery(db, delivery.clinic_id, actor_id)
            if d.status in ('paused', 'archived', 'needs_review', 'blocked'): money.reject('campaign_paused')
            if not delivery.test:
                client = db.get(Client, delivery.client_id)
                if not client or client.deleted_at or client.merged_into_client_id or not client.send_notifications:
                    money.reject('opted_out')
                raw = client.email if delivery.channel == 'email' else client.phone_mobile
                if engine.filters.normalize(delivery.channel, raw) != delivery.destination: money.reject('contact_changed')
            if not delivery.test and not engine.filters.consented(db, delivery.company_id, delivery.channel, delivery.destination):
                money.reject('consent_required')
            if engine.filters.suppressed(db, delivery.company_id, delivery.channel, delivery.destination): money.reject('suppressed')
            if delivery.channel == 'sms':
                if not delivery.content.endswith(engine.sms_unsubscribe_url(delivery.id)):
                    money.reject('unsubscribe_origin_changed')
                adapter = providers.sms_adapter()
                if not adapter or not adapter.ready(): money.reject('sms_not_configured')
                units, policy = adapter.billing(delivery.content)
                if policy != delivery.billing_policy or units != delivery.billing_units: money.reject('sms_tariff_changed')
            if money.account(db, delivery.company_id).balance < 0: money.reject('insufficient_balance')
        except Exception as error:
            delivery.status = 'suppressed'
            detail = getattr(error, 'detail', {})
            delivery.error = detail.get('code', 'scope_denied') if isinstance(detail, dict) else 'scope_denied'
            money.settle_delivery(db, delivery, False)
            engine.finish_run(db, delivery.run_id)
            db.commit()
            return True
        if delivery.channel == 'email':
            wait = monitoring.email_slot(db)
            if wait:
                delivery.next_attempt, delivery.error = wait
                db.commit()
                return True
        db.get(engine.CampaignRun, delivery.run_id).status = 'running'
        delivery.status, delivery.lease_until = 'sending', now() + timedelta(minutes=2)
        delivery.attempts += 1
        delivery.provider = 'resend' if delivery.channel == 'email' else getattr(providers.sms_adapter(), 'name', 'unconfigured')
        db.commit()  # Durable send intent: crashes from here become uncertain, never blind retries.
        clinic = db.get(Clinic, delivery.clinic_id)
        config = money.clinic_settings(db, clinic.id)
        try:
            if delivery.channel == 'email':
                result = providers.send_email(delivery, config.reply_to, engine.unsubscribe_url(delivery.id), clinic.name)
            else:
                adapter = providers.sms_adapter()
                result = adapter.send(destination=delivery.destination, content=delivery.content, key=delivery.id) if adapter and adapter.ready() else providers.Outcome('failed', code='sms_not_configured')
        except Exception:
            result = providers.Outcome('uncertain', code='provider_exception')
        db.rollback()
        money.account(db, candidate[1])
        delivery = db.query(CampaignDelivery).filter_by(id=candidate[0]).with_for_update().populate_existing().one()
        if delivery.channel == 'email': monitoring.email_outcome(db, result)
        engine.apply_outcome(db, delivery, result)
        db.commit()
        return True


def reconcile_events(sessions=SessionLocal):
    from campaign_models import MessagingEvent
    with sessions() as db:
        events = db.query(MessagingEvent).join(CampaignDelivery, (CampaignDelivery.provider == 'micropay') & (CampaignDelivery.provider_id == MessagingEvent.payload['provider_id'].as_string())).filter(MessagingEvent.kind == 'pending').order_by(MessagingEvent.created_at).limit(100).all()
        for event in events:
            if event.payload: engine.provider_event(db, event.payload, 'micropay')


def loop(stop):
    import time
    heartbeat = 0
    while not stop.is_set():
        try:
            if time.monotonic() - heartbeat > 30:
                with SessionLocal() as db:
                    db.query(MessagingCatalog).filter_by(id=1).update({'worker_heartbeat': now()})
                    for name, ready in [('resend', providers.email_ready()), ('micropay', providers.sms_adapter().ready())]:
                        if ready:
                            provider = monitoring.state(db, name)
                            if not provider.checked_at or now() - aware(provider.checked_at) > timedelta(minutes=5):
                                monitoring.refresh(db, name)
                    db.commit()
                heartbeat = time.monotonic()
            reconcile_events()
            if settings.CAMPAIGN_SENDING_ENABLED:
                schedule_once()
                if deliver_once(): continue
        except Exception as error:
            # No message text, credentials, phone numbers or provider response bodies in logs.
            logger.warning('campaign_worker_unavailable type=%s', type(error).__name__)
        stop.wait(5)


@asynccontextmanager
async def campaign_services():
    if not settings.CAMPAIGNS_ENABLED:
        yield
        return
    stop = threading.Event()
    thread = threading.Thread(target=loop, args=(stop,), name='campaign-delivery', daemon=True)
    thread.start()
    try: yield
    finally:
        stop.set()
        await asyncio.to_thread(thread.join, 25)
