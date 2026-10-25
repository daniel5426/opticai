"""Supervise the isolated consumer stack against an already-running Agents24 API."""
import argparse
import fcntl
import json
import os
import signal
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import urlopen
from sqlalchemy.engine import make_url
from sqlalchemy.exc import ArgumentError


def validate_environment(env, profile='synthetic', require_resources=True):
    try:
        database = make_url(env.get('DATABASE_URL', ''))
        platform = urlsplit(env.get('AGENTS24_BASE_URL', ''))
        api = urlsplit(env.get('VITE_API_URL', ''))
        renderer = urlsplit(env.get('PRYSM_RENDERER_URL', ''))
        if profile == 'clinic':
            clinic_id = env.get('PRYSM_AGENT_CLINIC_ID', '')
            if not clinic_id.isascii() or not clinic_id.isdecimal() or int(clinic_id) <= 0:
                raise ValueError()
            local_staging = database.host == 'aws-0-eu-central-1.pooler.supabase.com' and database.username == 'postgres.eoyqvffwzllggemzfxaw'
            direct_staging = database.host == 'db.eoyqvffwzllggemzfxaw.supabase.co' and database.username == 'postgres'
            valid_database = database.get_backend_name() == 'postgresql' and database.database == 'postgres' and (local_staging or direct_staging)
        else:
            valid_database = database.get_backend_name() == 'postgresql' and database.host in {None, 'localhost', '127.0.0.1'} and database.database == 'opticai_agent_dev'
        if not valid_database or database.query:
            raise ValueError()
        if platform.scheme != 'http' or platform.hostname not in {'localhost', '127.0.0.1'}:
            raise ValueError()
        if api.scheme != 'http' or api.hostname not in {'localhost', '127.0.0.1'} or api.port != (8000 if profile == 'clinic' else 8016) or api.path != '/api/v1':
            raise ValueError()
        if renderer.scheme != 'http' or renderer.hostname not in {'localhost', '127.0.0.1'} or renderer.port != (5126 if profile == 'clinic' else 5136):
            raise ValueError()
        if env.get('AGENTS24_ENABLED', '').lower() != 'true' or env.get('AGENTS24_RUNTIME_TARGET') != 'draft':
            raise ValueError()
    except (ValueError, ArgumentError):
        raise RuntimeError('Use the documented nonproduction database, draft target and matching API/renderer ports.') from None
    required = ['AGENTS24_API_KEY', 'AGENTS24_ARTIFACT_SIGNING_SECRET', 'SECRET_KEY']
    if require_resources:
        required += ['AGENTS24_AGENT_ID', 'AGENTS24_INSIGHTS_AGENT_ID', 'AGENTS24_BRIEF_AGENT_ID',
                     'AGENTS24_DOCUMENT_PIPELINE_ID', 'AGENTS24_NATIVE_DOCUMENT_PIPELINE_ID']
    missing = [key for key in required if not env.get(key)]
    if missing:
        raise RuntimeError('Missing local settings: ' + ', '.join(missing))


def read_json(url):
    with urlopen(url, timeout=3) as response:
        return json.load(response)


