"""Same sidebar content contract, persistent cache and coalesced generation."""
import asyncio
import hashlib
import json
from sqlalchemy.exc import IntegrityError
from services.ai_schemas import InsightSections
from .models import InsightCache
from .runtime import structured, agent_id
from .config import now

IN_FLIGHT = {}


def fingerprint(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False, default=str).encode()).hexdigest()


async def sections(db, user, client_id, language, data):
    digest = fingerprint(data)
    row = db.query(InsightCache).filter_by(client_id=client_id, locale=language).first()
    if row and row.fingerprint == digest:
        return InsightSections.model_validate(row.sections)
    key = (client_id, language, digest)
    pending = IN_FLIGHT.get(key)
    if pending is None:
        pending = asyncio.create_task(structured(agent_id('AGENTS24_INSIGHTS_AGENT_ID'), data,
            InsightSections.model_json_schema(), language, f'insights:{user.company_id}:{client_id}'))
        IN_FLIGHT[key] = pending
        pending.add_done_callback(lambda task: IN_FLIGHT.pop(key, None))
    result = InsightSections.model_validate(await asyncio.shield(pending))
    row = db.query(InsightCache).filter_by(client_id=client_id, locale=language).first()
    if not row:
        row = InsightCache(client_id=client_id, locale=language)
        db.add(row)
    row.fingerprint, row.sections, row.created_at = digest, result.model_dump(), now()
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
    return result
