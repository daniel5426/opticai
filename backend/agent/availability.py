"""A bounded connectivity check for the optional experimental integration."""
import httpx
from contextlib import contextmanager
from .config import enabled, setting

_local_services_ready = None


@contextmanager
def local_service_readiness(ready):
    global _local_services_ready
    previous = _local_services_ready
    _local_services_ready = ready
    try:
        yield
    finally:
        _local_services_ready = previous


async def platform_available():
    if _local_services_ready is False:
        return False
    if not enabled() or not all(setting(key) for key in (
        'AGENTS24_BASE_URL', 'AGENTS24_API_KEY', 'AGENTS24_AGENT_ID',
    )):
        return False
    try:
        async with httpx.AsyncClient(timeout=1.0) as client:
            response = await client.get(setting('AGENTS24_BASE_URL').rstrip('/') + '/health')
            return response.status_code == 200
    except (httpx.HTTPError, ValueError):
        return False