class Stack:
    def __init__(self, root, env, profile='synthetic', services=False, owner_pid=None):
        self.root, self.env = root, dict(env)
        self.profile = profile
        self.package = env.get('PRYSM_AGENT_PACKAGE_DIR', 'agents24')
        self.children = []
        self.owner_pid = owner_pid
        self.logs = root / '.agent-data' / ('clinic-services' if services else 'clinic-stack' if profile == 'clinic' else 'local-stack')
        self.logs.mkdir(parents=True, exist_ok=True, mode=0o700)
        self.logs.chmod(0o700)

    def command(self, *arguments):
        entry = 'clinic-dev.py' if self.profile == 'clinic' else 'agent-dev.py'
        return [sys.executable, str(self.root / 'scripts' / entry), *arguments]

    def log(self, name):
        path = self.logs / (name + '.log')
        handle = open(path, 'w')
        path.chmod(0o600)
        return handle

    def start(self, name, *arguments):
        with self.log(name) as output:
            child = subprocess.Popen(self.command(*arguments), cwd=self.root,
                                     env={**self.env, 'PRYSM_AGENT_SUPERVISOR_PID': str(os.getpid())},
                                     stdout=output, stderr=subprocess.STDOUT, start_new_session=True)
        self.children.append((name, child))
        print(f'Starting {name}.', flush=True)

    def check_children(self):
        if self.owner_pid:
            try:
                os.kill(self.owner_pid, 0)
            except ProcessLookupError:
                raise RuntimeError('The owning backend stopped.') from None
        for name, child in self.children:
            if child.poll() is not None:
                raise RuntimeError(f'{name} exited; inspect its protected log in {self.logs}.')

    def wait(self, name, probe, timeout=90):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            self.check_children()
            try:
                if probe():
                    print(f'{name} ready.', flush=True)
                    return
            except (URLError, OSError, ValueError):
                pass
            time.sleep(1)
        raise RuntimeError(f'{name} did not become ready; inspect protected logs in {self.logs}.')

    def status(self):
        result = subprocess.run(self.command('cli', 'status', self.package, '--json'), cwd=self.root,
                                env=self.env, capture_output=True, text=True, timeout=15)
        return json.loads(result.stdout) if result.returncode == 0 else {}

    def configure_relay(self):
        sys.path.insert(0, str(self.root / 'backend'))
        from agent.relay import ensure_relay_client
        self.env['AGENTS24_RELAY_CLIENT_ID'] = ensure_relay_client(self.env)

    def relay_ready(self):
        result = subprocess.run(self.command('relay-status'), cwd=self.root, env=self.env,
                                capture_output=True, text=True, timeout=15)
        if result.returncode:
            return False
        app = json.loads(result.stdout)
        expected = {item['resource_id'] for item in self.status().get('installation', {}).get('bindings', [])
                    if item.get('kind') == 'artifact' and item.get('resource_key') == 'clinic-tools'
                    and not item.get('retained_orphan')}
        ready = {item['artifact_id'] for item in app.get('registrations', [])
                 if item.get('target') == 'draft' and item.get('ready')}
        return (app.get('id') == self.env['AGENTS24_RELAY_CLIENT_ID'] and app.get('status') == 'connected'
                and bool(expected) and expected.issubset(ready))

    def apply(self):
        with self.log('apply') as output:
            result = subprocess.run(self.command('cli', 'apply', self.package, '--integration', 'bff',
                                                '--agent', 'main', '--yes', '--json'),
                                    cwd=self.root, env=self.env, stdout=output, stderr=subprocess.STDOUT, timeout=90)
        if result.returncode:
            raise RuntimeError(f'Clinic tool binding failed; inspect the protected apply log in {self.logs}.')

    def verify_approval(self):
        from agent_dev_policy import verify_approval_policy
        verify_approval_policy(self.env, self.status())
        print('Clinic approval gate ready.', flush=True)

    def signal_child(self, name, child, signum):
        if child.poll() is not None:
            return  # Never signal a stale or recycled process-group identity.
        try:
            if os.getpgid(child.pid) == child.pid:
                os.killpg(child.pid, signum)
            else:
                child.send_signal(signum)
        except ProcessLookupError:
            pass
        except PermissionError:
            try:
                child.send_signal(signum)
            except ProcessLookupError:
                pass
            except PermissionError:
                print(f'Could not signal owned {name}; remaining services will still be stopped.', file=sys.stderr)

    def stop(self):
        for name, child in reversed(self.children):
            self.signal_child(name, child, signal.SIGTERM)
        deadline = time.monotonic() + 8
        for name, child in reversed(self.children):
            try:
                child.wait(timeout=max(0.1, deadline - time.monotonic()))
            except subprocess.TimeoutExpired:
                self.signal_child(name, child, signal.SIGKILL)
                try:
                    child.wait(timeout=1)
                except subprocess.TimeoutExpired:
                    print(f'Owned {name} did not exit; inspect its protected log.', file=sys.stderr)


