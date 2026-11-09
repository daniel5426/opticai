import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAppLocale } from '@/localization/use-app-locale';
import { catalogProductName } from '@/components/inventory/InventoryCatalogCombobox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { CatalogVariant } from '@/lib/inventory';
import type { ScanCommand } from '@/lib/scanner';

export function ScannerItemDialog({ scan, variant, onClose, onOpenInventory, onEdit }: {
  scan: ScanCommand | null;
  variant: CatalogVariant | null;
  onClose: () => void;
  onOpenInventory: () => void;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const rows = variant ? [
    ...Object.entries(variant.attributes || {}).filter(([, value]) => value !== null && value !== '').map(([key, value]) => ({
      label: t(`scanner.attribute.${key}`, { defaultValue: key.toUpperCase() }), value: String(value),
    })),
    { label: t('scanner.available'), value: String(variant.balance?.available ?? '—') },
    { label: t('scanner.price'), value: `${variant.default_retail ?? '—'} ${variant.currency}` },
  ] : [];
  return <Dialog open={!!scan} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent dir={direction} className="gap-3 p-5 sm:max-w-sm">
      <DialogHeader className="gap-1">
        <DialogTitle className="pe-6 text-base leading-snug">{variant ? catalogProductName(variant) : scan?.summary.name || t('scanner.notFound')}</DialogTitle>
        <DialogDescription><bdi>{scan?.barcode}</bdi></DialogDescription>
      </DialogHeader>
      {scan?.summary.archived && <p className="text-sm">{t('scanner.archived')}</p>}
      {!!rows.length && <dl className="grid grid-cols-[5rem_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-start text-sm">
        {rows.map((row, index) => <React.Fragment key={index}>
          <dt className="text-muted-foreground">{row.label}</dt>
          <dd className="m-0 min-w-0 break-words text-start"><bdi>{row.value}</bdi></dd>
        </React.Fragment>)}
      </dl>}
      <DialogFooter>
        <Button size="sm" variant="outline" onClick={onOpenInventory}>{t('scanner.openInventory')}</Button>
        {onEdit && <Button size="sm" onClick={onEdit}>{t('scanner.edit')}</Button>}
        <Button size="sm" variant={onEdit ? 'outline' : 'default'} onClick={onClose}>{t('scanner.close')}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
