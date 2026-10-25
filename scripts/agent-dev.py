#!/usr/bin/env python3
"""Isolated local entry point; secrets are inherited, never command arguments."""
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlsplit
from dotenv import dotenv_values

ROOT = Path(__file__).resolve().parents[1]
env = {**os.environ, **{key: value for key, value in dotenv_values(ROOT / '.env.agent-dev').items() if value is not None}}
# Prevent backend/.env defaults from selecting the real-clinic storage profile.
env.setdefault('PRYSM_AGENT_DATA_DIR', str(ROOT / '.agent-data'))
backend = ROOT / 'backend'
python = ROOT / '.venv-agent-dev/bin/python'
node_bin = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin'
if (node_bin / 'node').exists():
    env['PATH'] = str(node_bin) + os.pathsep + env.get('PATH', '')
url = urlsplit(env.get('DATABASE_URL', ''))
platform = urlsplit(env.get('AGENTS24_BASE_URL', ''))
if url.scheme not in {'postgresql', 'sqlite'} or url.hostname not in {None, 'localhost', '127.0.0.1'}:
    raise SystemExit('Agent development requires an explicitly local database.')
if platform.hostname not in {'localhost', '127.0.0.1'}:
    raise SystemExit('Agent development requires the local Agents24 API.')
if len(sys.argv) < 2:
    raise SystemExit('Use up, migrate, seed, api, artifact, relay, relay-status, worker, cli, test, browser, or web.')
mode, *arguments = sys.argv[1:]
if mode == 'up':
    from agent_dev_stack import run_stack
    raise SystemExit(run_stack(ROOT, env, arguments))
cwd = backend
if mode == 'cli':
    node = node_bin / 'node'
    executable = str(node) if node.exists() else 'node'
    command = [executable, env.get('AGENTS24_DEV_CLI', str(ROOT / 'node_modules/@agents24/cli/dist/cli.js')), *arguments]
    cwd = ROOT
elif mode == 'migrate':
    command = [str(python), '-m', 'alembic', 'upgrade', 'head']
elif mode == 'seed':
    command = [str(python), '-m', 'agent.seed', *arguments]
elif mode == 'api':
    env['PRYSM_AGENT_SERVICES_MANAGED'] = '1'
    command = [str(python), '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', '8016', *arguments]
elif mode in {'relay', 'relay-status'}:
    command = [str(python), '-m', 'agent.relay_host', *(['--status'] if mode == 'relay-status' else []), *arguments]
elif mode == 'artifact':
    command = [str(python), '-m', 'uvicorn', 'agent.artifact:artifact_app', '--factory', '--host', '127.0.0.1', '--port', '4316', '--no-access-log', *arguments]
elif mode == 'worker':
    command = [str(python), '-m', 'workers.agent_worker', *arguments]
elif mode == 'test':
    command = [str(python), '-m', 'pytest', '-q', 'tests/agent', *arguments]
    env['DATABASE_URL'] = 'sqlite:///:memory:'
elif mode == 'browser':
    cwd = ROOT
    command = ['npm', 'exec', '--', 'vite', '--config', 'vite.renderer.config.mts', '--port', '5136', '--strictPort']
elif mode == 'web':
    env['PRYSM_DEV_DATA_DIR'] = str(ROOT / '.agent-data/electron-profile')
    cwd = ROOT
    command = ['npm', 'run', 'dev', '--', '--port', '5136', '--strictPort']
else:
    raise SystemExit('Unknown agent development command.')
if mode in {'api', 'artifact', 'relay', 'worker', 'web', 'browser'}:
    os.chdir(cwd)
    os.execvpe(command[0], command, env)
try:
    raise SystemExit(subprocess.call(command, cwd=cwd, env=env))
except KeyboardInterrupt:
    raise SystemExit(130)
