import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SaveState } from '@/hooks/shared/useSaveController';

export function SaveStatus({ state, onRetry, onReload, hideSaved = false }: { state: SaveState; hideSaved?: boolean; onRetry?: () => void; onReload?: () => void }) {
  const { t } = useTranslation();
  if (state === 'clean' || state === 'dirty') return null;
  return <span className={state === 'saving' || (hideSaved && state === 'saved') ? 'sr-only' : 'flex items-center gap-2 text-xs text-muted-foreground'} role="status" aria-live="polite" aria-atomic="true">
    <span>{t(`saveStatus.${state}`)}</span>
    {state === 'error' && onRetry && <button type="button" className="underline underline-offset-2" onClick={onRetry}>{t('saveStatus.retry')}</button>}
    {state === 'conflict' && onReload && <button type="button" className="underline underline-offset-2" onClick={onReload}>{t('saveStatus.reload')}</button>}
  </span>;
}
