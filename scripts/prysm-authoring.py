#!/usr/bin/env python3
"""Explicit local contract-authoring relay against the configured production organization."""
import os
from pathlib import Path
import sys
from dotenv import dotenv_values

root = Path(__file__).resolve().parents[1]
env = {**os.environ, **{k: v for k, v in dotenv_values(root / 'backend/.env').items() if v is not None}}
if env.get('AGENTS24_BASE_URL', '').rstrip('/') != 'https://api.agents24.dev':
    raise SystemExit('This authoring profile requires the official production Agents24 API.')
env.update(AGENTS24_RUNTIME_TARGET='draft', APP_ENV='development', APP_ENVIRONMENT='development',
           PRYSM_AGENT_PACKAGE_DIR=str(root / 'agents24'))
node_bin = Path.home() / '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin'
if (node_bin / 'node').exists():
    env['PATH'] = str(node_bin) + os.pathsep + env.get('PATH', '')
os.chdir(root / 'backend')
os.execvpe(str(root / 'backend/.venv/bin/python'), [str(root / 'backend/.venv/bin/python'), '-m', 'agent.relay_host'], env)
