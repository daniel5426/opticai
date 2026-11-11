"""API-owned Calendar queue. Database row locks coordinate replicas and retries."""
import asyncio
import logging
import threading
from contextlib import asynccontextmanager
from database import SessionLocal, engine
from services.google_calendar import run_once
from services.google_calendar_pull import run_pull_once

logger = logging.getLogger(__name__)


def loop(stop, run, work_delay=0):
    while not stop.is_set():
        try:
            with SessionLocal() as db:
                worked = run(db)
        except Exception:
            logger.warning('google_calendar_worker_unavailable')
            worked = False
        stop.wait(work_delay if worked else 5)


@asynccontextmanager
async def google_calendar_services():
    if engine.dialect.name == 'sqlite' and engine.url.database in (None, '', ':memory:'):
        yield
        return
    stop = threading.Event()
    threads = [threading.Thread(target=loop, args=(stop, run, delay), name=name, daemon=True)
        for run, delay, name in ((run_once, 0, 'google-calendar'), (run_pull_once, 1, 'google-calendar-pull'))]
    for thread in threads:
        thread.start()
    try:
        yield
    finally:
        stop.set()
        await asyncio.gather(*(asyncio.to_thread(thread.join, 55) for thread in threads))
