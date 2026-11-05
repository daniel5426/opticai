from unittest.mock import Mock

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from EndPoints import auth, google_oauth


@pytest.fixture()
def client(monkeypatch):
    for key, value in {
        "GOOGLE_WEB_CLIENT_ID": "web.apps.googleusercontent.com",
        "GOOGLE_WEB_CLIENT_SECRET": "server-only-secret",
        "GOOGLE_DESKTOP_CLIENT_ID": "desktop.apps.googleusercontent.com",
        "GOOGLE_DESKTOP_CLIENT_SECRET": "",
        "SITE_URL": "https://prysm.co.il",
        "BACKEND_CORS_ORIGINS": ["http://localhost:5126"],
    }.items():
        monkeypatch.setattr(google_oauth.settings, key, value)
    app = FastAPI()
    app.include_router(google_oauth.router, prefix="/api/v1")
    return TestClient(app)


def test_public_config_exposes_only_web_id_and_scopes(client):
    response = client.get("/api/v1/auth/google/oauth/config")
    assert response.status_code == 200
    assert response.json()["client_id"] == "web.apps.googleusercontent.com"
    assert "server-only-secret" not in response.text
    assert set(response.json()) == {"client_id", "scopes"}


def test_missing_config_fails_before_google(client, monkeypatch):
    monkeypatch.setattr(google_oauth.settings, "GOOGLE_WEB_CLIENT_SECRET", "")
    response = client.get("/api/v1/auth/google/oauth/config")
    assert response.status_code == 503
    assert response.json()["detail"]["code"] == "google_not_configured"


@pytest.mark.parametrize("origin,redirect", [
    ("https://evil.example", "https://evil.example/oauth/callback"),
    ("null", "null/oauth/callback"),
    ("https://prysm.co.il", "https://evil.example/oauth/callback"),
    ("https://prysm.co.il", "https://prysm.co.il/oauth/callback?next=evil"),
    ("https://prysm.co.il", "https://prysm.co.il/"),
])
def test_exchange_rejects_untrusted_origin_or_redirect(client, monkeypatch, origin, redirect):
    post = Mock()
    monkeypatch.setattr(google_oauth.requests, "post", post)
    response = client.post("/api/v1/auth/google/oauth/exchange", headers={"Origin": origin}, json={
        "code": "code", "redirect_uri": redirect, "code_verifier": "v" * 43,
    })
    assert response.status_code in {400, 403}
    post.assert_not_called()


def test_exchange_keeps_secret_on_server_and_forwards_pkce(client, monkeypatch):
    post = Mock(return_value=Mock(ok=True, json=lambda: {
        "access_token": "access", "refresh_token": "refresh", "id_token": "identity", "expires_in": 3600,
    }))
    monkeypatch.setattr(google_oauth.requests, "post", post)
    response = client.post("/api/v1/auth/google/oauth/exchange", headers={"Origin": "http://localhost:5126"}, json={
        "code": "code", "redirect_uri": "http://localhost:5126/oauth/callback", "code_verifier": "v" * 43,
    })
    assert response.status_code == 200
    assert response.json()["access_token"] == "access"
    assert response.json()["expiry_date"] > 0
    assert "server-only-secret" not in response.text
    assert post.call_args.kwargs["data"] == {
        "client_id": "web.apps.googleusercontent.com", "client_secret": "server-only-secret",
        "grant_type": "authorization_code", "code": "code",
        "redirect_uri": "http://localhost:5126/oauth/callback", "code_verifier": "v" * 43,
    }


def test_exchange_requires_pkce(client):
    response = client.post("/api/v1/auth/google/oauth/exchange", headers={"Origin": "https://prysm.co.il"}, json={
        "code": "code", "redirect_uri": "https://prysm.co.il/oauth/callback",
    })
    assert response.status_code == 422


def test_refresh_uses_server_credentials_and_hides_provider_errors(client, monkeypatch):
    post = Mock(return_value=Mock(ok=False, json=lambda: {"error_description": "server-only-secret"}))
    monkeypatch.setattr(google_oauth.requests, "post", post)
    response = client.post("/api/v1/auth/google/oauth/refresh", headers={"Origin": "https://prysm.co.il"}, json={
        "refresh_token": "refresh",
    })
    assert response.status_code == 401
    assert "server-only-secret" not in response.text
    assert post.call_args.kwargs["data"]["grant_type"] == "refresh_token"


@pytest.mark.parametrize("audience", ["web.apps.googleusercontent.com", "desktop.apps.googleusercontent.com"])
def test_login_accepts_both_configured_clients_without_requiring_client_secret(client, monkeypatch, audience):
    def get(url, **kwargs):
        if url.endswith("tokeninfo"):
            return Mock(json=lambda: {"aud": audience, "email": "owner@example.com", "email_verified": "true"})
        return Mock(json=lambda: {"email": "owner@example.com", "verified_email": True})
    monkeypatch.setattr(auth.requests, "get", get)
    assert auth._verify_google_user("access", "identity")["email"] == "owner@example.com"


def test_login_rejects_token_from_another_app_even_without_id_token(client, monkeypatch):
    get = Mock(return_value=Mock(json=lambda: {"aud": "other-client", "email": "owner@example.com"}))
    monkeypatch.setattr(auth.requests, "get", get)
    with pytest.raises(HTTPException) as error:
        auth._verify_google_user("access")
    assert error.value.status_code == 401
    assert get.call_count == 1


def test_login_rejects_unverified_email(client, monkeypatch):
    get = Mock(side_effect=[
        Mock(json=lambda: {"aud": "web.apps.googleusercontent.com", "email": "owner@example.com"}),
        Mock(json=lambda: {"email": "owner@example.com", "verified_email": False}),
    ])
    monkeypatch.setattr(auth.requests, "get", get)
    with pytest.raises(HTTPException) as error:
        auth._verify_google_user("access")
    assert error.value.status_code == 401


def test_login_rejects_mixed_web_and_desktop_tokens(client, monkeypatch):
    get = Mock(side_effect=[
        Mock(json=lambda: {"aud": "web.apps.googleusercontent.com", "email": "owner@example.com"}),
        Mock(json=lambda: {"aud": "desktop.apps.googleusercontent.com", "email": "owner@example.com", "email_verified": "true"}),
    ])
    monkeypatch.setattr(auth.requests, "get", get)
    with pytest.raises(HTTPException) as error:
        auth._verify_google_user("access", "identity")
    assert error.value.status_code == 401


def test_login_rejects_empty_access_token_without_contacting_google(client, monkeypatch):
    get = Mock()
    monkeypatch.setattr(auth.requests, "get", get)
    with pytest.raises(HTTPException) as error:
        auth._verify_google_user("")
    assert error.value.status_code == 401
    get.assert_not_called()
