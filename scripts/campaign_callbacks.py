#!/usr/bin/env python3
"""App-owned, opt-in local Resend callback tunnel. No database or sending access."""
import json
import os
from pathlib import Path
import re
import shutil
import signal
import socket
import subprocess
import sys
import time

import httpx
from dotenv import dotenv_values, set_key

ROOT = Path(__file__).resolve().parents[1]
STATE = ROOT / '.agent-data/campaign-callbacks/state.json'


def run():
    env = {**os.environ, **{k: v for k, v in dotenv_values(ROOT / 'backend/.env').items() if v is not None}}
    if env.get('APP_ENV', 'development') == 'production' or env.get('PRYSM_CAMPAIGN_CALLBACKS_ENABLED') != 'true':
        raise RuntimeError('Local campaign callbacks must be explicitly enabled outside production.')
    key = env.get('CAMPAIGN_RESEND_API_KEY') or env.get('RESEND_API_KEY')
    executable = shutil.which('cloudflared')
    if not key or not executable:
        raise RuntimeError('Local campaign callbacks require cloudflared and a campaign Resend key.')
    STATE.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    STATE.parent.chmod(0o700)
    previous = json.loads(STATE.read_text()) if STATE.exists() else {}
    children, handles = [], []
    webhook_id = None
    def interrupted(*_):
        raise KeyboardInterrupt()
    for sig in (signal.SIGTERM, signal.SIGINT):
        signal.signal(sig, interrupted)
    def start(name, command):
        path = STATE.parent / (name + '.log')
        handle = path.open('w'); path.chmod(0o600); handles.append(handle)
        child_env = {k: v for k, v in env.items() if k in ('PATH', 'HOME', 'LANG', 'LC_ALL', 'SSL_CERT_FILE', 'SSL_CERT_DIR')}
        child = subprocess.Popen(command, cwd=ROOT, env=child_env, stdout=handle, stderr=subprocess.STDOUT)
        children.append(child)
        return child
    def wait(check):
        deadline = time.monotonic() + 50
        while time.monotonic() < deadline:
            if any(p.poll() is not None for p in children):
                raise RuntimeError('A local callback service exited; inspect its protected log.')
            value = check()
            if value: return value
            time.sleep(0.25)
        raise RuntimeError('Local callback startup timed out; inspect its protected log.')
    def listening():
        try:
            with socket.create_connection(('127.0.0.1', 8020), timeout=0.3): return True
        except OSError: return False
    if listening():
        raise RuntimeError('Callback port 8020 is occupied; stop its existing owner first.')
    def public_url():
        text = (STATE.parent / 'tunnel.log').read_text()
        match = re.search(r'https://[a-z0-9-]+\.trycloudflare\.com', text)
        return match.group(0) if match else None
    with httpx.Client(headers={'Authorization': 'Bearer ' + key}, timeout=20) as api:
        try:
            start('gateway', [sys.executable, '-m', 'uvicorn', 'scripts.campaign_callback_gateway:app',
                              '--host', '127.0.0.1', '--port', '8020', '--no-access-log', '--log-level', 'warning'])
            wait(listening)
            start('tunnel', [executable, 'tunnel', '--url', 'http://127.0.0.1:8020', '--protocol', 'http2', '--no-autoupdate'])
            origin = wait(public_url)
            payload = {'endpoint': origin + '/api/v1/messaging/webhooks/resend',
                       'events': ['email.sent', 'email.delivered', 'email.bounced', 'email.complained', 'email.failed']}
            known = api.get('https://api.resend.com/webhooks'); known.raise_for_status()
            existing = next((x for x in known.json()['data'] if x['id'] == previous.get('webhook_id')), None)
            secret = env.get('CAMPAIGN_RESEND_WEBHOOK_SECRET')
            if existing and secret:
                webhook_id = existing['id']
                result = api.patch('https://api.resend.com/webhooks/' + webhook_id, json={**payload, 'status': 'enabled'})
                result.raise_for_status()
            else:
                result = api.post('https://api.resend.com/webhooks', json=payload); result.raise_for_status()
                created = result.json(); webhook_id = created['id']; secret = created['signing_secret']
            state = {'origin': origin, 'webhook_id': webhook_id, 'signing_secret': secret,
                     'start_id': env.get('PRYSM_CALLBACK_START_ID')}
            temporary = STATE.with_suffix('.tmp'); temporary.write_text(json.dumps(state)); temporary.chmod(0o600); temporary.replace(STATE)
            for name, value in [('CAMPAIGN_PUBLIC_URL', origin), ('MESSAGING_PAYMENT_PUBLIC_URL', origin), ('CAMPAIGN_RESEND_WEBHOOK_SECRET', secret)]:
                set_key(ROOT / 'backend/.env', name, value)
            print('Local campaign callback gateway and Resend webhook configured.', flush=True)
            while True:
                if any(p.poll() is not None for p in children):
                    raise RuntimeError('A local callback service stopped; restart the app to reconnect.')
                time.sleep(1)
        finally:
            if webhook_id:
                try:
                    api.patch('https://api.resend.com/webhooks/' + webhook_id, json={'status': 'disabled'})
                except httpx.HTTPError:
                    pass
            for child in reversed(children):
                if child.poll() is None: child.terminate()
            for child in reversed(children):
                try: child.wait(timeout=5)
                except subprocess.TimeoutExpired: child.kill(); child.wait()
            for handle in handles: handle.close()


if __name__ == '__main__':
    try:
        run()
    except KeyboardInterrupt:
        pass
    except (RuntimeError, OSError, ValueError, httpx.HTTPError) as exc:
        print(str(exc) if isinstance(exc, RuntimeError) else 'Local callback setup failed; inspect protected logs.', file=sys.stderr)
        raise SystemExit(1)
