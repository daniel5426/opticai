import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { AgentChatRuntime } from '@agents24/chat-react/runtime';
import { canRetryAgentStartup, useAgentStartupRecovery } from '@/services/use-agent-startup-recovery';

afterEach(() => vi.useRealTimers());

it('retries unavailable startup, stops after readiness, and never submits a chat turn', async () => {
  vi.useFakeTimers();
  const retryBootstrap = vi.fn(async () => undefined);
  const submit = vi.fn();
  const failed = { bootstrap: null, isBootstrapping: false, fatalError: new Error('offline'), retryBootstrap, submit } as unknown as AgentChatRuntime;
  const hook = renderHook(({ runtime }) => useAgentStartupRecovery(runtime), { initialProps: { runtime: failed } });
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(retryBootstrap).toHaveBeenCalledTimes(1);
  hook.rerender({ runtime: { ...failed, bootstrap: {} as AgentChatRuntime['bootstrap'], fatalError: null } });
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(retryBootstrap).toHaveBeenCalledTimes(1);
  expect(submit).not.toHaveBeenCalled();
  hook.unmount();
});

it('cancels pending recovery on unmount and permits an explicit fresh retry', async () => {
  vi.useFakeTimers();
  const retryBootstrap = vi.fn(async () => undefined);
  const runtime = { bootstrap: null, isBootstrapping: false, fatalError: new Error('offline'), retryBootstrap } as unknown as AgentChatRuntime;
  const hook = renderHook(() => useAgentStartupRecovery(runtime));
  await act(async () => { await hook.result.current(); });
  expect(retryBootstrap).toHaveBeenCalledTimes(1);
  hook.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(retryBootstrap).toHaveBeenCalledTimes(1);
});

it.each([{ kind: 'authentication' }, { kind: 'authorization' }, { kind: 'quota' }, { status: 403 }, { status: 422 }])('does not retry a definitive denial: %o', error => {
  expect(canRetryAgentStartup(error)).toBe(false);
});

it('bounds automatic attempts and resets the budget for a manual retry', async () => {
  vi.useFakeTimers();
  const retryBootstrap = vi.fn(async () => undefined);
  const failed = { bootstrap: null, isBootstrapping: false, fatalError: new Error('offline'), retryBootstrap } as unknown as AgentChatRuntime;
  const hook = renderHook(({ runtime }) => useAgentStartupRecovery(runtime), { initialProps: { runtime: failed } });
  for (let i = 0; i < 8; i++) {
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    hook.rerender({ runtime: { ...failed, isBootstrapping: true } });
    hook.rerender({ runtime: { ...failed, fatalError: new Error('offline') } });
  }
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(retryBootstrap).toHaveBeenCalledTimes(8);
  await act(async () => { await hook.result.current(); });
  expect(retryBootstrap).toHaveBeenCalledTimes(9);
  hook.unmount();
});
