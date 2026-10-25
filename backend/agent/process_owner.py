"""Managed local services exit when their supervising process disappears."""
import os


def require_process_owner(env=None):
    env = os.environ if env is None else env
    owner = env.get('PRYSM_AGENT_SUPERVISOR_PID')
    if owner is None:
        return
    if not owner.isdecimal() or int(owner) <= 1:
        raise RuntimeError('Invalid local service supervisor configuration.')
    if os.getppid() != int(owner):
        raise SystemExit(0)
