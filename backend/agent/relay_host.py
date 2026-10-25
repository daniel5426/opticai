"""Serve clinic Artifacts through the official shared relay CLI, without a public URL."""
import json
import os
import signal
import socket
import subprocess
import sys
import time
from contextlib import contextmanager
from pathlib import Path

from .relay import cli_command, ensure_relay_client, identity_path
from .process_owner import require_process_owner
from agents24.errors import Agents24SDKError


@contextmanager
def profile_lock(path):
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    with open(path, 'a+b') as handle:
        os.chmod(path, 0o600)
        try:
            if os.name == 'nt':
                import msvcrt
                handle.seek(0)
                if not handle.read(1):
                    handle.write(b'0'); handle.flush()
                handle.seek(0)
                msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
            else:
                import fcntl
                fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except OSError:
            raise RuntimeError('This app profile already has a relay host.') from None
        yield


def stop_children(children, grace=8):
    for child in reversed(children):
        if child.poll() is None:
            child.terminate()
    deadline = time.monotonic() + grace
    for child in reversed(children):
        try:
            child.wait(timeout=max(.1, deadline - time.monotonic()))
        except subprocess.TimeoutExpired:
            child.kill()
            child.wait()


def require_free_port(port):
    try:
        with socket.socket() as listener:
            listener.bind(('127.0.0.1', port))
    except OSError:
        raise RuntimeError('The configured clinic Artifact port is already in use; no relay was started.') from None


def serve(root, env=None):
    env = dict(os.environ if env is None else env)
    target = env.get('AGENTS24_RUNTIME_TARGET', 'published')
    if target not in {'draft', 'published'}:
        raise RuntimeError('AGENTS24_RUNTIME_TARGET must be draft or published.')
    if target == 'draft' and env.get('APP_ENV', 'development') not in {'local', 'development'}:
        raise RuntimeError('Draft authoring requires an explicit development app profile.')
    package = Path(env.get('PRYSM_AGENT_PACKAGE_DIR') or root / 'agents24').resolve()
    # Use the declared endpoint, so the server and CLI cannot disagree on ports.
    import yaml
    from urllib.parse import urlsplit
    declaration = yaml.safe_load((package / 'artifacts/clinic/artifact.yaml').read_text())
    endpoint = urlsplit(declaration['development']['base_url'])
    if (endpoint.scheme != 'http' or endpoint.hostname not in {'127.0.0.1', 'localhost'}
            or endpoint.username or endpoint.password or endpoint.path not in {'', '/'}
            or endpoint.query or endpoint.fragment or not endpoint.port):
        raise RuntimeError('Clinic Artifact forwarding requires a declared loopback HTTP port.')
    if not env.get('AGENTS24_API_KEY') or not env.get('AGENTS24_ARTIFACT_SIGNING_SECRET'):
        raise RuntimeError('Configure the backend Agents24 key and local Artifact signing secret.')
    client_id = ensure_relay_client(env)
    env['AGENTS24_RELAY_CLIENT_ID'] = client_id
    directory = identity_path(env).parent
    children = []
    def interrupted(*_):
        raise KeyboardInterrupt()
    for signum in [signal.SIGINT, signal.SIGTERM]:
        signal.signal(signum, interrupted)
    with profile_lock(directory / 'host.lock'):
        try:
            require_free_port(endpoint.port)
            commands = [
                ('artifact', [sys.executable, '-m', 'uvicorn', 'agent.artifact:artifact_app', '--factory',
                    '--host', '127.0.0.1', '--port', str(endpoint.port), '--no-access-log']),
                ('relay', [*cli_command(root, env), 'dev' if target == 'draft' else 'serve',
                    str(package), '--client-id', client_id, '--json']),
            ]
            for name, command in commands:
                path = directory / (name + '.log')
                with open(path, 'a') as log:
                    path.chmod(0o600)
                    children.append(subprocess.Popen(command, cwd=root / 'backend', env=env,
                        stdout=log, stderr=subprocess.STDOUT))
            print(json.dumps({'phase': 'relay_host_started', 'relay_client_id': client_id, 'target': target}), flush=True)
            while all(child.poll() is None for child in children):
                require_process_owner(env)
                time.sleep(.25)
            raise RuntimeError('A relay host dependency exited; inspect protected relay logs.')
        except KeyboardInterrupt:
            return 0
        finally:
            stop_children(children)


def main():
    import config  # Loads the existing backend environment, never renderer configuration.
    try:
        if sys.argv[1:] == ['--status']:
            from agents24 import Agents24
            from .relay import relay_client_id
            selected = relay_client_id()
            if not selected:
                return 1
            sdk = Agents24(base_url=os.environ['AGENTS24_BASE_URL'], api_key=os.environ['AGENTS24_API_KEY'], timeout=10)
            print(json.dumps(sdk.relay_clients.get(selected)))
            return 0
        if sys.argv[1:]:
            raise RuntimeError('Use no arguments to serve, or --status to inspect this app.')
        return serve(Path(__file__).resolve().parents[2])
    except Agents24SDKError:
        print('The Agents24 relay request failed; check backend credentials and connection status.', file=sys.stderr)
        return 1
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1
    except (OSError, ValueError, KeyError):
        print('Clinic relay host could not start; check its configuration and protected relay logs.', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
