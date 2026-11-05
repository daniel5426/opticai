"""Browser OAuth uses a web client; its secret stays on the API."""

import time
from urllib.parse import urlsplit

import requests
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from config import settings

router = APIRouter(prefix="/auth/google/oauth", tags=["authentication"])
SCOPES = ["openid", "email", "profile", "https://www.googleapis.com/auth/calendar"]


class CodeExchange(BaseModel):
    code: str = Field(min_length=1, max_length=4096)
    redirect_uri: str
    code_verifier: str = Field(pattern=r"^[A-Za-z0-9._~-]{43,128}$")


class TokenRefresh(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=4096)


def _check_origin(request: Request) -> str:
    origin = request.headers.get("origin", "")
    allowed = {settings.SITE_URL, *settings.BACKEND_CORS_ORIGINS}
    if not origin or origin not in allowed or origin == "null":
        raise HTTPException(status_code=403, detail="Google OAuth origin is not allowed")
    return origin


def _credentials() -> dict[str, str]:
    if not settings.GOOGLE_WEB_CLIENT_ID or not settings.GOOGLE_WEB_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail={"code": "google_not_configured"})
    return {"client_id": settings.GOOGLE_WEB_CLIENT_ID, "client_secret": settings.GOOGLE_WEB_CLIENT_SECRET}


def _tokens(data: dict[str, str]) -> dict:
    try:
        response = requests.post("https://oauth2.googleapis.com/token", data={**_credentials(), **data}, timeout=10)
    except requests.RequestException:
        raise HTTPException(status_code=502, detail={"code": "google_unavailable"})
    if not response.ok:
        # Provider responses can include credentials; never relay or log them.
        raise HTTPException(status_code=401, detail={"code": "google_token_exchange_failed"})
    tokens = response.json()
    if not tokens.get("access_token"):
        raise HTTPException(status_code=502, detail={"code": "google_token_exchange_failed"})
    return {key: tokens[key] for key in ("access_token", "refresh_token", "id_token", "scope", "token_type") if key in tokens} | {
        "expiry_date": int(time.time() * 1000) + int(tokens.get("expires_in", 3600)) * 1000,
    }


@router.get("/config")
def oauth_config():
    credentials = _credentials()
    return {"client_id": credentials["client_id"], "scopes": SCOPES}


@router.post("/exchange")
def exchange_code(payload: CodeExchange, request: Request):
    origin = _check_origin(request)
    redirect = urlsplit(payload.redirect_uri)
    if payload.redirect_uri != f"{origin}/oauth/callback" or redirect.query or redirect.fragment:
        raise HTTPException(status_code=400, detail="Invalid Google redirect URI")
    return _tokens({
        "grant_type": "authorization_code", "code": payload.code,
        "redirect_uri": payload.redirect_uri, "code_verifier": payload.code_verifier,
    })


@router.post("/refresh")
def refresh_token(payload: TokenRefresh, request: Request):
    _check_origin(request)
    return _tokens({"grant_type": "refresh_token", "refresh_token": payload.refresh_token})
