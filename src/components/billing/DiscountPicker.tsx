import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { CustomModal } from '@/components/ui/custom-modal';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAppLocale } from '@/localization/use-app-locale';
import { discountRequest, type DiscountDefinition } from '@/lib/discounts';
import { formatBillingAmount } from '@/lib/billing-payment-status';

export function DiscountPicker({ open, onClose, clinicId, currency, onSelect, disabled }: {
  open: boolean; onClose: () => void; clinicId?: number; currency: string;
  onSelect: (discount: DiscountDefinition) => void; disabled?: boolean;
}) {
  const { t } = useTranslation();
  const { locale, direction } = useAppLocale();
  const query = useQuery({ queryKey: ['discounts', clinicId], enabled: open && Boolean(clinicId), queryFn: () => discountRequest<DiscountDefinition[]>(clinicId!) });
  const [search, setSearch] = useState('');
  useEffect(() => { if (open) setSearch(''); }, [open]);
  const needle = search.trim().toLocaleLowerCase(locale);
  const matching = query.data?.filter(discount => discount.currency === currency) || [];
  const results = matching.filter(discount => `${discount.description} ${discount.amount}`.toLocaleLowerCase(locale).includes(needle));
  return <CustomModal isOpen={open} onClose={onClose} title={t('discounts.newDiscount')} direction={direction} width="max-w-3xl" className="min-w-0">
    <div role="search"><Input autoFocus aria-label={t('discounts.search')} placeholder={t('discounts.search')} dir={direction} value={search} onChange={event => setSearch(event.target.value)} /></div>
    {query.isError ? <div role="alert"><p>{t('discounts.loadError')}</p><Button type="button" variant="outline" onClick={() => void query.refetch()}>{t('tryAgain')}</Button></div> : query.isPending ? <p>{t('loading')}</p> : results.length ? <ul className="divide-y">{results.map(discount => <li key={discount.id}><Button type="button" variant="ghost" disabled={disabled} className="h-auto w-full justify-between gap-3 py-3 text-start" onClick={() => onSelect(discount)}><span className="min-w-0 whitespace-normal break-words">{discount.description}</span><span className="shrink-0 tabular-nums">−{formatBillingAmount(Number(discount.amount), discount.currency, locale)}</span></Button></li>)}</ul> : <p className="py-4 text-sm text-muted-foreground">{t(matching.length ? 'discounts.noResults' : 'discounts.noneForCurrency', { currency })}</p>}
  </CustomModal>;
}
