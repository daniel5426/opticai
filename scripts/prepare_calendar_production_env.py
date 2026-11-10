"""Prepare desktop refresh credentials only inside an explicitly requested promotion."""
import argparse
import json
import os
import subprocess

PROJECT = 'fb97ce50-fb72-4612-bfd1-c6d8a7bed9cb'


def prepare(*, apply=False, env=None, run=None):
    env = os.environ if env is None else env
    run = subprocess.run if run is None else run
    if env.get('CALENDAR_RELEASE_ENVIRONMENT') != 'production':
        raise RuntimeError('Calendar credential preparation requires the production promotion context')
    client_id = env.get('GOOGLE_DESKTOP_CLIENT_ID', '').strip()
    secret = env.get('GOOGLE_DESKTOP_CLIENT_SECRET', '').strip()
    if not client_id or not secret:
        raise RuntimeError('The desktop candidate OAuth credentials are missing')

    def cli(args, value=None):
        result = run(['railway', *args], input=value, text=True, capture_output=True)
        if result.returncode:
            # Provider output may contain credentials; never print it.
            raise RuntimeError('Railway Calendar credential preparation failed')
        return result.stdout

    if json.loads(cli(['status', '--json'])).get('id') != PROJECT:
        raise RuntimeError('Unexpected Railway project; no credentials were changed')
    current = json.loads(cli(['variables', '--service', 'opticai', '--environment', 'production', '--json']))
    if current.get('GOOGLE_DESKTOP_CLIENT_ID') != client_id:
        raise RuntimeError('The API and packaged desktop OAuth client IDs differ; no credentials were changed')
    if current.get('GOOGLE_DESKTOP_CLIENT_SECRET') == secret:
        return 'Google desktop refresh credentials already match the desktop candidate'
    if not apply:
        return 'The API needs the matching desktop refresh secret at production promotion'
    cli(['variables', 'set', '--service', 'opticai', '--environment', 'production',
         '--skip-deploys', '--stdin', 'GOOGLE_DESKTOP_CLIENT_SECRET'], secret)
    # Verify the effective value without exposing it or triggering a deployment.
    checked = json.loads(cli(['variables', '--service', 'opticai', '--environment', 'production', '--json']))
    if checked.get('GOOGLE_DESKTOP_CLIENT_SECRET') != secret:
        raise RuntimeError('The API desktop refresh credential could not be verified')
    return 'Google desktop refresh credentials prepared; deployment remains owned by promotion'


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        print(prepare(apply=args.apply))
    except (RuntimeError, ValueError, OSError) as error:
        # Only errors authored here are safe to display.
        if type(error) is RuntimeError:
            parser.exit(1, str(error) + '\n')
        parser.exit(1, 'Could not prepare Calendar production credentials\n')
