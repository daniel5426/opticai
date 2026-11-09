# Google OAuth configuration

Web and Electron use separate OAuth clients from the same Google Cloud project.
An authorization URL containing `your-desktop-client-id.apps.googleusercontent.com`
means the app used a placeholder; changing Google Cloud origins cannot fix it.

## API

Set these on the API service in each environment and in protected `backend/.env`
for local development:

- `GOOGLE_WEB_CLIENT_ID`: OAuth client of type **Web application**.
- `GOOGLE_WEB_CLIENT_SECRET`: the matching web secret, kept on the API only.
- `GOOGLE_DESKTOP_CLIENT_ID`: OAuth client of type **Desktop app**, required to
  accept desktop login tokens. Verification does not require its secret.

`GET /api/v1/auth/google/oauth/config` returns the public web client ID and scopes,
or 503 if web OAuth is incomplete. The browser fetches this at sign-in; web
credentials are not compiled into renderer bundles. Code exchange and refresh
use the API under `/auth/google/oauth`, with exact allowed origins and PKCE for
code exchange. Add the web origins to `BACKEND_CORS_ORIGINS`; wildcards are not
OAuth allowlist entries.

## Google Cloud web client

Authorized JavaScript origins are origins only. Authorized redirect URIs must
match the full callback exactly, including scheme, host, port, and path:

| Environment | JavaScript origin | Redirect URI |
| --- | --- | --- |
| Local | `http://localhost:5126` | `http://localhost:5126/oauth/callback` |
| Production app | `https://prysm-web-production.up.railway.app` | `https://prysm-web-production.up.railway.app/oauth/callback` |
| Staging app | `https://prysm-web-staging-staging.up.railway.app` | `https://prysm-web-staging-staging.up.railway.app/oauth/callback` |
| Staging custom domain | `https://dev.prysm.co.il` | `https://dev.prysm.co.il/oauth/callback` |

Register `http://127.0.0.1:5126/oauth/callback` separately if that hostname is
used. A site-root redirect does not cover `/oauth/callback`. The separate public
website at `prysm.co.il` uses `/auth/web/google` for identity and retains its own
Google Identity Services origin configuration; it does not use this calendar
code-exchange callback.

## Desktop

Set `GOOGLE_DESKTOP_CLIENT_ID` and `GOOGLE_DESKTOP_CLIENT_SECRET` in root `.env`
for local Electron, and in repository Actions secrets for packaged candidates.
The main process reads packaged `.env.production` / `.env.windows.production`,
with a build-time fallback confined to the main-process bundle. Neither desktop
credential is defined in the renderer. Missing credentials fail locally rather
than opening Google's authorization page with a fake client ID.

Desktop opens the system browser and receives the result through an ephemeral
`http://127.0.0.1:<port>/oauth/callback` listener. Use a Desktop app client for
this flow; web-client origins and fixed redirect ports do not configure it.

## Rollout and qualification

Deploy the API with the web secret and both client IDs before the web repair.
Update desktop packages through the normal candidate/release contract. Existing
installed binaries are not repaired by a web deployment. Verify the public
config endpoint and complete sign-in in each affected environment; backend
token verification accepts only configured web/desktop audiences and verified
Google email addresses. Provider errors are not echoed with secrets.

Migration note: No schema or persisted token-shape changes. Existing sessions,
encrypted Google tokens and desktop clients remain supported. Browser OAuth
endpoints are additive. Tokens from an unconfigured audience are rejected;
configure the desktop ID before rolling out the API to existing desktop users.
