"""Application-owned relay identity; independent of staff sessions and conversations."""
import hashlib
import json
import os
from pathlib import Path
from uuid import UUID, uuid4


def _profile(env):
    base = env.get('AGENTS24_BASE_URL', '').rstrip('/')
    integration = env.get('AGENTS24_INTEGRATION_ID', 'prysm')
    return base, integration


def identity_path(env=None):
    env = os.environ if env is None else env
    root = Path(env.get('PRYSM_AGENT_DATA_DIR') or Path(__file__).resolve().parents[2] / '.agent-data')
    key = hashlib.sha256('\n'.join(_profile(env)).encode()).hexdigest()[:24]
    return root / 'relay' / key / 'client.json'


def relay_client_id(env=None):
    env = os.environ if env is None else env
    if env.get('AGENTS24_ARTIFACT_TRANSPORT', 'relay') == 'http':
        return None
    explicit = env.get('AGENTS24_RELAY_CLIENT_ID')
    if explicit:
        return str(UUID(explicit))
    try:
        saved = json.loads(identity_path(env).read_text())
    except FileNotFoundError:
        return None
    if (saved.get('base_url'), saved.get('integration_id')) != _profile(env):
        raise RuntimeError('The configured relay profile does not match its saved identity.')
    return str(UUID(saved['client_id']))


def ensure_relay_client(env=None):
    env = os.environ if env is None else env
    selected = relay_client_id(env)
    if selected:
        return selected
    if env.get('AGENTS24_ARTIFACT_TRANSPORT', 'relay') != 'relay':
        raise RuntimeError('Relay serving requires AGENTS24_ARTIFACT_TRANSPORT=relay.')
    path = identity_path(env)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    base, integration = _profile(env)
    value = {'client_id': str(uuid4()), 'base_url': base, 'integration_id': integration}
    temporary = path.with_name(str(uuid4()) + '.tmp')
    # Publish a complete file atomically; concurrent starters retain the winner.
    try:
        with open(temporary, 'x', opener=lambda name, flags: os.open(name, flags, 0o600)) as handle:
            json.dump(value, handle)
        os.link(temporary, path)
    except FileExistsError:
        return relay_client_id(env)
    finally:
        temporary.unlink(missing_ok=True)
    return value['client_id']


def cli_command(root, env=None):
    env = os.environ if env is None else env
    configured = env.get('AGENTS24_DEV_CLI')
    executable = Path(configured) if configured else Path(root) / 'node_modules/@agents24/cli/dist/cli.js'
    if not executable.is_file():
        raise RuntimeError('Install the matching Agents24 CLI before starting the relay host.')
    return [env.get('AGENTS24_NODE', 'node'), str(executable)]
