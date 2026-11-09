import React, { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Archive, CalendarClock, Check, CheckCheck, ChevronLeft, ChevronRight, FileText, FlaskConical, Mail, MessageSquare, Pause, Plus, RefreshCw, Save, Send, Users, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DateInput } from '@/components/ui/date';
import { TimeInput } from '@/components/ui/time';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CampaignChoice, CampaignField, CampaignSetting, campaignRuleTrackClassName, campaignSurfaceClassName } from '@/components/campaigns/campaign-form-controls';
import { money, type CampaignDraft, type Condition, type Quote, type Run } from '@/lib/campaigns';
import { useAppLocale } from '@/localization/use-app-locale';
import { cn } from '@/utils/tailwind';

export type CampaignCatalog = { fields: Record<string, { label: string; type: string }>; operators: Record<string, string[]>; placeholders: string[] };
export type CampaignDeliveries = { total: number; items: { id: string; channel: string; destination: string; status: string; cost: number; error?: string }[] };

export type CampaignTestTarget = { email?: string; sms?: string };

const sections = ['audience', 'content', 'review', 'results'] as const;

function operatorsFor(catalog: CampaignCatalog | null, field: string) {
  if (!catalog) return [];
  const type = catalog.fields[field]?.type;
  if (!type) return [];
  return catalog.operators[type] ?? [];
}
const scheduleKinds = ['once', 'daily', 'monthly', 'yearly', 'custom'] as const;
const messageLocales = [{ value: 'he', label: 'עברית' }, { value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }] as const;

