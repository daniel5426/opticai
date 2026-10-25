"""Read-only verification of the installed local clinic's explicit review gate."""
from urllib.parse import urlsplit

import httpx


def verify_approval_policy(env, status, *, transport=None):
    base = env['AGENTS24_BASE_URL'].rstrip('/')
    url = urlsplit(base)
    if url.scheme != 'http' or url.hostname not in {'localhost', '127.0.0.1'}:
        raise RuntimeError('Approval readiness checks require the local Agents24 API.')
    artifacts = [binding['resource_id'] for binding in status.get('installation', {}).get('bindings', [])
                 if binding.get('kind') == 'artifact' and binding.get('resource_key') == 'clinic-tools'
                 and not binding.get('retained_orphan')]
    if len(artifacts) != 1:
        raise RuntimeError('The installed clinic tools are missing or ambiguous.')
    matches = []
    try:
        with httpx.Client(base_url=base + '/', headers={'Authorization': 'Bearer ' + env['AGENTS24_API_KEY']},
                          timeout=15, transport=transport, follow_redirects=False) as client:
            for page in range(10):
                response = client.get('tools', params={'query': 'commit_change', 'view': 'full',
                                                       'limit': 100, 'skip': page * 100})
                response.raise_for_status()
                result = response.json()
                matches.extend(tool for tool in result['items']
                               if tool.get('source', {}).get('id') == artifacts[0]
                               and tool.get('source', {}).get('key') == 'commit_change')
                if not result.get('has_more'):
                    break
            else:
                raise ValueError()
    except (httpx.HTTPError, ValueError, KeyError, TypeError):
        raise RuntimeError('Could not verify the local clinic approval policy; inspect Tool governance.') from None
    if len(matches) != 1:
        raise RuntimeError('The installed clinic commit_change tool is missing or ambiguous.')
    approval = (matches[0].get('governance') or {}).get('approval') or {}
    if approval.get('policy') != 'ask':
        raise RuntimeError('Local clinic commit_change must use Ask in Agents24 Tool governance. '
                           'The review card cannot appear with another policy; no policy was changed.')
    return {'tool_id': matches[0]['id'], 'policy': 'ask'}
