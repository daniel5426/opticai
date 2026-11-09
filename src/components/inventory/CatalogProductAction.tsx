import React, { useState } from 'react';
import { Loader2, Plus, Save } from 'lucide-react';
import { useTranslation } from 'react-i18next';

/** Explicit catalog writes stay separate from saving the current order. */
export function CatalogProductAction({ onAction, label, compact = false, disabled = false }: {
  onAction: () => Promise<void>;
  label: string;
  compact?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const run = async () => {
    if (busy || disabled) return;
    setBusy(true); setFailed(false);
    try { await onAction(); }
    catch { setFailed(true); }
    finally { setBusy(false); }
  };
  const Icon = busy ? Loader2 : compact ? Save : Plus;
  return <>
    <button type="button" disabled={busy || disabled} aria-busy={busy} aria-label={label} title={label} onClick={() => void run()}
      className={compact
        ? 'text-muted-foreground hover:bg-card hover:text-foreground focus-visible:ring-ring/50 flex size-6 shrink-0 items-center justify-center rounded-sm outline-none focus-visible:ring-2 disabled:opacity-50'
        : 'catalog-product-surface bg-sidebar text-sidebar-foreground hover:brightness-95 focus-visible:ring-ring/50 flex min-h-10 w-full min-w-0 items-center gap-2 rounded-md px-3 py-2 text-start text-xs outline-none focus-visible:ring-2 disabled:opacity-50'}>
      {!compact && <span className="min-w-0 flex-1 break-words">{label}</span>}
      <Icon aria-hidden="true" className={`size-3.5 shrink-0 ${busy ? 'animate-spin motion-reduce:animate-none' : ''}`} />
    </button>
    {failed && <span role="alert" className="text-destructive order-last block basis-full text-xs">{t('orderWorkspace.catalogSaveError')}</span>}
  </>;
}
