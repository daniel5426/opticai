import React from 'react';
import { useTranslation } from 'react-i18next';
import { useUser } from '@/contexts/UserContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableHeader, TableHead, TableRow, TableBody, TableCell } from '@/components/ui/table';
import { campaignApi, money, type MessagingSummary, type Topup, type UsageRow, type ClinicMessaging } from '@/lib/campaigns';
import { toast } from 'sonner';
import { MessagingTopupDialog } from './MessagingTopupDialog';
import { CircleAlert, Info } from 'lucide-react';

type LedgerRow={id:string;kind:string;amount:number;created_at:string};
export function MessagingTab({company=false}:{company?:boolean}) {
  const {t,i18n}=useTranslation();const {direction}=useAppLocale();const {currentClinic}=useUser();
  const locale=i18n.language.split('-')[0];const tr=(k:string)=>t(`campaign.${k}`);
  const [summary,setSummary]=React.useState<MessagingSummary|null>(null);
  const [usage,setUsage]=React.useState<{total:number;items:UsageRow[]}>({total:0,items:[]});
  const topupIntent=React.useRef<{amount:number;key:string}|null>(null);
  const [checkout,setCheckout]=React.useState<Topup|null>(null);
  const [payments,setPayments]=React.useState<Topup[]>([]);const [ledger,setLedger]=React.useState<LedgerRow[]>([]);
  const [error,setError]=React.useState(false);const [busy,setBusy]=React.useState(false);const [page,setPage]=React.useState(0);
  const [threshold,setThreshold]=React.useState('');
  const thresholdId=React.useId();
  const [range,setRange]=React.useState(30);const [tab,setTab]=React.useState('usage');
  const query=company?'':`clinic_id=${currentClinic?.id||0}&`;
  const refresh=React.useCallback(async()=>{
    if(!company&&!currentClinic?.id)return;
    try {
      const [value,rows]=await Promise.all([campaignApi<MessagingSummary>(`/messaging/summary?${query}`),campaignApi<{total:number;items:UsageRow[]}>(`/messaging/usage?${query}offset=${page*25}&start=${encodeURIComponent(new Date(Date.now()-range*86400000).toISOString())}`)]);
      value.included??={email:{limit:value.allowance,used:value.used,reserved:value.held,remaining:Math.max(0,value.allowance-value.used-value.held)},sms:{limit:0,used:0,reserved:0,remaining:0}};
      value.provider_status??={};
      value.eligible_clinics??=0;
      setSummary(value);setUsage(rows);setError(false);
      if(value.can_pay){const [p,l]=await Promise.all([campaignApi<Topup[]>('/messaging/topups'),campaignApi<{items:LedgerRow[]}>('/messaging/ledger')]);setPayments(p);setLedger(l.items);}
    } catch{setError(true);}
  },[company,currentClinic?.id,query,page,range]);
  React.useEffect(()=>{void refresh();const timer=window.setInterval(()=>void refresh(),30000);return()=>window.clearInterval(timer);},[refresh]);
  const act=async(fn:()=>Promise<void>)=>{setBusy(true);try{await fn();await refresh();}catch{toast.error(tr('error'));}finally{setBusy(false);}};
  const topup=(amount:number)=>void act(async()=>{if(topupIntent.current?.amount!==amount)topupIntent.current={amount,key:crypto.randomUUID()};const row=await campaignApi<Topup>('/messaging/topups',{amount_minor:amount,request_key:topupIntent.current.key,locale});setTab('payments');if(row.payment_url){topupIntent.current=null;setCheckout(row);}else if(['failed','expired'].includes(row.status)){topupIntent.current=null;toast.error(tr('payment_failed'));}else toast.info(tr('payment_pending'));});
  const download=()=>void act(async()=>{const result=await campaignApi<{csv:string}>(`/messaging/usage-export?${query}start=${encodeURIComponent(new Date(Date.now()-range*86400000).toISOString())}`);const url=URL.createObjectURL(new Blob(['\uFEFF'+result.csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='messaging-usage.csv';link.click();URL.revokeObjectURL(url);});
  return <section dir={direction} className="@container min-w-0 space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{tr('usageTitle')}</h2><Button variant="outline" disabled={busy} onClick={()=>void refresh()}>{tr('refresh')}</Button></div>
    {error&&<p role="alert" className="text-destructive">{tr('error')}</p>}
    <div className="grid grid-cols-2 gap-3 @[38rem]:grid-cols-4">{[[tr('available'),summary?money(summary.available,locale):'—'],[tr('reserved'),summary?money(summary.reserved,locale):'—'],...(['email','sms'] as const).map(channel=>[tr(channel==='email'?'includedEmail':'includedSms'),summary?`${summary.included[channel].used} / ${summary.included[channel].limit}`:'—']),[tr('reset'),summary?.period_end?new Date(summary.period_end).toLocaleDateString(locale):'—']].map(([label,value])=><div key={label} className="min-w-0 rounded-xl bg-card p-4 shadow-sm"><p className="truncate text-sm text-muted-foreground" title={label}>{label}</p><p className="mt-2 truncate text-xl font-semibold tabular-nums" title={value}><bdi>{value}</bdi></p></div>)}</div>
    {summary&&<div className="space-y-1 text-sm text-muted-foreground"><p>{t('campaign.pooledClinics',{count:summary.eligible_clinics})}</p><p>{t('campaign.includedReserved',{email:summary.included.email.reserved,sms:summary.included.sms.reserved})}</p><p>{t('campaign.extraRates',{email:money(summary.email_rate??0,locale),sms:money(summary.sms_rate??0,locale)})}</p></div>}
    <div className="space-y-2 text-sm leading-5 text-muted-foreground">
      {(summary&&!summary.period_end||summary&&summary.available<summary.low_balance)&&<div className="space-y-1.5 rounded-lg bg-muted/50 px-3 py-2.5">
        {summary&&!summary.period_end&&<p role="status" className="flex items-start gap-2"><Info className="mt-0.5 size-4 shrink-0" aria-hidden="true"/><span>{tr('setupPeriod')}</span></p>}
        {summary&&summary.available<summary.low_balance&&<p role="status" className="flex items-start gap-2"><CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true"/><span>{tr('lowBalance')}</span></p>}
      </div>}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1"><span>{tr('email')}: {tr(summary?.email_ready?'ready':'notReady')}</span><span>{tr('sms')}: {tr(summary?.sms_ready?'ready':'notReady')}</span>{summary&&!summary.sending_enabled&&<span>{tr('sending_disabled')}</span>}</div>
    </div>
    {summary&&<div className="space-y-1 text-sm text-muted-foreground">{Object.entries(summary.provider_status).map(([provider,value])=><div key={provider}><span>{provider==='micropay'?tr('providerCredit'):tr('emailQuota')}: </span>{provider==='micropay'?<bdi>{value.credit_units??'—'}</bdi>:<span>{Object.entries(value.usage??{}).map(([period,quota])=>`${tr(period)}: ${quota.used} / ${quota.limit??'∞'}`).join(' · ')}</span>}{value.checked_at&&<span> · {tr('checkedAt')}: {new Date(value.checked_at).toLocaleString(locale)}</span>}{(value.error||value.blocked_reason)&&<p role="status">{tr(value.error||value.blocked_reason||'error')}</p>}</div>)}</div>}
    {summary?.can_pay&&<div className="flex flex-wrap items-center gap-2"><span className="text-sm">{tr('topup')}</span>{summary.packs.map(p=><Button key={p} variant="outline" disabled={busy} onClick={()=>topup(p)}>{money(p*10000,locale)}</Button>)}</div>}
    <Tabs value={tab} onValueChange={setTab} dir={direction} className="min-w-0 gap-3">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <TabsList className="max-w-full shrink-0 justify-start overflow-x-auto">{['usage',...(summary?.can_pay?['payments','ledger']:[]),'settings',...(summary?.can_manage?['consent']:[])].map(k=><TabsTrigger className="shrink-0 whitespace-nowrap break-normal" key={k} value={k}>{tr(k)}</TabsTrigger>)}</TabsList>
        {tab==='usage'&&<div className="ms-auto flex shrink-0 items-center gap-2"><select aria-label={tr('usage')} className="h-9 rounded-md border border-input bg-field px-3 text-sm" value={range} onChange={e=>{setPage(0);setRange(Number(e.target.value));}}>{[7,30,90,365].map(n=><option key={n} value={n}>{n} {tr('days')}</option>)}</select><Button variant="outline" disabled={busy} onClick={download}>{tr('export')}</Button></div>}
      </div>
      <TabsContent value="usage" className="min-w-0 space-y-3">
        <Table><TableHeader><TableRow>{['created_at','clinic','channel','status','cost'].map(k=><TableHead key={k}>{tr(k)}</TableHead>)}</TableRow></TableHeader><TableBody>{usage.items.map(row=><TableRow key={row.id}><TableCell>{new Date(row.created_at).toLocaleString(locale)}</TableCell><TableCell>{summary?.clinics.find(c=>c.id===row.clinic_id)?.name||row.clinic_id}</TableCell><TableCell>{tr(row.channel)}</TableCell><TableCell>{tr(row.status)}</TableCell><TableCell>{money(row.cost,locale)}</TableCell></TableRow>)}{!usage.items.length&&<TableRow><TableCell colSpan={5}>{tr('noRuns')}</TableCell></TableRow>}</TableBody></Table>
        <div className="flex justify-between"><Button variant="ghost" disabled={!page} onClick={()=>setPage(p=>p-1)}>‹</Button><span className="text-sm tabular-nums">{page+1} / {Math.max(1,Math.ceil(usage.total/25))}</span><Button variant="ghost" disabled={(page+1)*25>=usage.total} onClick={()=>setPage(p=>p+1)}>›</Button></div>
      </TabsContent>
      <TabsContent value="payments"><Table><TableHeader><TableRow>{['created_at','cost','status','actions'].map(k=><TableHead key={k}>{tr(k)}</TableHead>)}</TableRow></TableHeader><TableBody>{payments.map(p=><TableRow key={p.id}><TableCell>{new Date(p.created_at).toLocaleString(locale)}</TableCell><TableCell>{money(p.amount_minor*10000,locale)}</TableCell><TableCell>{tr(p.status)}</TableCell><TableCell><div className="flex gap-2">{p.status==='pending'&&p.payment_url&&<Button variant="outline" onClick={()=>setCheckout(p)}>{tr('continuePayment')}</Button>}{p.receipt_url&&<a href={p.receipt_url} target="_blank" rel="noreferrer">{tr('receipt')}</a>}<Button variant="ghost" disabled={busy} onClick={()=>void act(async()=>{await campaignApi(`/messaging/topups/${p.id}/reconcile`,{});})}>{tr('reconcile')}</Button></div></TableCell></TableRow>)}</TableBody></Table></TabsContent>
      <TabsContent value="ledger"><Table><TableHeader><TableRow>{['created_at','status','cost'].map(k=><TableHead key={k}>{tr(k)}</TableHead>)}</TableRow></TableHeader><TableBody>{ledger.map(r=><TableRow key={r.id}><TableCell>{new Date(r.created_at).toLocaleString(locale)}</TableCell><TableCell>{tr(r.kind)}</TableCell><TableCell>{money(r.amount,locale)}</TableCell></TableRow>)}</TableBody></Table></TabsContent>
      {summary?.can_manage&&<TabsContent value="consent"><ConsentSettings query={query}/></TabsContent>}
      <TabsContent value="settings" className="min-w-0 space-y-4">
        {summary?.can_pay&&<div className="flex flex-wrap items-end gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-sm">
          <div className="space-y-2"><Label htmlFor={thresholdId} className="block font-normal leading-5">{tr('lowThreshold')}</Label><Input id={thresholdId} wrapperClassName="w-28" dir="ltr" type="number" min="0" step="0.01" suffix="₪" placeholder={String(summary.low_balance/1_000_000)} value={threshold} onChange={e=>setThreshold(e.target.value)}/></div>
          <Button variant="outline" disabled={busy||threshold===''} onClick={()=>void act(async()=>{await campaignApi('/messaging/settings',{low_balance:Math.round(Number(threshold)*1_000_000)},'PUT');setThreshold('');})}>{tr('saveSettings')}</Button>
        </div>}
        {summary?.clinics.map(c=><ClinicSettings key={c.id} value={c} canManage={summary.can_manage} canBudget={summary.can_pay} save={value=>act(async()=>{await campaignApi(`/messaging/clinics/${c.id}`,value,'PUT');})}/>)}
      </TabsContent>
    </Tabs>
    {checkout&&<MessagingTopupDialog key={checkout.id} payment={checkout} onClose={()=>setCheckout(null)} onPaid={()=>{setCheckout(null);void refresh();}}/>}
  </section>;
}
function ClinicSettings({value,canManage,canBudget,save}:{value:ClinicMessaging;canManage:boolean;canBudget:boolean;save:(value:unknown)=>Promise<void>}){
  const {t}=useTranslation();const tr=(k:string)=>t(`campaign.${k}`);
  const id=React.useId();
  const [reply,setReply]=React.useState(value.reply_to||'');const [budget,setBudget]=React.useState(value.budget===null?'':String(value.budget/1_000_000));const [zone,setZone]=React.useState(value.timezone);
  return <fieldset disabled={!canManage} aria-labelledby={`${id}-title`} className="min-w-0 space-y-4 rounded-xl border border-border/50 bg-card p-4 shadow-sm">
    <h3 id={`${id}-title`} className="text-sm font-medium">{value.name}</h3>
    <div className="flex flex-wrap items-start gap-4">
      <div className="w-60 max-w-full space-y-2"><Label htmlFor={`${id}-reply`} className="block font-normal leading-5">{tr('replyTo')}</Label><Input id={`${id}-reply`} type="email" dir="ltr" value={reply} onChange={e=>setReply(e.target.value)}/></div>
      <div className="w-48 max-w-full space-y-2"><Label htmlFor={`${id}-zone`} className="block font-normal leading-5">{tr('timezone')}</Label><Input id={`${id}-zone`} dir="ltr" value={zone} onChange={e=>setZone(e.target.value)}/></div>
      <div className="w-36 max-w-full space-y-2"><Label htmlFor={`${id}-budget`} className="block font-normal leading-5">{tr('budget')}</Label><Input id={`${id}-budget`} disabled={!canBudget} dir="ltr" type="number" min="0" step="0.01" suffix="₪" placeholder={tr('unlimited')} value={budget} onChange={e=>setBudget(e.target.value)}/></div>
    </div>
    <Button variant="outline" onClick={()=>void save({reply_to:reply||null,timezone:zone,budget:budget===''?null:Math.round(Number(budget)*1_000_000)})}>{tr('saveSettings')}</Button>
  </fieldset>;
}

type ConsentClient = {id:number;name:string;channels:Record<'email'|'sms',{destination:string|null;granted:boolean}>};
function ConsentSettings({query}:{query:string}){
  const {t}=useTranslation();const tr=(key:string)=>t(`campaign.${key}`);const id=React.useId();
  const [search,setSearch]=React.useState('');const [clients,setClients]=React.useState<ConsentClient[]>([]);
  const [evidence,setEvidence]=React.useState('');const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState(false);
  const refresh=React.useCallback(async()=>{if(search.trim().length<2){setClients([]);return;}try{setClients(await campaignApi<ConsentClient[]>(`/messaging/consent-clients?${query}search=${encodeURIComponent(search.trim())}`));setError(false);}catch{setError(true);}},[query,search]);
  React.useEffect(()=>{const timer=window.setTimeout(()=>void refresh(),250);return()=>window.clearTimeout(timer);},[refresh]);
  const save=async(client:ConsentClient,channel:'email'|'sms')=>{setBusy(true);try{await campaignApi('/messaging/consent',{client_id:client.id,channel,granted:!client.channels[channel].granted,evidence:evidence.trim()},'PUT');await refresh();}catch{setError(true);}finally{setBusy(false);}};
  return <section className="space-y-4"><p className="max-w-2xl text-sm text-muted-foreground">{tr('consentHelp')}</p><div className="grid max-w-2xl gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor={`${id}-search`}>{tr('consentSearch')}</Label><Input id={`${id}-search`} value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="space-y-2"><Label htmlFor={`${id}-evidence`}>{tr('consentEvidence')}</Label><Input id={`${id}-evidence`} maxLength={1000} value={evidence} onChange={e=>setEvidence(e.target.value)}/></div></div>{error&&<p role="alert" className="text-sm text-destructive">{tr('error')}</p>}{clients.map(client=><article key={client.id} className="space-y-3 rounded-xl border border-border/50 bg-card p-4"><h3 className="font-medium">{client.name}</h3>{(['email','sms'] as const).map(channel=>client.channels[channel].destination&&<div key={channel} className="flex flex-wrap items-center gap-3 text-sm"><span>{tr(channel)}</span><bdi>{client.channels[channel].destination}</bdi><span className="text-muted-foreground">{tr(client.channels[channel].granted?'consentActive':'consentMissing')}</span><Button variant="outline" disabled={busy||evidence.trim().length<3} onClick={()=>void save(client,channel)}>{tr(client.channels[channel].granted?'consentRevoked':'consentGranted')}</Button></div>)}</article>)}</section>;
}
