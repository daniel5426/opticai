"""Read immutable report pages from the API that owns hosted report storage."""
import hashlib
import hmac
import json
from urllib.parse import urlsplit

import httpx
from fastapi import HTTPException
from pydantic import BaseModel, ConfigDict, Field
from uuid import UUID

from .config import now, setting


class ReportPageRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    job_id: UUID
    offset: int = Field(ge=0)
    limit: int = Field(ge=1, le=100)
    external_session_id: str | None = Field(default=None, max_length=50)
    external_user_id: str | None = Field(default=None, max_length=255)
    chat_scope: str | None = Field(default=None, max_length=100)


def signature(secret, timestamp, body):
    digest = hashlib.sha256(body).hexdigest()
    message = f'prysm-report-page/v1\n{timestamp}\n{digest}'.encode()
    return hmac.new(secret.encode(), message, hashlib.sha256).hexdigest()


def authorized_payload(body, timestamp, supplied):
    secret = setting('AGENTS24_ARTIFACT_SIGNING_SECRET')
    if not secret or len(body) > 4096 or not timestamp.isascii() or not timestamp.isdecimal() or len(timestamp) > 12:
        raise HTTPException(404, 'agent.recordNotFound')
    if abs(now().timestamp() - int(timestamp)) > 30 or len(supplied) != 64 or not supplied.isascii() or not hmac.compare_digest(
        signature(secret, timestamp, body), supplied
    ):
        raise HTTPException(404, 'agent.recordNotFound')
    try:
        return ReportPageRequest.model_validate_json(body)
    except ValueError:
        raise HTTPException(422, 'agent.invalidFields') from None


def read_page(db, row, offset, limit, context=None):
    origin = setting('PRYSM_REPORT_API_ORIGIN') if context is not None else ''
    if not origin:
        from .report_runs import page
        return page(row, offset, limit)
    target = urlsplit(origin)
    secret = setting('AGENTS24_ARTIFACT_SIGNING_SECRET')
    if (not secret or target.scheme not in {'http', 'https'} or not target.hostname or target.username or target.password
            or target.path not in {'', '/'} or target.query or target.fragment):
        raise HTTPException(503, 'agent.reportStorageUnavailable')
    payload = ReportPageRequest(job_id=row.id, offset=offset, limit=limit,
        **{key: context.get(key) for key in ('external_session_id', 'external_user_id', 'chat_scope')})
    body = payload.model_dump_json().encode()
    timestamp = str(int(now().timestamp()))
    # The report is already immutable. Release the database connection before private API I/O.
    db.rollback()
    try:
        response = httpx.post(origin.rstrip('/') + '/api/v1/agent/reports/internal-page', content=body,
            headers={'Content-Type': 'application/json', 'X-Prysm-Report-Timestamp': timestamp,
                'X-Prysm-Report-Signature': signature(secret, timestamp, body)}, timeout=5)
        if response.status_code in {403, 404, 410}:
            raise HTTPException(response.status_code, 'agent.downloadUnavailable')
        response.raise_for_status()
        return response.json()
    except (httpx.HTTPError, ValueError):
        raise HTTPException(503, 'agent.reportStorageUnavailable') from None
