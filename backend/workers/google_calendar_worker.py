"""API-owned Calendar queue. Database row locks coordinate replicas and retries."""
import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from database import SessionLocal, engine
from services.google_calendar import run_once

logger = logging.getLogger(__name__)


def loop(stop):
    while not stop.is_set():
        try:
            with SessionLocal() as db:
                worked = run_once(db)
        except Exception:
            logger.warning('google_calendar_worker_unavailable')
            worked = False
        if not worked:
            stop.wait(5)


@asynccontextmanager
async def google_calendar_services():
    if engine.dialect.name == 'sqlite' and engine.url.database in (None, '', ':memory:'):
        yield
        return
    stop = threading.Event()
    thread = threading.Thread(target=loop, args=(stop,), name='google-calendar', daemon=True)
    thread.start()
    try:
        yield
    finally:
        stop.set()
        await asyncio.to_thread(thread.join, 55)
