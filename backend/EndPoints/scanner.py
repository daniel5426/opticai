import asyncio
import hashlib
import json
import secrets
import time
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request, Query, Header
from fastapi.responses import StreamingResponse
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from sqlalchemy import func
from auth import get_current_user, get_current_auth_session, security, token_hash, validate_auth_session, validate_current_user
from config import settings
from database import get_db, SessionLocal
from models import User, AuthSession, CatalogVariant, CatalogProduct, Clinic
from scanner_models import ScannerDevice, ScannerPhone, ScannerGrant, ScannerPairing, ScannerAttempt, ScannerScan, ScannerEvent
from security.scope import normalize_clinic_id_for_company
from services.subscription_service import enforce_workspace
from services import scanner_service as svc

router = APIRouter(prefix='/scanner', tags=['Scanner'])

def enabled():
    if not settings.SCANNER_ENABLED:
        raise HTTPException(503, 'scanner.disabled')

def ready(db):
    enabled()
    if db.bind.dialect.name == 'postgresql' and not svc.listener_ready:
        raise HTTPException(503, 'scanner.offline')

def uid():
    return str(uuid.uuid4())

class DeviceInput(BaseModel):
    clinic_id: int
    name: str = Field(min_length=1, max_length=80)

class Binding(BaseModel):
    secret: str = Field(max_length=160)

class ReceiverInput(Binding):
    lease: str = Field(max_length=64)
    context: str = Field(max_length=64)
    destination: str = Field(default='details', pattern='^(details|order|exam|inventory|count)$')
    takeover: bool = False
    active: bool = True

class PairInput(BaseModel):
    code: str = Field(min_length=6, max_length=160)
    phone_token: str | None = Field(default=None, max_length=160)

class StartInput(BaseModel):
    takeover: bool = False

class ScanInput(BaseModel):
    request_id: str = Field(min_length=1, max_length=64)
    lease: str = Field(max_length=64)
    context: str = Field(max_length=64)
    barcode: str = Field(default='', max_length=256)
    variant_id: int | None = None
    source: str = Field(default='reader', pattern='^(reader|history)$')

class ResultInput(BaseModel):
    status: str = Field(pattern='^(applied|displayed|awaiting_confirmation|rejected|expired)$')


def owned(db, device_id, user, secret=None):
    d = db.query(ScannerDevice).filter_by(id=device_id).with_for_update().first()
    if not d or d.company_id != user.company_id:
        raise HTTPException(404, 'scanner.unavailable')
    normalize_clinic_id_for_company(db, user, d.clinic_id)
    if secret is not None and not secrets.compare_digest(d.secret_hash, token_hash(secret)):
        raise HTTPException(403, 'scanner.unavailable')
    return d

def receiver_live(db, d):
    if d.seen_at < time.time() - 35 or not d.session_id:
        return False
    try:
        session = validate_auth_session(db.get(AuthSession, d.session_id))
        user = validate_current_user(db.get(User, session.user_id))
        if session.clinic_id != d.clinic_id or user.company_id != d.company_id:
            return False
        normalize_clinic_id_for_company(db, user, d.clinic_id)
        enforce_workspace(db, d.company_id, write=True)
        return True
    except HTTPException:
        return False

def device_dict(db, d):
    live = receiver_live(db, d)
    user = db.get(User, d.user_id) if live else None
    return {'id': d.id, 'name': d.name, 'clinic_id': d.clinic_id, 'online': live,
        'recipient': (getattr(user, 'full_name', None) or user.username) if user else '',
        'lease': d.lease if live else None, 'context': d.context if live else None,
        'destination': d.destination if live else 'details'}

def phone_auth(credentials: HTTPAuthorizationCredentials = Depends(security), db=Depends(get_db)):
    enabled()
    p = db.query(ScannerPhone).filter_by(secret_hash=token_hash(credentials.credentials)).first()
    if not p or p.seen_at < time.time() - 90 * 86400:
        raise HTTPException(401, 'scanner.pairAgain')
    p.seen_at = time.time()
    db.commit()
    return p

def phone_device(db, phone, device_id):
    if not db.get(ScannerGrant, (phone.id, device_id)):
        raise HTTPException(403, 'scanner.unavailable')
    d = db.query(ScannerDevice).filter_by(id=device_id).with_for_update().first()
    if not d:
        raise HTTPException(404, 'scanner.unavailable')
    return d

@router.get('/status')
def status(user=Depends(get_current_user)):
    return {'enabled': settings.SCANNER_ENABLED, 'listener_ready': svc.listener_ready}

