#!/usr/bin/env python3
"""Normal clinic development against the explicitly allowlisted staging database."""
import os
import argparse
from pathlib import Path
import subprocess
import sys

from dotenv import dotenv_values
from agent_dev_stack import run_stack, validate_environment

ROOT = Path(__file__).resolve().parents[1]
env = {**os.environ, **{key: value for key, value in dotenv_values(ROOT / 'backend/.env').items() if value is not None}}
env.update(VITE_API_URL='http://localhost:8000/api/v1', PRYSM_RENDERER_URL='http://localhost:5126',
           PRYSM_AGENT_PACKAGE_DIR=str(ROOT / '.agent-data/clinic-package'))
node_bin = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin'
if (node_bin / 'node').exists():
    env['PATH'] = str(node_bin) + os.pathsep + env.get('PATH', '')
if len(sys.argv) < 2:
    raise SystemExit('Use up, services, api, api-legacy, artifact, relay, relay-status, worker, cli, migrate, browser, or web.')
mode, *arguments = sys.argv[1:]
validate_environment(env, 'clinic', require_resources=mode not in {'cli', 'migrate', 'artifact'})
if mode == 'up':
    raise SystemExit(run_stack(ROOT, env, arguments, 'clinic'))
if mode == 'services':
    from agent_dev_stack import run_services
    raise SystemExit(run_services(ROOT, env, arguments))
python = str(ROOT / 'backend/.venv/bin/python')
cwd = ROOT / 'backend'
if mode == 'cli':
    node = str(node_bin / 'node') if (node_bin / 'node').exists() else 'node'
    cli = env.get('AGENTS24_DEV_CLI', str(ROOT / 'node_modules/@agents24/cli/dist/cli.js'))
    command = [node, cli, *arguments]
    cwd = ROOT
elif mode in {'api', 'api-legacy'}:
    env['PRYSM_AGENT_SERVICES_MANAGED'] = '1'
    port = '8000' if mode == 'api' else '8001'
    command = [python, '-m', 'uvicorn', 'main:app', '--host', '127.0.0.1', '--port', port, *arguments]
elif mode in {'relay', 'relay-status'}:
    command = [str(python), '-m', 'agent.relay_host', *(['--status'] if mode == 'relay-status' else []), *arguments]
elif mode == 'artifact':
    command = [python, '-m', 'uvicorn', 'agent.artifact:artifact_app', '--factory', '--host', '127.0.0.1', '--port', '4317', '--no-access-log', *arguments]
elif mode == 'worker':
    parser = argparse.ArgumentParser(description='Run one clinic-scoped worker queue.')
    parser.add_argument('--queue', choices=['requested', 'summaries'], default='requested')
    options = parser.parse_args(arguments)
    command = [python, '-m', 'workers.agent_worker', '--queue', options.queue,
               '--clinic-id', env['PRYSM_AGENT_CLINIC_ID']]
elif mode == 'migrate':
    command = [python, '-m', 'alembic', 'upgrade', 'head']
elif mode in {'web', 'browser'}:
    cwd = ROOT
    command = ['npm', 'run', 'dev', '--', '--port', '5126', '--strictPort'] if mode == 'web' else ['npm', 'exec', '--', 'vite', '--config', 'vite.renderer.config.mts', '--port', '5126', '--strictPort']
else:
    raise SystemExit('Unknown clinic development command.')
if mode in {'api', 'api-legacy', 'artifact', 'relay', 'worker', 'web', 'browser'}:
    # The supervisor owns this PID. Do not leave a subprocess.call wrapper
    # that can die independently and orphan the actual service.
    os.chdir(cwd)
    os.execvpe(command[0], command, env)
try:
    raise SystemExit(subprocess.call(command, cwd=cwd, env=env))
except KeyboardInterrupt:
    raise SystemExit(130)
