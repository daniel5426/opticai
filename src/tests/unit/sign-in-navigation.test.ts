import { afterEach, expect, it, vi } from 'vitest';
import { replaceBrowserSignInRoute } from '@/lib/auth/sign-in-navigation';

afterEach(() => vi.unstubAllGlobals());

it('leaves an expired protected web page without removing clinic trust or using the React router', () => {
  const replace = vi.fn();
  const storage = { getItem: vi.fn(), removeItem: vi.fn() };
  vi.stubGlobal('window', {location:{protocol:'https:',pathname:'/he/ai-assistant',search:'',hash:'',replace},localStorage:storage});
  expect(replaceBrowserSignInRoute('/user-selection')).toBe(true);
  expect(replace).toHaveBeenCalledWith('/he/user-selection');
  expect(storage.removeItem).not.toHaveBeenCalled();
});

it('does not reload the staff selection page into itself', () => {
  const replace = vi.fn();
  vi.stubGlobal('window', {location:{protocol:'https:',pathname:'/he/user-selection',search:'',hash:'',replace}});
  expect(replaceBrowserSignInRoute('/user-selection')).toBe(true);
  expect(replace).not.toHaveBeenCalled();
});

it.each(['file', 'electron'])('retains in-app routing for %s renderers', kind => {
  const replace = vi.fn();
  vi.stubGlobal('window', {electronAPI:kind==='electron'?{}:undefined,location:{protocol:kind==='file'?'file:':'http:',replace}});
  expect(replaceBrowserSignInRoute('/user-selection')).toBe(false);
  expect(replace).not.toHaveBeenCalled();
});
