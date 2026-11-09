import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import { useScannerInstall } from '@/scanner/useScannerInstall';

afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});
function phone(ua='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',installed=false) {
  vi.spyOn(navigator,'userAgent','get').mockReturnValue(ua);
  vi.stubGlobal('matchMedia',()=>({matches:installed,addEventListener:vi.fn(),removeEventListener:vi.fn()}));
}
test('offers the iPhone guide once and remembers dismissal across visits',()=>{
  phone();
  const first=renderHook(useScannerInstall);
  expect(first.result.current).toMatchObject({ios:true,offer:true,nativeAvailable:false,installed:false});
  act(()=>first.result.current.dismiss());first.unmount();
  const second=renderHook(useScannerInstall);
  expect(second.result.current.offer).toBe(false);
  expect(second.result.current.installed).toBe(false);
});
test('uses the Android native prompt only on request and consumes it once',async()=>{
  phone('Mozilla/5.0 (Linux; Android 15)');
  const hook=renderHook(useScannerInstall);
  const prompt=vi.fn(async()=>({outcome:'accepted' as const}));
  const event=Object.assign(new Event('beforeinstallprompt',{cancelable:true}),{prompt});
  act(()=>window.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  expect(prompt).not.toHaveBeenCalled();
  expect(hook.result.current.nativeAvailable).toBe(true);
  await act(async()=>expect(await hook.result.current.install()).toBe(true));
  await act(async()=>expect(await hook.result.current.install()).toBe(false));
  expect(prompt).toHaveBeenCalledOnce();
  expect(hook.result.current.offer).toBe(false);
});
test('handles an older browser userChoice response and dismissed native prompt',async()=>{
  phone('Android');const hook=renderHook(useScannerInstall);
  act(()=>window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'),{prompt:async()=>undefined,userChoice:Promise.resolve({outcome:'dismissed'})})));
  await act(async()=>expect(await hook.result.current.install()).toBe(false));
  expect(hook.result.current.nativeAvailable).toBe(false);
  expect(hook.result.current.offer).toBe(false);
});
test('suppresses installation in the installed app and after appinstalled',()=>{
  phone('iPhone',true);const installed=renderHook(useScannerInstall);
  expect(installed.result.current).toMatchObject({installed:true,offer:false});installed.unmount();
  phone('Android');const browser=renderHook(useScannerInstall);
  act(()=>window.dispatchEvent(new Event('appinstalled')));
  expect(browser.result.current).toMatchObject({installed:true,offer:false,nativeAvailable:false});
});
test('keeps manual instructions available when the browser rejects the prompt',async()=>{
  phone('Android');const hook=renderHook(useScannerInstall);
  act(()=>window.dispatchEvent(Object.assign(new Event('beforeinstallprompt'),{prompt:async()=>{throw new Error('unavailable');}})));
  await act(async()=>expect(await hook.result.current.install()).toBe(false));
  expect(hook.result.current).toMatchObject({installed:false,nativeAvailable:false});
});
