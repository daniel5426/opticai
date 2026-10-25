# where the backend fastapi app that will be used as a proxy for openai llm call, and for handling the app backups

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from services.agent_transport import ClinicGZipMiddleware
import logging
from fastapi.middleware.cors import CORSMiddleware
import config
from EndPoints import order_groups, auth, companies, clinics, users, clients, families, appointments, medical_logs, orders, referrals, files, settings, work_shifts, lookups, campaigns, billing, chats, email_logs, exam_layouts, exams, unified_exam_data, ai, ai_sidebar, control_center, dashboard, search, whatsapp_webhook, whatsapp, softoptic_migration, migration, migration_source_data, clinic_data_prune, clinic_holidays, inventory, plans, subscriptions, trash, web_auth
from EndPoints import agent as prysm_agent
from agent.config import enabled as agents24_enabled
import httpx
import json
from jose import JWTError, jwt
from fastapi.responses import StreamingResponse

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def seed_initial_data():
    from database import get_db
    from utils.seed_data import seed_va_values

    try:
        db = next(get_db())
        try:
            seed_va_values(db)
        finally:
            db.close()
    except Exception:
        logger.exception("Skipping startup seed because the database is unavailable")


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from agent.local_startup import local_agent_services
    from agent.runtime import close_runtime_clients
    try:
        async with local_agent_services():
            seed_initial_data()
            yield
    finally:
        await close_runtime_clients()


app = FastAPI(
    title=config.settings.PROJECT_NAME,
    version=config.settings.VERSION,
    openapi_url=f"{config.settings.API_V1_STR}/openapi.json",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ClinicGZipMiddleware, minimum_size=1024)


@app.middleware("http")
async def enforce_subscription_access(request, call_next):
    """Enforce only after rollout explicitly switches to `enforce`.

    Legacy companies resolve to full access. Billing/auth/recovery endpoints remain
    available even when the product workspace is read-only.
    """
    if (
        config.settings.SUBSCRIPTION_ENFORCEMENT_MODE != "enforce"
        or request.method in {"GET", "HEAD", "OPTIONS"}
        or request.url.path.startswith("/api/agents24/")
        or request.url.path.startswith(f"{config.settings.API_V1_STR}/auth")
        or request.url.path.startswith(f"{config.settings.API_V1_STR}/subscriptions")
    ):
        return await call_next(request)
    authorization = request.headers.get("authorization", "")
    if not authorization.lower().startswith("bearer "):
        return await call_next(request)
    try:
        payload = jwt.decode(
            authorization.split(" ", 1)[1],
            config.settings.SECRET_KEY,
            algorithms=[config.settings.ALGORITHM],
            options={"verify_aud": False},
        )
        company_id = int(payload.get("company_id"))
    except (JWTError, TypeError, ValueError):
        return await call_next(request)

    from database import SessionLocal
    from services.subscription_service import access_mode, ensure_legacy_subscription
    db = SessionLocal()
    try:
        subscription = ensure_legacy_subscription(db, company_id)
        mode = access_mode(subscription)
        db.commit()
    finally:
        db.close()
    if mode != "full":
        code = "subscription_required" if mode == "billing_only" else "account_read_only"
        return ORJSONResponse(
            status_code=402,
            content={"detail": {"code": code, "access_mode": mode, "billing_url": f"{config.settings.SITE_URL}/account/billing"}},
        )
    return await call_next(request)

app.include_router(auth.router, prefix=config.settings.API_V1_STR)
app.include_router(companies.router, prefix=config.settings.API_V1_STR)
app.include_router(clinics.router, prefix=config.settings.API_V1_STR)
app.include_router(users.router, prefix=config.settings.API_V1_STR)
app.include_router(clients.router, prefix=config.settings.API_V1_STR)
app.include_router(families.router, prefix=config.settings.API_V1_STR)
app.include_router(appointments.router, prefix=config.settings.API_V1_STR)
app.include_router(medical_logs.router, prefix=config.settings.API_V1_STR)
app.include_router(order_groups.router, prefix=config.settings.API_V1_STR)
app.include_router(orders.router, prefix=config.settings.API_V1_STR)
app.include_router(orders.cl_router, prefix=config.settings.API_V1_STR)
app.include_router(referrals.router, prefix=config.settings.API_V1_STR)
app.include_router(files.router, prefix=config.settings.API_V1_STR)
app.include_router(settings.router, prefix=config.settings.API_V1_STR)
app.include_router(work_shifts.router, prefix=config.settings.API_V1_STR)
app.include_router(lookups.router, prefix=config.settings.API_V1_STR)
app.include_router(campaigns.router, prefix=config.settings.API_V1_STR)
app.include_router(billing.router, prefix=config.settings.API_V1_STR)
app.include_router(billing.ol_router, prefix=config.settings.API_V1_STR)
app.include_router(chats.router, prefix=config.settings.API_V1_STR)
app.include_router(email_logs.router, prefix=config.settings.API_V1_STR)
app.include_router(exam_layouts.router, prefix=config.settings.API_V1_STR)
app.include_router(exams.router, prefix=config.settings.API_V1_STR)
app.include_router(unified_exam_data.router, prefix=config.settings.API_V1_STR)
app.include_router(ai.router, prefix=config.settings.API_V1_STR)
app.include_router(ai_sidebar.router, prefix=config.settings.API_V1_STR)
app.include_router(prysm_agent.router, prefix=config.settings.API_V1_STR)
if agents24_enabled():
    from agent.runtime import bff_router
    app.include_router(bff_router())
app.include_router(control_center.router, prefix=config.settings.API_V1_STR)
app.include_router(dashboard.router, prefix=config.settings.API_V1_STR)
app.include_router(search.router, prefix=config.settings.API_V1_STR)
app.include_router(whatsapp_webhook.router, prefix=config.settings.API_V1_STR)
app.include_router(whatsapp.router, prefix=config.settings.API_V1_STR)
app.include_router(softoptic_migration.router, prefix=config.settings.API_V1_STR)
app.include_router(migration.router, prefix=config.settings.API_V1_STR)
app.include_router(migration_source_data.router, prefix=config.settings.API_V1_STR)
app.include_router(clinic_data_prune.router, prefix=config.settings.API_V1_STR)
app.include_router(clinic_holidays.router, prefix=config.settings.API_V1_STR)
app.include_router(inventory.router, prefix=config.settings.API_V1_STR)
app.include_router(trash.router, prefix=config.settings.API_V1_STR)
app.include_router(plans.router, prefix=config.settings.API_V1_STR)
app.include_router(subscriptions.router, prefix=config.settings.API_V1_STR)
app.include_router(web_auth.router, prefix=config.settings.API_V1_STR)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "OpticAI API"}

@app.get("/health/database")
async def database_health_check():
    from database import get_db
    from sqlalchemy.exc import OperationalError, DatabaseError, TimeoutError
    from sqlalchemy import text
    
    try:
        db = next(get_db())
        db.execute(text("SELECT 1"))
        return {"status": "healthy", "database": "connected"}
    except (OperationalError, DatabaseError, TimeoutError) as e:
        return {"status": "unhealthy", "database": "disconnected", "error": str(e)}
    except Exception as e:
        return {"status": "error", "database": "unknown", "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host=config.settings.HOST, port=config.settings.PORT)
