import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useUser } from '@/contexts/UserContext';
import { useSettings } from '@/hooks/useSettings';
import { useAppLocale } from '@/localization/use-app-locale';
import { discountRequest, type DiscountDefinition } from '@/lib/discounts';
import { formatBillingAmount } from '@/lib/billing-payment-status';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CustomModal } from '@/components/ui/custom-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export function DiscountsTab() {
  const { t } = useTranslation();
  const { direction, locale } = useAppLocale();
  const { currentClinic, currentUser } = useUser();
  const { company } = useSettings();
  const queryClient = useQueryClient();
  const clinicId = currentClinic?.id;
  const key = ['discounts', clinicId];
  const query = useQuery({ queryKey: key, enabled: Boolean(clinicId), queryFn: () => discountRequest<DiscountDefinition[]>(clinicId!) });
  const [draft, setDraft] = useState<Partial<DiscountDefinition> | null>(null);
  const [amount, setAmount] = useState('');
  const [removing, setRemoving] = useState<DiscountDefinition | null>(null);
  const [saving, setSaving] = useState(false);
  const canEdit = (currentUser?.role_level || 1) >= 2;
  const edit = (discount?: DiscountDefinition) => {
    setDraft(discount || { description: '', currency: company?.default_currency || 'ILS' });
    setAmount(discount ? String(discount.amount) : '');
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clinicId || !draft || !draft.description?.trim() || !(Number(amount) > 0)) return;
    setSaving(true);
    try {
      await discountRequest(clinicId, draft.id ? `/${draft.id}` : '', { method: draft.id ? 'PUT' : 'POST', body: JSON.stringify({ description: draft.description.trim(), amount: Number(amount), currency: draft.currency }) });
      await queryClient.invalidateQueries({ queryKey: key });
      setDraft(null);
    } catch { toast.error(t('discounts.saveError')); }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!clinicId || !removing) return;
    setSaving(true);
    try {
      await discountRequest(clinicId, `/${removing.id}`, { method: 'DELETE' });
      await queryClient.invalidateQueries({ queryKey: key });
      setRemoving(null);
    } catch { toast.error(t('discounts.saveError')); }
    finally { setSaving(false); }
  };
  return <div className="space-y-4 text-start" dir={direction}>
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-lg font-medium">{t('discounts.title')}</h2>
      {canEdit && <Button type="button" size="icon" aria-label={t('discounts.create')} title={t('discounts.create')} onClick={() => edit()} disabled={!clinicId || query.isPending}><Plus className="size-4" /></Button>}
    </div>
    <div className="overflow-x-auto rounded-xl bg-card shadow-sm">
      <table className="w-full text-sm"><thead><tr className="border-b"><th className="p-3 text-start font-medium">{t('orderGroupDescription')}</th><th className="p-3 text-end font-medium">{t('orderGroupAmount')}</th><th className="w-24"><span className="sr-only">{t('discounts.actions')}</span></th></tr></thead>
        <tbody>{query.isPending || query.isError || !query.data?.length ? <tr><td colSpan={3} className="p-6 text-center text-muted-foreground">{query.isError ? <><span>{t('discounts.loadError')}</span><Button type="button" variant="ghost" onClick={() => void query.refetch()}>{t('tryAgain')}</Button></> : t(query.isPending ? 'loading' : 'discounts.empty')}</td></tr> : query.data.map(discount => <tr key={discount.id} className="border-b last:border-0"><td className="p-3 break-words">{discount.description}</td><td className="p-3 text-end tabular-nums">{formatBillingAmount(Number(discount.amount), discount.currency, locale)}</td><td className="p-2">{canEdit && <div className="flex gap-1"><Button type="button" variant="ghost" size="icon" aria-label={t('discounts.edit')} onClick={() => edit(discount)}><Pencil className="size-4" /></Button><Button type="button" variant="ghost" size="icon" aria-label={t('discounts.remove')} onClick={() => setRemoving(discount)}><Trash2 className="size-4" /></Button></div>}</td></tr>)}</tbody>
      </table>
    </div>
    <CustomModal isOpen={Boolean(draft)} onClose={() => { if (!saving) setDraft(null); }} title={t(draft?.id ? 'discounts.edit' : 'discounts.create')} direction={direction} width="max-w-md">
      <form onSubmit={save} className="space-y-4"><fieldset disabled={saving} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="discount-description">{t('orderGroupDescription')}</Label><Input id="discount-description" autoFocus required maxLength={200} value={draft?.description || ''} onChange={event => setDraft(value => ({ ...value, description: event.target.value }))} /></div>
        <div className="flex gap-3"><div className="min-w-0 flex-1 space-y-1.5"><Label htmlFor="discount-amount">{t('orderGroupAmount')}</Label><Input id="discount-amount" required type="number" dir="ltr" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={event => setAmount(event.target.value)} /></div>
          <div className="w-28 space-y-1.5"><Label>{t('discounts.currency')}</Label><Select clearable={false} dir={direction} value={draft?.currency || 'ILS'} onValueChange={currency => setDraft(value => ({ ...value, currency: currency as DiscountDefinition['currency'] }))}><SelectTrigger aria-label={t('discounts.currency')}><SelectValue /></SelectTrigger><SelectContent>{['ILS', 'USD', 'EUR'].map(currency => <SelectItem key={currency} value={currency}>{currency}</SelectItem>)}</SelectContent></Select></div></div>
        <div className={`flex gap-2 ${direction === 'rtl' ? 'justify-start' : 'justify-end'}`}><Button type="button" variant="outline" onClick={() => setDraft(null)}>{t('cancel')}</Button><Button type="submit">{t('discounts.save')}</Button></div>
      </fieldset></form>
    </CustomModal>
    <CustomModal isOpen={Boolean(removing)} onClose={() => { if (!saving) setRemoving(null); }} title={t('discounts.remove')} direction={direction} width="max-w-md">
      <p className="mb-4 text-sm">{t('discounts.removeHelp', { description: removing?.description })}</p><div className={`flex gap-2 ${direction === 'rtl' ? 'justify-start' : 'justify-end'}`}><Button type="button" disabled={saving} variant="outline" onClick={() => setRemoving(null)}>{t('cancel')}</Button><Button type="button" disabled={saving} variant="destructive" onClick={() => void remove()}>{t('discounts.remove')}</Button></div>
    </CustomModal>
  </div>;
}