export function CampaignEditor({
  draft, catalog, tab, busy, dirty, canManage, quote, previewError, runs, deliveries, conditions,
  kind, start, days, maxCost, zone,
  onTabChange, onChange, onConditions, onBack, onSave, onPreview, onRequestSend, onActivate,
  onKindChange, onStartChange, onDaysChange, onMaxCostChange, onZoneChange, onTestPreview, onTestSend,
  onPause, onArchive, onRetry, onCancelRun, onOpenDeliveries,
}: {
  draft: CampaignDraft;
  catalog: CampaignCatalog | null;
  tab: string;
  busy: boolean;
  dirty: boolean;
  canManage: boolean;
  quote: Quote | null;
  previewError: boolean;
  runs: Run[];
  deliveries: CampaignDeliveries | null;
  conditions: Condition[];
  kind: string;
  start: string;
  days: number;
  maxCost: string;
  zone: string;
  onTabChange: (value: string) => void;
  onChange: (value: Partial<CampaignDraft>) => void;
  onConditions: (values: Condition[]) => void;
  onBack: () => void;
  onSave: () => void;
  onPreview: () => void;
  onRequestSend: () => void;
  onActivate: () => void;
  onKindChange: (value: string) => void;
  onStartChange: (value: string) => void;
  onDaysChange: (value: number) => void;
  onMaxCostChange: (value: string) => void;
  onZoneChange: (value: string) => void;
  onTestPreview: (target: CampaignTestTarget) => Promise<Quote>;
  onTestSend: (target: CampaignTestTarget, quote: Quote) => Promise<boolean>;
  onPause: () => void;
  onArchive: () => void;
  onRetry: (runId: string) => void;
  onCancelRun: (runId: string) => void;
  onOpenDeliveries: (runId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const { direction, locale } = useAppLocale();
  const tr = (key: string) => t(`campaign.${key}`);
  const locked = !canManage || busy || draft.status === 'scheduled';
  const messageDirection = draft.locale === 'he' ? 'rtl' : 'ltr';
  const fieldLabel = (key: string) => t(`campaign.fields.${key}`, { defaultValue: key.replaceAll('_', ' ') });
  const operatorLabel = (key: string) => t(`campaign.operators.${key}`, { defaultValue: key.replaceAll('_', ' ') });
  const handleAddCondition = () => onConditions([...conditions, { id: crypto.randomUUID(), field: 'age', operator: 'greater_than', value: '40', logic: 'AND' }]);
  const stepIndex = sections.indexOf(tab as typeof sections[number]);
  const stepIcons = [Users, FileText, Send, CheckCheck];
  const NextIcon = direction === 'rtl' ? ChevronLeft : ChevronRight;
  const BackIcon = direction === 'rtl' ? ChevronRight : ChevronLeft;
  const updateCondition = (index: number, value: Partial<Condition>) => onConditions(conditions.map((item, i) => i === index ? { ...item, ...value } : item));

  return (
    <Tabs value={tab} onValueChange={onTabChange} dir={direction} className="no-scrollbar min-h-0 flex-1 gap-0 overflow-y-auto" data-campaign-workspace="" style={{ scrollbarWidth: 'none' }}>
      <div className="mx-auto flex w-full max-w-[960px] flex-col gap-4 pb-4">
        <header className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Input id="campaign-name" aria-label={tr('name')} size={Math.max(12, Math.min(draft.name.length, 48))} dir={direction} value={draft.name} disabled={locked} onChange={(event) => onChange({ name: event.target.value })} className="h-9 w-auto max-w-full rounded-md border-transparent bg-transparent px-0 text-lg! font-semibold shadow-none hover:border-input focus-visible:bg-field" wrapperClassName="min-w-0 max-w-[calc(100%-5rem)]" />
            <Badge variant="secondary" className="shrink-0">{tr(draft.status || 'draft')}</Badge>
          </div>
          {canManage && <div className="flex shrink-0 items-center gap-2">
            {draft.id && <><Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={tr('pause')} title={tr('pause')} onClick={onPause}><Pause className="size-4" /></Button><Button type="button" variant="ghost" size="icon" disabled={busy} aria-label={tr('archive')} title={tr('archive')} onClick={onArchive}><Archive className="size-4" /></Button></>}
            <Button type="button" size="icon" aria-label={tr('save')} title={tr('save')} disabled={busy || !draft.name.trim() || draft.status === 'scheduled' || !dirty} onClick={onSave}><Save className="size-4" /></Button>
          </div>}
        </header>
        {draft.last_error && <p role="alert" className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">{i18n.exists(`campaign.${draft.last_error}`) ? tr(draft.last_error) : tr('error')}</p>}
        <TabsList aria-label={tr('setupSteps')} className="no-scrollbar h-11 w-full justify-start gap-1 overflow-x-auto rounded-xl bg-card p-1 shadow-sm">
          {sections.map((section, index) => {
            const Icon = stepIcons[index];
            return <TabsTrigger key={section} value={section} aria-label={tr(section)} className="group h-9 flex-1 gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-muted-foreground data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none">
              {tr(section)}<Icon className="size-4" />
            </TabsTrigger>;
          })}
        </TabsList>
        <div className={cn("grid items-start gap-5", tab === "content" && "lg:grid-cols-[minmax(0,1fr)_18rem]")}>
          <div className="min-w-0">
            <TabsContent value="audience" className="mt-0 space-y-4">
              <fieldset disabled={locked} className={cn(campaignSurfaceClassName, 'min-w-0 space-y-4')} aria-label={tr('audience')}>
                <div className="flex flex-wrap items-center justify-between gap-3"><div role="radiogroup" aria-label={tr('audience')} className="flex flex-wrap gap-2">
                  {[{ all: true, title: 'allAudience' }, { all: false, title: 'filteredAudience' }].map(({ all, title }) => <button key={title} type="button" role="radio" aria-checked={draft.all_clients === all} onClick={() => onChange({ all_clients: all })} className={cn('flex h-9 items-center gap-2 rounded-lg border px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', draft.all_clients === all ? 'border-primary/40 bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:bg-muted/40')}>
                    {tr(title)}{draft.all_clients === all && <Check className="size-3.5" />}
                  </button>)}
                </div>{!draft.all_clients && <Button type="button" variant="outline" onClick={handleAddCondition}>{tr('addFilter')}<Plus className="size-4" /></Button>}</div>
                {!draft.all_clients && <div className="space-y-3">
                  {conditions.length === 0 && <p className="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">{tr('rulesEmpty')}</p>}
                  {conditions.map((condition, index) => <div key={condition.id ?? `imported-${index}`} className="space-y-3">
                    {index > 0 && <div className="flex items-center gap-3"><span className="h-px flex-1 bg-border" /><CampaignChoice label={tr('operator')} disabled={locked} className="h-8 w-24" value={condition.logic || 'AND'} onValueChange={(value) => updateCondition(index, { logic: value as 'AND' | 'OR' })} options={['AND', 'OR'].map(value => ({ value, label: tr(value) }))} /><span className="h-px flex-1 bg-border" /></div>}
                    <div>
                      <div className={cn('grid gap-3 sm:items-end', campaignRuleTrackClassName)}>
                        <CampaignField id={`rule-field-${condition.id ?? `imported-${index}`}`} label={tr('field')}><CampaignChoice id={`rule-field-${condition.id ?? `imported-${index}`}`} label={tr('field')} disabled={locked} value={condition.field} onValueChange={(field) => updateCondition(index, { field, operator: 'equals' })} options={Object.keys(catalog?.fields || {}).map(value => ({ value, label: fieldLabel(value) }))} /></CampaignField>
                        <CampaignField id={`rule-operator-${condition.id ?? `imported-${index}`}`} label={tr('operator')}><CampaignChoice id={`rule-operator-${condition.id ?? `imported-${index}`}`} label={tr('operator')} disabled={locked} value={condition.operator} onValueChange={(operator) => updateCondition(index, { operator })} options={operatorsFor(catalog, condition.field).map(value => ({ value, label: operatorLabel(value) }))} /></CampaignField>
                        <CampaignField id={`rule-value-${condition.id ?? `imported-${index}`}`} label={tr('value')}><Input id={`rule-value-${condition.id ?? `imported-${index}`}`} disabled={locked || ['is_empty', 'is_not_empty'].includes(condition.operator)} value={condition.value} center={catalog?.fields?.[condition.field]?.type === 'number'} dir={catalog?.fields?.[condition.field]?.type === 'number' ? 'ltr' : direction} onChange={(event) => updateCondition(index, { value: event.target.value })} /></CampaignField>
                        <Button type="button" variant="ghost" size="icon" aria-label={tr('remove')} className="text-muted-foreground hover:text-destructive" onClick={() => onConditions(conditions.filter((_, i) => i !== index))}><X className="size-4" /></Button>
                      </div>
                    </div>
                  </div>)}
                </div>}
                <div className="border-t border-border/60 pt-4"><CampaignSetting id="campaign-once-client" label={tr('onceClient')} checked={draft.execute_once_per_client} onCheckedChange={(checked) => onChange({ execute_once_per_client: checked })} /></div>
              </fieldset>

            </TabsContent>
            <TabsContent value="content" className="mt-0">
          {draft.sms_enabled&&<p className="text-sm text-muted-foreground">{tr('smsLengthHelp')}</p>}
              <fieldset disabled={locked} className={cn(campaignSurfaceClassName, 'min-w-0 space-y-4')} aria-label={tr('content')}>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-border/50 pb-4">
                  {(['email', 'sms'] as const).map(channel => {
                    const Icon = channel === 'email' ? Mail : MessageSquare;
                    const checked = channel === 'email' ? draft.email_enabled : draft.sms_enabled;
                    return <div key={channel} className="inline-flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /><Label htmlFor={`campaign-${channel}`} className="text-sm font-normal">{tr(channel)}</Label><Switch id={`campaign-${channel}`} checked={checked} onCheckedChange={value => onChange(channel === 'email' ? { email_enabled: value } : { sms_enabled: value })} /></div>;
                  })}
                  <div className="ms-auto w-28"><CampaignChoice id="campaign-language" label={tr('language')} disabled={locked} value={draft.locale} onValueChange={locale => onChange({ locale })} options={[...messageLocales]} /></div>
                </div>
                {!draft.email_enabled && !draft.sms_enabled && <p className="py-3 text-sm text-muted-foreground">{tr('noChannels')}</p>}
                {(['email', 'sms'] as const).filter(channel => channel === 'email' ? draft.email_enabled : draft.sms_enabled).map(channel => <MessageContent key={channel} channel={channel} draft={draft} catalog={catalog} direction={messageDirection} onChange={onChange} />)}
              </fieldset>
            </TabsContent>
            <TabsContent value="review" className="mt-0">
              <section className={cn(campaignSurfaceClassName, 'space-y-5')} aria-label={tr('review')} aria-busy={busy}>
                <div className="flex items-center justify-between gap-3"><SectionHeading icon={<Send className="size-4" />} title={tr('review')} /><Button type="button" variant="ghost" size="icon" disabled={busy || !draft.name.trim()} title={tr('refresh')} aria-label={tr('refresh')} onClick={onPreview}><RefreshCw className={cn('size-4', busy && 'animate-spin motion-reduce:animate-none')} /></Button></div>
                <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                  {[[tr('email'), quote?.emails], [tr('sms'), quote?.sms], [tr('billingUnits'), quote ? quote.billing_units ?? quote.segments : undefined], [tr('cost'), quote ? money(quote.total_cost, locale) : undefined]].map(([label, value]) => <div key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className={cn('mt-2 text-2xl font-semibold tabular-nums', busy && !quote && 'animate-pulse motion-reduce:animate-none')}>{value ?? '—'}</p></div>)}
                </div>
                {previewError && <p role="alert" className="text-sm text-destructive">{tr('error')}</p>}
                {quote && <>
                  {(quote.included > 0 || Object.keys(quote.excluded).length > 0) && <div className="flex flex-wrap items-center gap-2 border-t border-border/50 pt-4">{quote.channels&&(['email','sms'] as const).map(channel=><Badge key={channel} variant="outline">{tr(channel)} · {tr('included')}: {quote.channels?.[channel].included_units} · {tr('paidUnits')}: {quote.channels?.[channel].paid_units}</Badge>)}{!quote.channels && quote.included > 0 && <Badge variant="secondary">{tr('included')}: {quote.included}</Badge>}{Object.entries(quote.excluded).map(([key, value]) => <Badge key={key} variant="secondary">{tr(key)}: {value}</Badge>)}</div>}
                  {quote.errors.length > 0 && <div className="space-y-1.5">{quote.errors.map(item => <p role="alert" className="text-sm text-destructive" key={item}>{tr(item)}</p>)}</div>}
                  {quote.sample.length > 0 && <details className="border-t border-border/50 pt-4"><summary className="cursor-pointer text-sm text-muted-foreground">{tr('messagePreview')}</summary><div className="mt-4 space-y-4">{quote.sample.map((sample, index) => <article key={index} dir={messageDirection} className="border-s-2 border-border ps-3"><p className="mb-1 text-xs text-muted-foreground">{tr(sample.channel)}</p>{sample.subject && <p className="text-sm font-medium">{sample.subject}</p>}<p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6">{sample.content}</p></article>)}</div></details>}
                </>}
                <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/50 pt-4">
                  <TestSendDialog draft={draft} busy={busy} disabled={!canManage || dirty || busy || !quote} onPreview={onTestPreview} onSend={onTestSend} />
                  <Button type="button" disabled={!canManage || busy || !quote || !!quote.errors.length || dirty} onClick={onRequestSend}>{tr('send')}<Send className="size-4" /></Button>
                </div>
              </section>
            </TabsContent>
            <TabsContent value="results" className="mt-0 space-y-4">
              {!runs.length && <EmptyPanel icon={<Send className="size-5" />} title={tr('noRuns')} description={tr('resultsEmptyHint')} />}
              {runs.map((run) => <article key={run.id} className={cn(campaignSurfaceClassName, 'space-y-4')}>
                <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" className="space-y-1 text-start text-sm font-medium hover:text-primary" onClick={() => onOpenDeliveries(run.id)}><bdi>{new Date(run.created_at).toLocaleString(locale)}</bdi><span className="block text-xs text-muted-foreground">{tr(run.status)} · {money(run.charged, locale)}</span></button><Badge variant="secondary">{tr(run.status)}</Badge></div>
                <div className="flex flex-wrap gap-2">{Object.entries(run.counts).map(([key, value]) => <Badge variant="secondary" key={key}>{tr(key)}: {value}</Badge>)}</div>
                {canManage && <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3"><Button type="button" variant="outline" disabled={busy || !run.counts.failed} onClick={() => onRetry(run.id)}>{tr('retry')}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => onCancelRun(run.id)}>{tr('cancelRun')}</Button></div>}
              </article>)}
              {deliveries && <section className={campaignSurfaceClassName}><div className="overflow-x-auto"><table className="w-full text-start text-sm"><thead><tr className="border-b text-muted-foreground">{['destination', 'channel', 'status', 'cost'].map((key) => <th key={key} className="px-2 pb-3 text-start font-normal">{tr(key)}</th>)}</tr></thead><tbody>{deliveries.items.map((item) => <tr key={item.id} className="border-b border-border/40 last:border-0"><td className="px-2 py-3"><bdi>{item.destination}</bdi></td><td className="px-2 py-3">{tr(item.channel)}</td><td className="px-2 py-3">{tr(item.status)}</td><td className="px-2 py-3 tabular-nums">{money(item.cost, locale)}</td></tr>)}</tbody></table></div></section>}
            </TabsContent>
          </div>
          {tab === 'content' && <aside className="min-w-0" aria-label={tr('schedule')}><fieldset disabled={locked} className={cn(campaignSurfaceClassName, 'min-w-0 space-y-4')}>
            <SectionHeading icon={<CalendarClock className="size-4" />} title={tr('schedule')} />
            <CampaignField id="campaign-kind" label={tr('kind')}><CampaignChoice id="campaign-kind" label={tr('kind')} disabled={locked} value={kind} onValueChange={onKindChange} options={scheduleKinds.map(value => ({ value, label: tr(value) }))} /></CampaignField>
            <div className="grid grid-cols-[minmax(0,1fr)_7rem] gap-3">
              <CampaignField id="campaign-date" label={tr('startDate')}><DateInput className="px-7" name="campaign-date" value={start.split('T')[0]} disabled={locked} dir="ltr" onChange={event => onStartChange(event.target.value ? `${event.target.value}T${start.split('T')[1] || '09:00'}` : '')} /></CampaignField>
              <CampaignField id="campaign-time" label={tr('startTime')}><TimeInput id="campaign-time" value={start.split('T')[1] || ''} disabled={locked} onChange={event => onStartChange(`${start.split('T')[0] || new Date().toLocaleDateString('en-CA')}T${event.target.value}`)} /></CampaignField>
            </div>
            <CampaignField id="campaign-timezone" label={tr('timezone')}><Input id="campaign-timezone" dir="ltr" center value={zone} onChange={event => onZoneChange(event.target.value)} /></CampaignField>
            <div className="flex flex-wrap items-end gap-3">
              {kind === 'custom' && <CampaignField id="campaign-days" label={tr('days')} className="w-24"><Input id="campaign-days" type="number" min="1" max="3660" value={days} onChange={event => onDaysChange(Number(event.target.value))} /></CampaignField>}
              <CampaignField id="campaign-max-cost" label={tr('maxCost')} className="min-w-0 flex-1"><Input id="campaign-max-cost" className="w-28" type="number" min="0" step="0.01" dir="ltr" value={maxCost} onChange={event => onMaxCostChange(event.target.value)} /></CampaignField>
            </div>
            <Button type="button" variant="outline" className="w-full" disabled={locked || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start) || maxCost === '' || !draft.name.trim()} onClick={onActivate}>{tr('activate')}<CalendarClock className="size-4" /></Button>
          </fieldset></aside>}
        </div>
        <footer className="flex items-center justify-between gap-3">
          <Button type="button" variant="outline" className="bg-card shadow-sm" onClick={() => stepIndex > 0 ? onTabChange(sections[stepIndex - 1]) : onBack()}>{tr('previous')}<BackIcon className="size-4" /></Button>
          {stepIndex < 2 && <Button type="button" onClick={() => onTabChange(sections[stepIndex + 1])}>{tr('next')}<NextIcon className="size-4" /></Button>}
        </footer>
      </div>
    </Tabs>
  );
}

function SectionHeading({ id, icon, title }: { id?: string; icon: ReactNode; title: string }) {
  return <div className="flex items-center gap-2 text-muted-foreground">{icon}<h2 id={id} className="text-sm font-medium text-foreground">{title}</h2></div>;
}

function EmptyPanel({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return <div className={cn(campaignSurfaceClassName, 'flex min-h-48 flex-col items-center justify-center gap-3 text-center')}><span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">{icon}</span><div><h3 className="text-sm font-medium">{title}</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{description}</p></div></div>;
}

function MessageContent({ channel, draft, catalog, direction, onChange }: { channel: 'email' | 'sms'; draft: CampaignDraft; catalog: CampaignCatalog | null; direction: 'rtl' | 'ltr'; onChange: (value: Partial<CampaignDraft>) => void }) {
  const { t } = useTranslation();
  const tr = (key: string) => t(`campaign.${key}`);
  const content = channel === 'email' ? draft.email_content : draft.sms_content;
  const handleContent = (value: string) => onChange(channel === 'email' ? { email_content: value } : { sms_content: value });
  return <section className="space-y-4 border-border/50 [&+section]:border-t [&+section]:pt-4" aria-label={tr(channel)}>
    {channel === 'email' && <CampaignField id="campaign-subject" label={tr('subject')}><Input id="campaign-subject" dir={direction} value={draft.subject} onChange={event => onChange({ subject: event.target.value })} /></CampaignField>}
    <CampaignField id={`campaign-${channel}-content`} label={channel === 'sms' ? tr('sms') : tr('messageBody')}><Textarea id={`campaign-${channel}-content`} dir={direction} className="no-scrollbar min-h-40 resize-y leading-7" value={content} onChange={event => handleContent(event.target.value)} /></CampaignField>
    {catalog && catalog.placeholders.length > 0 && <CampaignChoice label={tr('placeholders')} placeholder={tr('placeholders')} value="" className="w-40" onValueChange={value => handleContent(`${content} {${value}}`)} options={catalog.placeholders.map(value => ({ value, label: t(`campaign.placeholderLabels.${value}`, { defaultValue: value }) }))} />}

  </section>;
}

function TestSendDialog({ draft, busy, disabled, onPreview, onSend }: { draft: CampaignDraft; busy: boolean; disabled: boolean; onPreview: (target: CampaignTestTarget) => Promise<Quote>; onSend: (target: CampaignTestTarget, quote: Quote) => Promise<boolean> }) {
  const { t, i18n } = useTranslation();
  const { direction, locale } = useAppLocale();
  const tr = (key: string) => t(`campaign.${key}`);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [sms, setSms] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [pending, setPending] = useState(false);
  const [quotedTarget, setQuotedTarget] = useState('');
  const [quoteRefresh, setQuoteRefresh] = useState(0);
  const [error, setError] = useState('');
  const testEmail = draft.email_enabled ? email.trim() : '';
  const testSms = draft.sms_enabled ? sms.trim() : '';
  const targetKey=JSON.stringify([testEmail,testSms]);
  const freshQuote=quotedTarget===targetKey?quote:null;
  const valid = Boolean(testEmail || testSms) && (!testEmail || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail));
  useEffect(() => {
    setQuote(null);setError('');
    if(!open || !valid){setPending(false);return;}
    let active=true;setPending(true);
    const timer=window.setTimeout(() => {
      const target={...(testEmail ? {email:testEmail}:{}),...(testSms ? {sms:testSms}:{})};
      void onPreview(target).then(value=>{if(active){setQuote(value);setQuotedTarget(targetKey);}}).catch(reason=>{if(active)setError(reason instanceof Error?reason.message:'error');}).finally(()=>{if(active)setPending(false);});
    },350);
    return ()=>{active=false;window.clearTimeout(timer);};
  },[open,valid,testEmail,testSms,draft.revision,onPreview,targetKey,quoteRefresh]);
  const submit = async(event:React.FormEvent) => {
    event.preventDefault();
    if(!freshQuote || pending || busy || freshQuote.errors.length || !valid)return;
    const target={...(testEmail ? {email:testEmail}:{}),...(testSms ? {sms:testSms}:{})};
    if(await onSend(target,freshQuote))setOpen(false);else setQuoteRefresh(value=>value+1);
  };
  return <>
    <Button type="button" variant="outline" disabled={disabled} onClick={()=>setOpen(true)}>{tr('test')}<FlaskConical className="size-4" /></Button>
    <Dialog open={open} onOpenChange={value=>{if(!busy)setOpen(value);}}><DialogContent dir={direction} className="sm:max-w-md"><form onSubmit={event=>void submit(event)} className="space-y-5">
      <DialogHeader><DialogTitle>{tr('test')}</DialogTitle><DialogDescription>{tr('testHint')}</DialogDescription></DialogHeader>
      {draft.email_enabled && <CampaignField id="campaign-test-email" label={tr('testEmail')}><Input id="campaign-test-email" type="email" dir="ltr" disabled={busy} value={email} onChange={event=>setEmail(event.target.value)} /></CampaignField>}
      {draft.sms_enabled && <CampaignField id="campaign-test-sms" label={tr('testSms')}><Input id="campaign-test-sms" type="tel" dir="ltr" disabled={busy} value={sms} onChange={event=>setSms(event.target.value)} /></CampaignField>}
      <div aria-live="polite" className="flex min-h-5 items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{tr('cost')}</span><span className="font-medium tabular-nums">{pending ? <RefreshCw aria-label={tr('calculating')} className="size-4 animate-spin motion-reduce:animate-none" /> : freshQuote ? money(freshQuote.total_cost,locale) : '—'}</span></div>
      {error && <p role="alert" className="text-sm text-destructive">{i18n.exists(`campaign.${error}`)?tr(error):tr('error')}</p>}
      {freshQuote && freshQuote.errors.length > 0 && <div className="space-y-1.5">{freshQuote.errors.map(item=><p role="alert" key={item} className="text-sm text-destructive">{tr(item)}</p>)}</div>}
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={()=>setOpen(false)}>{tr('cancel')}</Button><Button type="submit" disabled={busy || pending || !valid || !freshQuote || freshQuote.errors.length > 0}>{tr('test')}<Send className="size-4" /></Button></DialogFooter>
    </form></DialogContent></Dialog>
  </>;
}
