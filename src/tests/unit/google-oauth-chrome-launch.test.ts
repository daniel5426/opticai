import { expect, test, vi } from 'vitest';

vi.mock('electron', () => ({ shell: { openExternal: vi.fn() } }));

const url = 'https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=a%20b&prompt=consent&response_type=code&client_id=x';

test('on Windows the whole sign-in URL reaches Chrome, & and all', async () => {
  const { chromeLaunchCommands } = await import('@/lib/google/google-oauth');
  const [command] = chromeLaunchCommands(url, 'win32');
  expect(command.command).toBe('cmd');
  expect(command.verbatim).toBe(true);
  // Inside quotes, cmd keeps "&" as part of the URL instead of starting a new command.
  expect(command.args.at(-1)).toBe(`"start "" chrome "${url}""`);
  expect(command.args.at(-1)).toContain('&response_type=code');
});

test('macOS and Linux pass the URL as a single argument', async () => {
  const { chromeLaunchCommands } = await import('@/lib/google/google-oauth');
  expect(chromeLaunchCommands(url, 'darwin')[0].args).toEqual(['-a', 'Google Chrome', url]);
  expect(chromeLaunchCommands(url, 'linux').every((command) => command.args[0] === url)).toBe(true);
});
