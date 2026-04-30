import os
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("SECRET_KEY", "development-secret-for-tests-only")

from auth import get_current_user
import EndPoints.billing as billing
import EndPoints.control_center as control_center
import EndPoints.email_logs as email_logs
import EndPoints.lookups as lookups
import EndPoints.search as search
import EndPoints.work_shifts as work_shifts


def _route_has_auth(router, path: str, method: str) -> bool:
    method = method.upper()
    for route in router.routes:
        if getattr(route, "path", None) == path and method in getattr(route, "methods", set()):
            return any(dep.call is get_current_user for dep in route.dependant.dependencies)
    raise AssertionError(f"Route not found: {method} {path}")


def test_obvious_business_endpoints_require_auth():
    assert _route_has_auth(search.router, "/search", "GET")
    assert _route_has_auth(billing.router, "/billing/", "GET")
    assert _route_has_auth(billing.router, "/billing/", "POST")
    assert _route_has_auth(billing.ol_router, "/order-line-items/", "POST")
    assert _route_has_auth(work_shifts.router, "/work-shifts/", "GET")
    assert _route_has_auth(work_shifts.router, "/work-shifts/", "POST")
    assert _route_has_auth(email_logs.router, "/email-logs/", "GET")
    assert _route_has_auth(email_logs.router, "/email-logs/", "POST")
    assert _route_has_auth(control_center.router, "/control-center/dashboard/{company_id}", "GET")
    assert _route_has_auth(lookups.router, "/lookups/{lookup_type}", "POST")
    assert _route_has_auth(lookups.router, "/lookups/{lookup_type}/{lookup_id}", "PUT")
    assert _route_has_auth(lookups.router, "/lookups/{lookup_type}/{lookup_id}", "DELETE")


def test_production_config_rejects_sqlite_database():
    env = {
        **os.environ,
        "APP_ENV": "production",
        "DATABASE_URL": "sqlite:///./opticai.db",
        "SECRET_KEY": "x" * 40,
        "TOKEN_ENCRYPTION_KEY": "y" * 40,
        "SUPABASE_URL": "https://example.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "service-role",
        "SUPABASE_KEY": "anon",
        "GOOGLE_DESKTOP_CLIENT_ID": "desktop-client",
        "GOOGLE_DESKTOP_CLIENT_SECRET": "desktop-secret",
        "BACKEND_CORS_ORIGINS": "http://localhost:5173",
    }
    result = subprocess.run(
        [sys.executable, "-c", "import config"],
        cwd=BACKEND_DIR,
        env=env,
        text=True,
        capture_output=True,
    )

    assert result.returncode != 0
    assert "must not use SQLite" in result.stderr


def test_production_config_rejects_wildcard_cors_by_default():
    env = {
        **os.environ,
        "APP_ENV": "production",
        "DATABASE_URL": "postgresql://user:pass@localhost:5432/opticai",
        "SECRET_KEY": "x" * 40,
        "TOKEN_ENCRYPTION_KEY": "y" * 40,
        "SUPABASE_URL": "https://example.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "service-role",
        "SUPABASE_KEY": "anon",
        "GOOGLE_DESKTOP_CLIENT_ID": "desktop-client",
        "GOOGLE_DESKTOP_CLIENT_SECRET": "desktop-secret",
        "BACKEND_CORS_ORIGINS": "*",
    }
    result = subprocess.run(
        [sys.executable, "-c", "import config"],
        cwd=BACKEND_DIR,
        env=env,
        text=True,
        capture_output=True,
    )

    assert result.returncode != 0
    assert "Wildcard CORS" in result.stderr
