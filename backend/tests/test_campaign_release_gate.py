"""Unfinished campaign surfaces must remain unavailable in the production API."""
import importlib
import pytest
from config import settings


def test_campaign_routes_disabled_without_removing_scanner_or_clinic_routes(monkeypatch):
    import main
    monkeypatch.setattr(settings, 'CAMPAIGNS_ENABLED', False)
    try:
        main = importlib.reload(main)
        paths = {route.path for route in main.app.routes}
        assert not any(path.startswith(('/api/v1/campaigns', '/api/v1/messaging', '/api/v1/admin/messaging')) for path in paths)
        assert '/api/v1/scanner/status' in paths
        assert '/api/v1/orders/' in paths
    finally:
        monkeypatch.undo()
        importlib.reload(main)


@pytest.mark.asyncio
async def test_disabled_campaign_services_do_not_start_threads(monkeypatch):
    from workers import campaign_worker
    monkeypatch.setattr(settings, 'CAMPAIGNS_ENABLED', False)
    monkeypatch.setattr(campaign_worker.threading, 'Thread', lambda **_: pytest.fail('Campaign worker started while disabled'))
    async with campaign_worker.campaign_services():
        pass
