import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { inputSyncManager } from '@/lib/input-sync-manager';

export type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error' | 'conflict';

export function useSaveController({ dirty = false, identity }: { dirty?: boolean; identity?: string | number } = {}) {
  const [result, setResult] = useState<SaveState>('clean');
  const busy = useRef(false);
  const generation = useRef(0);
  useEffect(() => { generation.current++; busy.current = false; setResult('clean'); return () => { generation.current++; }; }, [identity]);
  const run = useCallback(async <T,>(operation: () => Promise<T>, unchanged = false): Promise<T | undefined> => {
    if (busy.current) return;
    flushSync(() => inputSyncManager.flush());
    if (unchanged) return;
    const focused = document.activeElement as HTMLElement | null;
    const selection = focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement
      ? { start: focused.selectionStart, end: focused.selectionEnd } : undefined;
    busy.current = true;
    const current = generation.current;
    setResult('saving');
    try {
      const value = await operation();
      if (current === generation.current) setResult(value === false ? 'error' : 'saved');
      return value;
    } catch (reason) {
      if (current === generation.current) setResult(/conflict|409|stale/i.test(String(reason)) ? 'conflict' : 'error');
      throw reason;
    } finally {
      if (current === generation.current) {
        busy.current = false;
        requestAnimationFrame(() => {
          if (current !== generation.current || !focused?.isConnected || (document.activeElement !== document.body && document.activeElement !== focused)) return;
          focused.focus({preventScroll:true});
          if (selection && selection.start != null && selection.end != null && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)) {
            try { focused.setSelectionRange(selection.start, selection.end); } catch { /* Numeric inputs do not support ranges. */ }
          }
        });
      }
    }
  }, []);
  return { run, busy, state: result === 'saving' || result === 'error' || result === 'conflict' ? result : dirty ? 'dirty' as const : result,
    reset: () => setResult('clean'), isSaving: result === 'saving' };
}
