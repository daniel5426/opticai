"""Durable scan commands. Notifications are wakeups, never the source of truth."""
import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from sqlalchemy import text, delete
from config import settings
from database import SessionLocal, engine
from scanner_models import ScannerEvent, ScannerScan, ScannerPairing, ScannerAttempt

log = logging.getLogger(__name__)
listeners = set()
listener_ready = False

def wake(*_args):
    for loop, event in tuple(listeners):
        if not loop.is_closed():
            loop.call_soon_threadsafe(event.set)

def emit(db, device_id, payload, phone_id=None):
    db.add(ScannerEvent(device_id=device_id, phone_id=phone_id, created_at=time.time(), payload=payload))
    if db.bind.dialect.name == 'postgresql':
        db.execute(text("SELECT pg_notify('prysm_scanner', :device)"), {'device': device_id})
    db.commit()
    wake()

async def listen():
    global listener_ready
    import asyncpg
    while True:
        connection = None
        try:
            url = settings.SCANNER_NOTIFY_DATABASE_URL
            from sqlalchemy.engine import make_url
            u = make_url(url)
            connection = await asyncpg.connect(host=u.host, port=u.port or 5432, user=u.username, password=u.password, database=u.database, ssl='require', statement_cache_size=0, timeout=10)
            await connection.add_listener('prysm_scanner', wake)
            listener_ready = True
            wake()
            while not connection.is_closed():
                await asyncio.sleep(15)
                await connection.execute('SELECT 1')
        except asyncio.CancelledError:
            raise
        except Exception:
            log.warning('Scanner notification listener unavailable; retrying')
            await asyncio.sleep(5)
        finally:
            listener_ready = False
            if connection and not connection.is_closed():
                await connection.close()

def cleanup():
    now = time.time()
    with SessionLocal() as db:
        db.execute(delete(ScannerEvent).where(ScannerEvent.created_at < now - 86400))
        db.execute(delete(ScannerScan).where(ScannerScan.created_at < now - 30 * 86400))
        db.execute(delete(ScannerPairing).where(ScannerPairing.expires_at < now))
        db.execute(delete(ScannerAttempt).where(ScannerAttempt.expires_at < now))
        db.commit()

async def maintain():
    while True:
        try:
            await asyncio.to_thread(cleanup)
        except Exception:
            log.warning('Scanner retention cleanup unavailable')
        await asyncio.sleep(3600)

@asynccontextmanager
async def scanner_services():
    tasks = []
    if settings.SCANNER_ENABLED:
        tasks.append(asyncio.create_task(maintain()))
        if engine.dialect.name == 'postgresql' and settings.SCANNER_NOTIFY_DATABASE_URL:
            tasks.append(asyncio.create_task(listen()))
    try:
        yield
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

def scan_dict(scan):
    status = scan.status
    if status in {'pending', 'awaiting_confirmation'} and scan.created_at < time.time() - 120:
        status = 'expired'
    return {key: getattr(scan, key) for key in ('id', 'device_id', 'clinic_id', 'request_id', 'barcode', 'variant_id', 'source', 'created_at', 'summary', 'lease', 'context')} | {'status': status}
