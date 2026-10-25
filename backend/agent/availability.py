"""A bounded connectivity check for the optional experimental integration."""
import httpx
from .config import enabled, setting


async def platform_available():
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
