import i18n from '@/localization/i18n';
import { normalizeApiBaseUrl } from '@/services/api-base-url';

const oauthBase = `${normalizeApiBaseUrl(import.meta.env.VITE_API_URL)}/auth/google/oauth`;
const channelName = 'google-oauth-channel';

function errorKey(code: string): string {
  const key = `authLogin.google.${code}`;
  return i18n.exists(key) ? key : 'authLogin.google.failed';
}

function failureKey(error: unknown): string {
  const key = error instanceof Error ? error.message : '';
  return key.startsWith('authLogin.google.') && i18n.exists(key) ? key : errorKey('failed');
}

async function request(path: string, data?: unknown) {
  const response = await fetch(`${oauthBase}/${path}`, data === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(errorKey(result.detail?.code || 'failed'));
  return result;
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function authenticateGoogleWeb(): Promise<any> {
  // Open during the click gesture, before fetching configuration or generating PKCE.
  const popup = window.open('about:blank', 'google-oauth', 'width=500,height=600');
  if (!popup) return { success: false, error: errorKey('popupBlocked') };

  const state = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const redirectUri = `${window.location.origin}/oauth/callback`;
  const channel = new BroadcastChannel(channelName);

  return new Promise(resolve => {
    let settled = false;
    const finish = (result: any) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(closedCheck);
      channel.close();
      popup.close();
      resolve(result);
    };
    const fail = (error: unknown) => finish({ success: false, error: failureKey(error) });
    const timeout = setTimeout(() => fail(new Error(errorKey('timeout'))), 120000);
    const closedCheck = setInterval(() => {
      if (popup.closed) fail(new Error(errorKey('cancelled')));
    }, 500);

    channel.onmessage = async ({ data }) => {
      if (settled || data?.type !== 'GOOGLE_AUTH_CODE' || data.state !== state) return;
      // A matching callback can arrive twice in React StrictMode. Exchange once.
      channel.onmessage = null;
      clearInterval(closedCheck);
      if (data.error || !data.code) return fail(new Error(errorKey('cancelled')));
      try {
        const tokens = await request('exchange', { code: data.code, redirect_uri: redirectUri, code_verifier: verifier });
        const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (!userResponse.ok) throw new Error(errorKey('failed'));
        finish({ success: true, tokens, userInfo: await userResponse.json() });
      } catch (error) { fail(error); }
    };

    void (async () => {
      const [config, digest] = await Promise.all([
        request('config'), crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)),
      ]);
      if (settled) return;
      const params = new URLSearchParams({
        client_id: config.client_id, redirect_uri: redirectUri, response_type: 'code',
        scope: config.scopes.join(' '), access_type: 'offline', prompt: 'consent', state,
        code_challenge: base64url(new Uint8Array(digest)), code_challenge_method: 'S256',
      });
      popup.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    })().catch(fail);
  });
}

export async function refreshGoogleWebToken(refreshToken: string): Promise<any> {
  try {
    const tokens = await request('refresh', { refresh_token: refreshToken });
    return { success: true, ...tokens, refresh_token: tokens.refresh_token || refreshToken };
  } catch (error) {
    return { success: false, error: failureKey(error) };
  }
}

export function publishGoogleOAuthCallback(search: string): boolean {
  const params = new URLSearchParams(search);
  if (!params.get('state') || (!params.get('code') && !params.get('error'))) return false;
  const channel = new BroadcastChannel(channelName);
  channel.postMessage({
    type: 'GOOGLE_AUTH_CODE', state: params.get('state'), code: params.get('code'), error: params.get('error'),
  });
  channel.close();
  return !params.has('error');
}
