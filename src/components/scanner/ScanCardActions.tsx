import React from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
export function ScanCardActions({ scanned, clear, disabled }: {scanned?: boolean; clear?: () => void; disabled?: boolean}) {
  const { t } = useTranslation();
  return <span className="inline-flex items-center gap-1.5">
    {scanned && <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">{t('scanner.scanned')}</span>}
    {clear && <Button type="button" variant="ghost" size="icon" className="size-8" disabled={disabled} aria-label={t('scanner.clear')} title={t('scanner.clear')} onClick={clear}><X className="size-3.5" aria-hidden="true" /></Button>}
  </span>;
}
