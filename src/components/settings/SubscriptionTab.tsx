import * as React from "react";
import { IconAlertTriangle, IconBuilding, IconExternalLink, IconUsers } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { apiClient, type SubscriptionSummary } from "@/lib/api-client";

const PORTAL_URL = "https://prysm.co.il";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function Usage({ icon: Icon, label, value, limit }: { icon: typeof IconBuilding; label: string; value: number; limit: number | null }) {
  const percent = limit ? Math.min(100, (value / limit) * 100) : 0;
  return <div className="space-y-3 border p-4"><div className="flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" />{label}</span><strong className="tabular-nums" dir="ltr">{value} / {limit ?? "∞"}</strong></div><Progress value={limit ? percent : 100} className="h-1.5" /></div>;
}

export function SubscriptionTab() {
  const [subscription, setSubscription] = React.useState<SubscriptionSummary | null>(null);
  const [error, setError] = React.useState(false);
  React.useEffect(() => { void apiClient.getSubscriptionSummary().then((response) => response.data ? setSubscription(response.data) : setError(true)); }, []);
  const open = (path: string) => void window.electronAPI.openExternalAuthUrl(`${PORTAL_URL}${path}`);
  const date = subscription?.status === "trialing" ? subscription.trial_ends_at : subscription?.current_period_ends_at;

  return <section className="space-y-5" dir="rtl">
    <header><h2 className="text-lg font-semibold">תוכנית ומנוי</h2><p className="mt-1 text-sm text-muted-foreground">סטטוס המנוי, מגבלות השימוש וקישורים מאובטחים לניהול באתר Prysm.</p></header>
    {error ? <div className="border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">לא ניתן לטעון את פרטי המנוי כרגע.</div> : null}
    {subscription?.status === "past_due" || subscription?.access_mode === "read_only" ? <div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 p-4 text-sm"><IconAlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" /><div><strong>נדרשת תשומת לב לחיוב</strong><p className="mt-1 text-muted-foreground">{subscription.access_mode === "read_only" ? "המערכת במצב קריאה בלבד עד להסדרת התשלום." : `הגישה המלאה נשמרת עד ${formatDate(subscription.grace_ends_at)}.`}</p></div></div> : null}
    <div className="grid gap-3 sm:grid-cols-3"><div className="border p-4"><span className="text-sm text-muted-foreground">תוכנית</span><strong className="mt-2 block text-xl capitalize">{subscription?.plan_code || "—"}</strong></div><div className="border p-4"><span className="text-sm text-muted-foreground">סטטוס</span><strong className="mt-2 block text-xl capitalize">{subscription?.status.replaceAll("_", " ") || "—"}</strong></div><div className="border p-4"><span className="text-sm text-muted-foreground">{subscription?.status === "trialing" ? "סיום ניסיון" : "חידוש הבא"}</span><strong className="mt-2 block text-base">{formatDate(date || null)}</strong></div></div>
    <div className="grid gap-3 sm:grid-cols-2"><Usage icon={IconBuilding} label="מרפאות פעילות" value={subscription?.usage.clinics || 0} limit={subscription?.limits.clinics ?? null} /><Usage icon={IconUsers} label="אנשי צוות פעילים" value={subscription?.usage.staff || 0} limit={subscription?.limits.staff ?? null} /></div>
    <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => open("/account/plan")}>ניהול תוכנית<IconExternalLink className="size-4" /></Button><Button variant="outline" onClick={() => open("/account/billing")} disabled={subscription?.plan_code === "legacy"}>ניהול חיוב<IconExternalLink className="size-4" /></Button></div>
  </section>;
}