@router.post('/devices')
def enroll(body: DeviceInput, db=Depends(get_db), user=Depends(get_current_user)):
    ready(db)
    clinic_id = normalize_clinic_id_for_company(db, user, body.clinic_id)
    secret = secrets.token_urlsafe(48)
    d = ScannerDevice(id=uid(), company_id=user.company_id, clinic_id=clinic_id, name=body.name.strip(), secret_hash=token_hash(secret))
    db.add(d)
    db.commit()
    return device_dict(db, d) | {'secret': secret}

@router.put('/devices/{device_id}/receiver')
def receiver(device_id: str, body: ReceiverInput, db=Depends(get_db), user=Depends(get_current_user), session=Depends(get_current_auth_session)):
    ready(db)
    d = owned(db, device_id, user, body.secret)
    if session.clinic_id != d.clinic_id:
        raise HTTPException(403, 'scanner.unavailable')
    if receiver_live(db, d) and d.lease != body.lease and not body.takeover:
        raise HTTPException(409, 'scanner.busy')
    changed = d.lease != body.lease or d.context != body.context or d.session_id != session.id or not body.active
    recipient_changed = d.lease != body.lease or d.session_id != session.id or not body.active
    if changed:
        db.query(ScannerScan).filter(ScannerScan.device_id == d.id, ScannerScan.status.in_(['pending', 'awaiting_confirmation'])).update({'status': 'expired'})
        if recipient_changed:
            d.phone_id = None
    d.lease, d.context, d.destination = body.lease, body.context, body.destination
    d.session_id, d.user_id = session.id, user.id
    d.seen_at = time.time() if body.active else 0
    if changed:
        svc.emit(db, d.id, {'type': 'device'})
    else:
        db.commit()
    return device_dict(db, d)

@router.post('/devices/{device_id}/pairing')
def challenge(device_id: str, body: Binding, db=Depends(get_db), user=Depends(get_current_user)):
    ready(db)
    d = owned(db, device_id, user, body.secret)
    db.query(ScannerPairing).filter_by(device_id=d.id).delete()
    code = ''.join(secrets.choice('23456789ABCDEFGHJKLMNPQRSTUVWXYZ') for _ in range(8))
    db.add(ScannerPairing(id=uid(), device_id=d.id, secret_hash=token_hash(code), expires_at=time.time()+300))
    db.commit()
    return {'code': code, 'expires_in': 300}

@router.post('/pair')
def pair(body: PairInput, request: Request, db=Depends(get_db)):
    ready(db)
    now = time.time()
    # Rate limit is shared across replicas, including failed attempts.
    key = token_hash(request.client.host if request.client else 'unknown')
    # Serialize this bucket without introducing a transaction-pooled session lock.
    if db.bind.dialect.name == 'postgresql':
        from sqlalchemy import text
        db.execute(text('SELECT pg_advisory_xact_lock(:key)'), {'key': int(key[:15], 16)})
    bucket = db.get(ScannerAttempt, key)
    if not bucket:
        bucket = ScannerAttempt(id=key, attempts=0, expires_at=now+60)
        db.add(bucket)
    if bucket.expires_at < now:
        bucket.attempts, bucket.expires_at = 0, now+60
    bucket.attempts += 1
    blocked = bucket.attempts > 5
    db.commit()
    if blocked:
        raise HTTPException(429, 'scanner.tooManyAttempts')
    challenge = db.query(ScannerPairing).filter_by(secret_hash=token_hash(body.code.strip().upper())).with_for_update().first()
    if not challenge or challenge.expires_at < now:
        raise HTTPException(400, 'scanner.pairAgain')
    phone = db.query(ScannerPhone).filter_by(secret_hash=token_hash(body.phone_token or '')).first()
    token = body.phone_token
    if not phone or phone.seen_at < now-90*86400:
        token = secrets.token_urlsafe(48)
        phone = ScannerPhone(id=uid(), secret_hash=token_hash(token), seen_at=now)
        db.add(phone)
        db.flush()
    if not db.get(ScannerGrant, (phone.id, challenge.device_id)):
        db.add(ScannerGrant(phone_id=phone.id, device_id=challenge.device_id))
    db.delete(challenge)
    db.commit()
    return {'token': token}

@router.get('/phone/devices')
def devices(phone=Depends(phone_auth), db=Depends(get_db)):
    return [device_dict(db, d) for d in db.query(ScannerDevice).join(ScannerGrant).filter(ScannerGrant.phone_id == phone.id)]

@router.delete('/devices/{device_id}/grants')
def revoke(device_id: str, body: Binding, db=Depends(get_db), user=Depends(get_current_user)):
    d = owned(db, device_id, user, body.secret)
    db.query(ScannerGrant).filter_by(device_id=d.id).delete()
    d.phone_id = None
    svc.emit(db, d.id, {'type': 'device'})
    return {'success': True}