def run_stack(root, env, arguments, profile='synthetic'):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--browser', action='store_true', help='Run the browser UI instead of Electron.')
    parser.add_argument('--no-renderer', action='store_true', help='Keep an already-running frontend and start its backend services.')
    options = parser.parse_args(arguments)
    stack = Stack(root, env, profile)
    api_port = 8000 if profile == 'clinic' else 8016
    artifact_port = 4317 if profile == 'clinic' else 4316
    renderer_port = 5126 if profile == 'clinic' else 5136
    lock = open(stack.logs / 'supervisor.lock', 'w')
    try:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('The local agent stack is already running.') from None
        validate_environment(env, profile)
        if not read_json(env['AGENTS24_BASE_URL'].rstrip('/') + '/openapi.json').get('paths'):
            raise RuntimeError('The existing local Agents24 API is unavailable.')
        ports = [api_port, artifact_port] + ([] if options.no_renderer else [renderer_port])
        if profile == 'clinic':
            ports.append(8001)
        for port in ports:
            for host in ['127.0.0.1', '::1']:
                try:
                    with socket.create_connection((host, port), timeout=0.3):
                        raise RuntimeError(f'Port {port} is occupied. Stop its existing service before starting this stack.')
                except OSError:
                    pass

        def interrupted(_signal, _frame):
            raise KeyboardInterrupt()
        for signum in [signal.SIGINT, signal.SIGTERM]:
            signal.signal(signum, interrupted)

        stack.configure_relay()
        if not stack.status().get('installation', {}).get('bindings'):
            stack.apply()
        stack.start('relay-host', 'relay')
        stack.wait('Clinic app connection', stack.relay_ready)
        stack.apply()
        stack.wait('Clinic tools', lambda: stack.status().get('binding_summary') == {'total': 3, 'healthy': 3, 'unhealthy': 0})
        stack.verify_approval()
        stack.start('api', 'api', '--no-access-log')
        stack.wait('OpticAI API', lambda: '/api/agents24/bootstrap' in read_json(f'http://127.0.0.1:{api_port}/api/v1/openapi.json')['paths'])
        if profile == 'clinic':
            stack.start('api-8001', 'api-legacy', '--no-access-log')
        stack.start('requested-worker', 'worker', '--queue', 'requested')
        stack.start('summaries-worker', 'worker', '--queue', 'summaries')
        if not options.no_renderer:
            stack.start('renderer', 'browser' if options.browser else 'web')
        stack.wait('OpticAI interface', lambda: urlopen(f'http://localhost:{renderer_port}', timeout=3).close() or True)
        print(f'OpticAI ready at http://localhost:{renderer_port} against the existing local Agents24 API. Ctrl+C stops this consumer stack.', flush=True)
        while True:
            stack.check_children()
            time.sleep(1)
    except KeyboardInterrupt:
        return 0
    except (RuntimeError, OSError, ValueError, subprocess.TimeoutExpired) as error:
        # Never print HTTP bodies, subprocess output, or environment values.
        print(str(error) if isinstance(error, RuntimeError) else 'Local startup failed; inspect protected local-stack logs.', file=sys.stderr)
        return 1
    finally:
        stack.stop()
        lock.close()


def run_services(root, env, arguments):
    """Backend-owned local dependencies; never starts another API or renderer."""
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--owner-pid', type=int, required=True)
    parser.add_argument('--startup-token', required=True)
    options = parser.parse_args(arguments)
    if options.owner_pid <= 1:
        parser.error('A live backend owner is required.')
    from uuid import UUID
    token = str(UUID(options.startup_token))
    stack = Stack(root, env, 'clinic', services=True, owner_pid=options.owner_pid)
    ready = stack.logs / 'ready.json'
    lock = open(stack.logs / 'supervisor.lock', 'w')
    try:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Local agent services already have an owner.') from None
        ready.unlink(missing_ok=True)
        validate_environment(env, 'clinic')
        def interrupted(*_):
            raise KeyboardInterrupt()
        for signum in [signal.SIGINT, signal.SIGTERM]:
            signal.signal(signum, interrupted)
        stack.wait('Agents24 API', lambda: bool(read_json(env['AGENTS24_BASE_URL'].rstrip('/') + '/health')))
        stack.configure_relay()
        if not stack.status().get('installation', {}).get('bindings'):
            stack.apply()
        stack.start('relay-host', 'relay')
        stack.wait('Clinic app connection', stack.relay_ready)
        if stack.status().get('binding_summary', {}).get('healthy') != 3:
            stack.apply()
        stack.wait('Clinic tools', lambda: stack.status().get('binding_summary') == {'total': 3, 'healthy': 3, 'unhealthy': 0})
        stack.verify_approval()
        stack.start('requested-worker', 'worker', '--queue', 'requested')
        stack.start('summaries-worker', 'worker', '--queue', 'summaries')
        stack.check_children()
        temporary = ready.with_suffix('.tmp')
        temporary.write_text(json.dumps({'token': token, 'owner_pid': options.owner_pid,
                                        'relay_client_id': stack.env['AGENTS24_RELAY_CLIENT_ID']}))
        temporary.chmod(0o600)
        temporary.replace(ready)
        print('Local agent services ready.', flush=True)
        while True:
            stack.check_children()
            time.sleep(1)
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        print(str(error) if isinstance(error, RuntimeError) else 'Local agent startup failed; inspect protected clinic-services logs.', file=sys.stderr)
        return 1
    finally:
        stack.stop()
        # A duplicate startup must not erase another owner's readiness receipt.
        try:
            if json.loads(ready.read_text()).get('token') == token:
                ready.unlink()
        except (OSError, ValueError):
            pass
        lock.close()
