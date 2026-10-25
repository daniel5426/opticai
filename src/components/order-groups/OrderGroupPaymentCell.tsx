import React, { useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { BillingPaymentMenu } from '@/components/billing/BillingPaymentMenu';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { apiClient } from '@/lib/api-client';
import { groupRequest, type OrderGroup } from '@/lib/order-groups';
import type { BillingPayment } from '@/lib/db/schema-interface';
import { formatBillingAmount, getBillingBalance } from '@/lib/billing-payment-status';
import { emitBillingPaymentsChanged } from '@/lib/billing-events';
import type { OrderListBackend } from '@/lib/order-list-compat';

function localDate() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

type PaymentDetails = { group: OrderGroup; payments: BillingPayment[] };

export function OrderGroupPaymentCell({ group, backend = 'groups' }: { group: OrderGroup; backend?: OrderListBackend }) {
  const { t } = useTranslation();
  const { locale, direction } = useAppLocale();
  const { currentUser } = useUser();
  const cache = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(localDate);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const savingRef = useRef(false);
  const canPay = (currentUser?.role_level || 1) >= 2 && Boolean(group.billing?.id) && Number(group.billing?.total_after_discount) > 0;
  const queryKey = ['order-group-quick-payment', group.legacy_order?.kind || 'group', group.id, backend];
  const details = useQuery<PaymentDetails>({
    queryKey,
    enabled: open && canPay,
    retry: false,
    staleTime: 0,
    queryFn: async () => {
      if (group.legacy_order) {
        const [billing, history] = await Promise.all([
          apiClient.getBilling(group.billing!.id!), apiClient.getBillingPayments(group.billing!.id!),
        ]);
        if (billing.error || history.error) throw new Error('payment history unavailable');
        return { group: { ...group, billing: billing.data || group.billing }, payments: history.data || [] };
      }
      const [latest, payments] = await Promise.all([
        groupRequest<OrderGroup>(`/${group.id}`), groupRequest<BillingPayment[]>(`/${group.id}/payments`),
      ]);
      return { group: latest, payments };
    },
  });
  const current = details.data?.group || group;
  const billing = current.billing;
  const currency = billing?.currency || 'ILS';
  const total = Number(billing?.total_after_discount) || 0;
  const paid = Number(billing?.prepayment_amount) || 0;
  const balance = getBillingBalance(total, paid);
  const fullyPaid = total > 0 && paid >= total;
  const formatCurrency = (value?: number | null, unit = currency) => formatBillingAmount(value, unit, locale);
  const status = t(paid <= 0 ? 'orderGroupUnpaid' : paid >= total ? 'orderGroupPaid' : 'orderGroupPartiallyPaid');

  const submit = async () => {
    if (savingRef.current || !canPay || details.isFetching || details.isError || !details.data) return;
    const value = Math.round(Number(amount) * 100) / 100;
    if (!Number.isFinite(value) || value <= 0) {
      toast.error(t('orderGroupPositivePayment'));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const payload = { amount: value, paid_at: date || localDate(), kind: 'payment' };
      let result: { payment: BillingPayment; group: OrderGroup };
      if (backend === 'legacy') {
        const response = await apiClient.createBillingPayment(current.billing!.id!, payload);
        if (response.error || !response.data) throw new Error(response.error || 'orderGroupPaymentError');
        result = { payment: response.data, group: { ...current, billing: {
          ...current.billing!, prepayment_amount: Math.round((paid + Number(response.data.amount)) * 100) / 100,
        } } };
      } else {
        const target = current.legacy_order
          ? await groupRequest<OrderGroup>(`/resolve/${current.legacy_order.kind}/${current.legacy_order.id}`, { method: 'POST' })
          : current;
        result = await groupRequest<{ payment: BillingPayment; group: OrderGroup }>(`/${target.id}/payments?revision=${target.revision}`, {
          method: 'POST', body: JSON.stringify(payload),
        });
      }
      const payments = [result.payment, ...(details.data?.payments || [])].sort((a, b) => b.paid_at.localeCompare(a.paid_at) || Number(b.id) - Number(a.id));
      cache.setQueryData<PaymentDetails>(queryKey, { group: result.group, payments });
      cache.setQueriesData<{ items: OrderGroup[]; total: number }>({ queryKey: ['order-groups'] }, previous => previous ? {
        ...previous,
        items: previous.items.map(row => row.id === group.id && row.legacy_order?.kind === group.legacy_order?.kind ? result.group : row),
      } : previous);
      const updated = result.group.billing!;
      emitBillingPaymentsChanged({ billingId: updated.id!, prepaymentAmount: updated.prepayment_amount || 0, payments, orderId: updated.order_id, contactLensId: updated.contact_lens_id });
      void cache.invalidateQueries({ queryKey: ['order-groups'] });
      void cache.invalidateQueries({ queryKey: ['order-group-count'] });
      void cache.invalidateQueries({ queryKey: ['client'] });
      void cache.invalidateQueries({ queryKey: ['orders'] });
      setAmount('');
      toast.success(t('orderGroupPaymentSaved'));
    } catch (reason) {
      const conflict = reason instanceof Error && reason.message.includes('order_group_conflict');
      setError(t(conflict ? 'orderGroupConflict' : 'orderGroupPaymentError'));
      if (conflict) void details.refetch();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (!canPay) return <span className="tabular-nums whitespace-nowrap">{formatCurrency(balance)}</span>;

  return <div onClick={event => event.stopPropagation()}>
    <BillingPaymentMenu
      direction={direction} open={open}
      onOpenChange={value => { if (savingRef.current) return; setOpen(value); if (value) { setAmount(''); setDate(localDate()); setError(''); } }}
      saving={saving} disabled={!details.data || details.isFetching || details.isError}
      amount={amount} onAmountChange={setAmount} date={date} onDateChange={setDate} onSubmit={() => void submit()}
      paidSummary={`${formatCurrency(paid)} / ${formatCurrency(total)}`} balance={formatCurrency(balance)}
      recentPayments={details.data?.payments || []} formatCurrency={formatCurrency}
      formatDate={value => value ? new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString({ he: 'he-IL', en: 'en-US', fr: 'fr-FR' }[locale]) : ''}
      trigger={<button type="button" disabled={saving} aria-label={fullyPaid ? status : t('orderGroupQuickPayment', { status, balance: formatCurrency(balance) })} className="cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-wait">
        <Badge variant="outline" className="gap-1.5 px-2.5 py-[3px] text-[13px] leading-[18px] hover:bg-accent/70"><span>{status}</span>{!fullyPaid && <span className="tabular-nums" dir="ltr">{formatCurrency(balance)}</span>}{saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}</Badge>
      </button>}
      status={<>
        {details.isFetching && <p role="status" className="mb-2 text-sm text-muted-foreground">{t('loading')}</p>}
        {(details.isError || error) && <div role="alert" className="mb-2 text-sm text-destructive">{error || t('orderGroupPaymentHistoryError')}{details.isError && <Button size="sm" variant="ghost" onClick={() => void details.refetch()}>{t('orderGroupReload')}</Button>}</div>}
      </>}
    />
  </div>;
}
