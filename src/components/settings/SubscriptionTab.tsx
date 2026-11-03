import * as React from "react";
import { useTranslation } from "react-i18next";
import { IconAlertTriangle, IconBuilding, IconExternalLink, IconUsers } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiClient, type SubscriptionSummary } from "@/lib/api-client";
import { getDirection, normalizeLocale } from "@/localization/locale";

const PORTAL_URL = "https://prysm.co.il";
function Usage({ icon: Icon, label, value, limit }: { icon: typeof IconBuilding; label: string; value: number; limit: number | null }) {
  const percent = limit ? Math.min(100, (value / limit) * 100) : 0;
  return <div className="space-y-3 rounded-xl bg-card p-4 shadow-sm"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" />{label}</span><strong className="tabular-nums" dir="ltr">{value} / {limit ?? "∞"}</strong></div><Progress value={limit ? percent : 100} className="h-1.5" /></div>;
}
export function SubscriptionTab() {
  const { t, i18n } = useTranslation();
  const locale = normalizeLocale(i18n.resolvedLanguage || i18n.language);
  const [subscription, setSubscription] = React.useState<SubscriptionSummary | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => {
    let active = true;
    const refresh = () => void apiClient.getSubscriptionSummary().then(response => {
      if (active) { if (response.data) { setSubscription(response.data); setError(false); } else setError(true); }
    });
    refresh(); const timer = window.setInterval(refresh, 30000);
    window.addEventListener('subscription:attention', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('subscription:attention', refresh); };
  }, []);
  const open = (path: string) => void window.electronAPI.openExternalAuthUrl(`${PORTAL_URL}${path}`);
  const formatDate = (value?: string | null) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(value)) : "—";
  const date = subscription?.status === "trialing" ? subscription.trial_ends_at : subscription?.current_period_ends_at;
  const restricted = subscription?.access_mode === 'suspended' || subscription?.access_mode === 'billing_only';
  return <section className="space-y-5" dir={getDirection(locale)}>
    <header><h2 className="text-lg font-semibold">{t('billing.title')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('billing.description')}</p></header>
    {error ? <p role="alert" className="text-sm text-destructive">{t('billing.error')}</p> : null}
    {subscription?.status === "past_due" || subscription?.access_mode === "read_only" || restricted ? <div role="status" className="flex items-start gap-3 rounded-xl bg-amber-500/10 p-4 text-sm"><IconAlertTriangle className="mt-0.5 size-4 shrink-0" /><div><strong>{t('billing.paymentAttention')}</strong><p className="mt-1 text-muted-foreground">{restricted ? t('billing.restricted') : subscription.access_mode === "read_only" ? t('billing.readOnly') : t('billing.grace', { date: formatDate(subscription.grace_ends_at) })}</p></div></div> : null}
    <div className="grid gap-3 sm:grid-cols-3">{[[t('billing.plan'), subscription?.plan_code || '—'], [t('billing.status'), subscription ? t(`billing.statusLabels.${subscription.status}`) : '—'], [t(subscription?.status === 'trialing' ? 'billing.trialEnd' : 'billing.renewal'), formatDate(date)]].map(([label, value]) => <div key={label} className="rounded-xl bg-card p-4 shadow-sm"><span className="text-sm text-muted-foreground">{label}</span><strong className="mt-2 block text-lg">{value}</strong></div>)}</div>
    <div className="grid gap-3 sm:grid-cols-2"><Usage icon={IconBuilding} label={t('billing.clinics')} value={subscription?.usage.clinics || 0} limit={subscription?.limits.clinics ?? null} /><Usage icon={IconUsers} label={t('billing.staff')} value={subscription?.usage.staff || 0} limit={subscription?.limits.staff ?? null} /></div>
    {subscription?.amount_minor != null ? <p>{t('billing.monthly')}: <strong dir="ltr">₪{(subscription.amount_minor / 100).toFixed(2)}</strong></p> : null}
    <p>{t('billing.card')}: <span dir="ltr">{subscription?.payment_method ? `${subscription.payment_method.brand} •••• ${subscription.payment_method.last4}` : t('billing.noCard')}</span></p>
    {subscription?.renewal_setup_incomplete ? <p role="status">{t('billing.setupIncomplete')}</p> : null}
    <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={!subscription?.can_manage_billing} onClick={() => open('/account/plan')}>{t('billing.managePlan')}<IconExternalLink className="size-4" /></Button><Button variant="outline" disabled={!subscription?.can_manage_billing} onClick={() => open('/account/billing')}>{t('billing.manageBilling')}<IconExternalLink className="size-4" /></Button>{subscription?.can_administer ? <Button variant="outline" onClick={() => open('/admin')}>{t('billing.admin')}<IconExternalLink className="size-4" /></Button> : null}</div>
  </section>;
}