@router.post('/phone/devices/{device_id}/start')
def start(device_id: str, body: StartInput, phone=Depends(phone_auth), db=Depends(get_db)):
    ready(db)
    d = phone_device(db, phone, device_id)
    if not receiver_live(db, d):
        raise HTTPException(409, 'scanner.offline')
    if d.phone_id and d.phone_id != phone.id and d.phone_seen_at > time.time()-35 and not body.takeover:
        raise HTTPException(409, 'scanner.busy')
    d.phone_id, d.phone_seen_at = phone.id, time.time()
    db.commit()
    return device_dict(db, d)


def submit(db, d, body, source, phone=None, desktop_user=None):
    ready(db)
    existing = db.query(ScannerScan).filter_by(device_id=d.id, request_id=body.request_id).first()
    if existing:
        if existing.phone_id != (phone.id if phone else None):
            raise HTTPException(409, 'scanner.busy')
        return svc.scan_dict(existing)
    if not receiver_live(db, d) or d.lease != body.lease or d.context != body.context:
        raise HTTPException(409, 'scanner.offline')
    if phone and (d.phone_id != phone.id or d.phone_seen_at < time.time()-35):
        raise HTTPException(409, 'scanner.busy')
    if db.query(ScannerScan).filter(ScannerScan.device_id == d.id, ScannerScan.status.in_(['pending', 'awaiting_confirmation']), ScannerScan.created_at > time.time()-120).first():
        raise HTTPException(409, 'scanner.busy')
    barcode = body.barcode.strip()
    if source != 'history' and (not barcode or any(ord(c)<32 or ord(c)==127 for c in barcode)):
        raise HTTPException(422, 'barcode.invalid')
    from EndPoints.inventory import _variant_query
    from services.inventory_service import variant_dict, can_view_cost
    q = _variant_query(db, company_id=d.company_id, clinic_id=d.clinic_id, include_archived=True)
    row = q.filter(CatalogVariant.id == body.variant_id).first() if source == 'history' else q.filter(CatalogVariant.barcode == barcode).first()
    variant, product, balance = row if row else (None, None, None)
    summary = {}
    if variant:
        summary = {'name': ' '.join(filter(None, [product.brand, product.model])), 'category': product.category,
            'archived': bool(product.archived_at or variant.archived_at)}
        barcode = variant.barcode or barcode
    scan = ScannerScan(id=uid(), device_id=d.id, request_id=body.request_id, company_id=d.company_id,
        clinic_id=d.clinic_id, user_id=d.user_id, phone_id=phone.id if phone else None, lease=d.lease,
        context=d.context, barcode=barcode, variant_id=variant.id if variant else None, source=source,
        status='pending', created_at=time.time(), summary=summary)
    db.add(scan)
    db.flush()
    command = svc.scan_dict(scan)
    # Full catalog details belong only in the authenticated desktop response,
    # never in durable events shared with paired phones or in scan history.
    detail = variant_dict(variant, product, balance=balance, include_cost=can_view_cost(desktop_user)) if variant and desktop_user else None
    svc.emit(db, d.id, {'type': 'scan', 'scan': command}, scan.phone_id)
    return command | {'variant': detail} if desktop_user else command

@router.post('/phone/devices/{device_id}/scans')
def phone_scan(device_id: str, body: ScanInput, phone=Depends(phone_auth), db=Depends(get_db)):
    d = phone_device(db, phone, device_id)
    return submit(db, d, body, 'phone', phone)

@router.post('/devices/{device_id}/scans')
def desktop_scan(device_id: str, body: ScanInput, binding: str = Header(alias="X-Scanner-Device"), db=Depends(get_db), user=Depends(get_current_user), session=Depends(get_current_auth_session)):
    d = owned(db, device_id, user, binding)
    if d.session_id != session.id:
        raise HTTPException(409, 'scanner.offline')
    return submit(db, d, body, body.source, desktop_user=user)

@router.patch('/scans/{scan_id}')
def result(scan_id: str, body: ResultInput, db=Depends(get_db), user=Depends(get_current_user), session=Depends(get_current_auth_session)):
    enabled()
    scan = db.query(ScannerScan).filter_by(id=scan_id).with_for_update().first()
    if not scan or scan.company_id != user.company_id:
        raise HTTPException(404, 'scanner.unavailable')
    d = owned(db, scan.device_id, user)
    if d.session_id != session.id or d.lease != scan.lease or d.context != scan.context or not receiver_live(db, d):
        raise HTTPException(409, 'scanner.offline')
    if scan.status in {'pending', 'awaiting_confirmation'}:
        scan.status = body.status if scan.created_at > time.time()-120 else 'expired'
        svc.emit(db, d.id, {'type': 'result', 'scan': svc.scan_dict(scan)}, scan.phone_id)
    return svc.scan_dict(scan)

