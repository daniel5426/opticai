"""Opt-in, read-only staging probe: two independent API notification listeners.

Run with SCANNER_POSTGRES_PROBE=1. Creates no records or schema objects.
"""
import asyncio
import os
import sys
import uuid
from pathlib import Path
import pytest

@pytest.mark.skipif(os.getenv('SCANNER_POSTGRES_PROBE') != '1', reason='explicit staging notification probe only')
def test_two_process_notification_delivery():
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from config import settings
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url
    listener = make_url(settings.SCANNER_NOTIFY_DATABASE_URL)
    # pytest intentionally pins the normal application engine to SQLite.
    u = listener.set(port=6543)
    assert u.database == listener.database == 'postgres'
    assert u.host == listener.host == 'aws-0-eu-central-1.pooler.supabase.com'
    assert u.username == listener.username == 'postgres.eoyqvffwzllggemzfxaw'
    assert listener.port == 5432
    nonce = str(uuid.uuid4())
    child = '''
import asyncio, os
from services import scanner_service as service
async def main():
    received = asyncio.Event()
    def notify(*args):
        if args and args[-1] == os.environ['SCANNER_PROBE_NONCE']:
            received.set()
    service.wake = notify
    task = asyncio.create_task(service.listen())
    try:
        async def ready():
            while not service.listener_ready: await asyncio.sleep(.05)
        await asyncio.wait_for(ready(), 10)
        print('ready', flush=True)
        await asyncio.wait_for(received.wait(), 10)
        print('received', flush=True)
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
asyncio.run(main())
'''
    async def probe():
        processes = []
        try:
            for _ in range(2):
                processes.append(await asyncio.create_subprocess_exec(sys.executable, '-c', child,
                    cwd=Path(__file__).resolve().parents[1],
                    env={**os.environ, 'SCANNER_PROBE_NONCE': nonce},
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL))
            ready = await asyncio.gather(*(asyncio.wait_for(p.stdout.readline(), 15) for p in processes))
            assert ready == [b'ready\n', b'ready\n']
            engine = create_engine(u)
            try:
                with engine.begin() as db:
                    db.execute(text("SELECT pg_notify('prysm_scanner', :nonce)"), {'nonce': nonce})
            finally:
                engine.dispose()
            output = await asyncio.gather(*(asyncio.wait_for(p.communicate(), 15) for p in processes))
            assert [value[0] for value in output] == [b'received\n', b'received\n']
            assert all(p.returncode == 0 for p in processes)
        finally:
            for process in processes:
                if process.returncode is None:
                    process.terminate()
                    await process.wait()
    asyncio.run(probe())
