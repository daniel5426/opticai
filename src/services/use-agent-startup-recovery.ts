import { useCallback, useEffect, useRef } from 'react';
import type { AgentChatRuntime } from '@agents24/chat-react/runtime';

const RETRY_DELAYS = [1000, 2000, 4000, 8000, 15000, 20000, 30000, 30000];

export function canRetryAgentStartup(error: unknown): boolean {
  const typed = error as { kind?: string; status?: number; statusCode?: number } | null;
  if (['authentication', 'authorization', 'quota', 'rate_limit'].includes(typed?.kind || '')) return false;
  const status = typed?.status ?? typed?.statusCode;
  return !status || status === 408 || status === 425 || status >= 500;
}

/** Host startup recovery uses the SDK's public bootstrap operation, never repeats a chat turn. */
export function useAgentStartupRecovery(runtime: AgentChatRuntime) {
  const latest = useRef(runtime);
  latest.current = runtime;
  const attempts = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    clearTimeout(timer.current);
    if (runtime.bootstrap) attempts.current = 0;
    if (runtime.bootstrap || runtime.isBootstrapping || !runtime.fatalError || !canRetryAgentStartup(runtime.fatalError)) return;
    const delay = RETRY_DELAYS[attempts.current];
    if (delay === undefined) return;
    timer.current = setTimeout(() => {
      attempts.current++;
      void latest.current.retryBootstrap().catch(() => undefined);
    }, delay);
    return () => clearTimeout(timer.current);
  }, [runtime.bootstrap, runtime.isBootstrapping, runtime.fatalError]);
  return useCallback(async () => {
    clearTimeout(timer.current);
    attempts.current = 0;
    await latest.current.retryBootstrap();
  }, []);
}
