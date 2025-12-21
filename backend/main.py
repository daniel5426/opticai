# where the backend fastapi app that will be used as a proxy for openai llm call, and for handling the app backups

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from fastapi.middleware.gzip import GZipMiddleware
import logging
from fastapi.middleware.cors import CORSMiddleware
import config
from database import engine
from models import Base
from EndPoints import auth, companies, clinics, users, clients, families, appointments, medical_logs, orders, referrals, files, settings, work_shifts, lookups, campaigns, billing, chats, email_logs, exam_layouts, exams, unified_exam_data, ai, ai_sidebar, control_center, dashboard, search, whatsapp_webhook, whatsapp
import httpx
import json
from fastapi.responses import StreamingResponse

logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title=config.settings.PROJECT_NAME,
    version=config.settings.VERSION,
    openapi_url=f"{config.settings.API_V1_STR}/openapi.json",
    default_response_class=ORJSONResponse
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1024)

Base.metadata.create_all(bind=engine)

app.include_router(auth.router, prefix=config.settings.API_V1_STR)
app.include_router(companies.router, prefix=config.settings.API_V1_STR)
app.include_router(clinics.router, prefix=config.settings.API_V1_STR)
app.include_router(users.router, prefix=config.settings.API_V1_STR)
app.include_router(clients.router, prefix=config.settings.API_V1_STR)
app.include_router(families.router, prefix=config.settings.API_V1_STR)
app.include_router(appointments.router, prefix=config.settings.API_V1_STR)
app.include_router(medical_logs.router, prefix=config.settings.API_V1_STR)
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
app.include_router(control_center.router, prefix=config.settings.API_V1_STR)
app.include_router(dashboard.router, prefix=config.settings.API_V1_STR)
app.include_router(search.router, prefix=config.settings.API_V1_STR)
app.include_router(whatsapp_webhook.router, prefix=config.settings.API_V1_STR)
app.include_router(whatsapp.router, prefix=config.settings.API_V1_STR)


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