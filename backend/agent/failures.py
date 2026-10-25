"""Keep canonical support references without persisting provider diagnostics."""
import re
from uuid import UUID


def platform_reference(value):
    if not isinstance(value, dict) or value.get('schema_version') != 'agents24.failure.v1':
        return None
    try:
        identity = str(UUID(str(value.get('failure_id'))))
    except (ValueError, TypeError, AttributeError):
        return None
    code = value.get('code')
    if not isinstance(code, str) or not re.fullmatch(r'[A-Z][A-Z0-9_]{0,100}', code):
        return None
    return {'failure_id': identity, 'code': code, 'retryable': value.get('retryable') is True}


class PlatformOperationFailed(RuntimeError):
    def __init__(self, failure):
        super().__init__('Agent processing did not complete')
        self.failure = failure


def job_failure(error, code='agent.jobFailed'):
    reference = platform_reference(getattr(error, 'failure', None))
    return {'code': code, **({'platform_failure': reference} if reference else {})}