@router.get('/history')
def history(clinic_id: int, offset: int = Query(0, ge=0), db=Depends(get_db), user=Depends(get_current_user)):
    enabled()
    normalize_clinic_id_for_company(db, user, clinic_id)
    latest = db.query(ScannerScan.id, func.row_number().over(
        partition_by=ScannerScan.variant_id,
        order_by=(ScannerScan.created_at.desc(), ScannerScan.id.desc()),
    ).label('rank')).filter(
        ScannerScan.company_id == user.company_id, ScannerScan.clinic_id == clinic_id,
        ScannerScan.source != 'history', ScannerScan.variant_id.isnot(None),
        ScannerScan.created_at > time.time()-30*86400,
    ).subquery()
    rows = db.query(ScannerScan).join(latest, ScannerScan.id == latest.c.id).filter(
        latest.c.rank == 1).order_by(ScannerScan.created_at.desc(), ScannerScan.id.desc()).offset(offset).limit(21).all()
    return {'items': [svc.scan_dict(s) for s in rows[:20]], 'has_more': len(rows)>20}


def event_batch(device_id, phone_id, cursor, lease, context, session_id, factory=SessionLocal):
    with factory() as db:
        d = db.get(ScannerDevice, device_id)
        if not d or not receiver_live(db, d):
            raise HTTPException(409, 'scanner.offline')
        if phone_id:
            phone = db.get(ScannerPhone, phone_id)
            if not phone or phone.seen_at < time.time()-90*86400 or not db.get(ScannerGrant, (phone_id, device_id)):
                raise HTTPException(401, 'scanner.pairAgain')
        elif d.session_id != session_id or d.lease != lease:
            raise HTTPException(409, 'scanner.offline')
        q = db.query(ScannerEvent).filter(ScannerEvent.device_id == device_id, ScannerEvent.id > cursor)
        # A phone can see only its own results, never another phone's scans.
        if phone_id:
            q = q.filter((ScannerEvent.phone_id == phone_id) | ScannerEvent.phone_id.is_(None))
        events = [{'id': e.id, 'data': e.payload} for e in q.order_by(ScannerEvent.id).limit(100)]
        return events, device_dict(db, d)

async def stream(request, device_id, phone_id, lease, context, session_id):
    cursor = int(request.headers.get('last-event-id', '0')) if request.headers.get('last-event-id', '0').isdigit() else 0
    event = asyncio.Event()
    registration = (asyncio.get_running_loop(), event)
    svc.listeners.add(registration)
    try:
        while not await request.is_disconnected():
            event.clear()
            try:
                events, device = await asyncio.to_thread(event_batch, device_id, phone_id, cursor, lease, context, session_id)
            except HTTPException:
                yield 'event: unavailable\ndata: {}\n\n'
                break
            yield 'event: device\ndata: ' + json.dumps(device) + '\n\n'
            for entry in events:
                cursor = entry['id']
                yield f'id: {cursor}\ndata: ' + json.dumps(entry['data']) + '\n\n'
            if len(events) == 100:
                continue
            try:
                await asyncio.wait_for(event.wait(), timeout=15)
            except asyncio.TimeoutError:
                yield ': heartbeat\n\n'
    finally:
        svc.listeners.discard(registration)

@router.get('/devices/{device_id}/events')
def receiver_events(device_id: str, request: Request, lease: str, db=Depends(get_db), user=Depends(get_current_user), session=Depends(get_current_auth_session)):
    ready(db)
    d = owned(db, device_id, user)
    if d.session_id != session.id or d.lease != lease:
        raise HTTPException(403, 'scanner.unavailable')
    args = (request, d.id, None, d.lease, d.context, session.id)
    db.close()
    return StreamingResponse(stream(*args), media_type='text/event-stream', headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})

@router.get('/phone/devices/{device_id}/events')
def phone_events(device_id: str, request: Request, phone=Depends(phone_auth), db=Depends(get_db)):
    ready(db)
    d = phone_device(db, phone, device_id)
    args = (request, d.id, phone.id, d.lease, d.context, None)
    db.close()
    return StreamingResponse(stream(*args), media_type='text/event-stream', headers={'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no'})

@router.get('/variants/{variant_id}')
def variant_detail(variant_id: int, clinic_id: int, db=Depends(get_db), user=Depends(get_current_user)):
    enabled()
    clinic = normalize_clinic_id_for_company(db, user, clinic_id)
    from EndPoints.inventory import _variant_query
    from services.inventory_service import variant_dict, can_view_cost
    rows = _variant_query(db, company_id=user.company_id, clinic_id=clinic, include_archived=True).filter(CatalogVariant.id == variant_id).all()
    return {'items': [variant_dict(v, p, balance=b, include_cost=can_view_cost(user)) for v, p, b in rows]}
