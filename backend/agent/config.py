import os
from pathlib import Path
from datetime import datetime, timezone


def now():
    return datetime.now(timezone.utc)


def enabled():
    return os.getenv('AGENTS24_ENABLED', 'false').lower() == 'true'


def setting(name, default=''):
    return os.getenv(name, default)


def data_directory():
    path = Path(setting('PRYSM_AGENT_DATA_DIR', str(Path(__file__).resolve().parents[2] / '.agent-data')))
    path.mkdir(parents=True, exist_ok=True, mode=0o700)
    return path
