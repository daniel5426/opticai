import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Plus, Sparkles, Mail, MessageSquare, LayoutGrid, Rows3 } from 'lucide-react';
import { toast } from 'sonner';
import { SiteHeader } from '@/components/site-header';
import { TableListLayout, TableListPageContent } from '@/components/table-list-layout';
import { TableFiltersBar } from '@/components/table-filters-bar';
import { CampaignCardsGrid } from '@/components/campaigns/CampaignCardsGrid';
import { CampaignEditor, type CampaignCatalog, type CampaignDeliveries, type CampaignTestTarget } from '@/components/campaigns/campaign-editor';
import { TableRow, TableCell, TableHead } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useUser } from '@/contexts/UserContext';
import { usePrysmAgent } from '@/contexts/PrysmAgentContext';
import { useAgentDraft } from '@/lib/agent-page-context';
import { useAppLocale } from '@/localization/use-app-locale';
import { campaignApi, blankCampaign, money, type CampaignDraft, type Condition, type Quote, type Run } from '@/lib/campaigns';

type CampaignView = 'table' | 'cards';
function readCampaignView():CampaignView {
  try { return localStorage.getItem('campaigns.view')==='cards'?'cards':'table'; }
  catch { return 'table'; }
}
export default function CampaignsPage() {
  const { t, i18n } = useTranslation();
  const { direction } = useAppLocale();
  const locale = i18n.language.split('-')[0];
  const { currentClinic, currentUser } = useUser();
  const agent = usePrysmAgent();
  const navigate = useNavigate();
  const search = useSearch({strict:false}) as {campaign?:number};
  const [items,setItems] = useState<CampaignDraft[]>([]);
  const [draft,setDraft] = useState<CampaignDraft | null>(null);
  const [catalog,setCatalog] = useState<CampaignCatalog | null>(null);
  const runKey=useRef(crypto.randomUUID());
  const previousAgentRun=useRef<string | null>(null);
  const [quote,setQuote] = useState<Quote | null>(null);
  const [runs,setRuns] = useState<Run[]>([]);
  const [tab,setTab] = useState('audience');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState(false);
  const [dirty,setDirty] = useState(false);
  const [query,setQuery] = useState('');
  const [view,setView] = useState<CampaignView>(readCampaignView);
  const [confirm,setConfirm] = useState(false);
  const [retryRun,setRetryRun] = useState<string | null>(null);
  const [previewError,setPreviewError] = useState(false);
  const operation = useRef(false);
  const testRunKey = useRef({fingerprint:'',key:''});
  const editorSession = useRef(0);
  const loadedCampaign = useRef<number | undefined>(undefined);
  const [kind,setKind] = useState('once');
  const [start,setStart] = useState('');
  const [days,setDays] = useState(1);
  const [maxCost,setMaxCost] = useState('');
  const [zone,setZone] = useState('Asia/Jerusalem');
  const [runDetails,setRunDetails] = useState<CampaignDeliveries | null>(null);
  useAgentDraft('campaign',()=>draft);
  const tr = (key:string) => t(`campaign.${key}`);
  const canManage = (currentUser?.role_level || 1) >= 3;
  const refresh = useCallback(async () => {
    if (!currentClinic?.id) return;
    try { const data = await campaignApi<CampaignDraft[]>(`/campaigns/?clinic_id=${currentClinic.id}`); setItems(data); setError(false); }
    catch { setError(true); } finally { setLoading(false); }
  },[currentClinic?.id]);
  useEffect(() => { const run=agent?.runtime?.controller?.activeRunId||null;if(previousAgentRun.current&&!run)void refresh();previousAgentRun.current=run; },[agent?.runtime?.controller?.activeRunId,refresh]);
  useEffect(() => { editorSession.current++; loadedCampaign.current=undefined; setDraft(null); setQuote(null); setDirty(false); void refresh(); void campaignApi<CampaignCatalog>('/campaigns/catalog').then(setCatalog).catch(()=>setError(true)); },[refresh]);
  useEffect(() => { let active=true; if (!search.campaign) { editorSession.current++; loadedCampaign.current=undefined; setDraft(null); setQuote(null); setDirty(false); } if (search.campaign && loadedCampaign.current !== search.campaign) void campaignApi<CampaignDraft>(`/campaigns/${search.campaign}`).then(value=>{if(active&&value.clinic_id===currentClinic?.id){loadedCampaign.current=value.id;setDraft(value);setDirty(false);setQuote(null);setPreviewError(false);
      const schedule=value.schedule;setKind(typeof schedule?.kind==='string'?schedule.kind:'once');setStart(typeof schedule?.start==='string'?schedule.start:'');setZone(typeof schedule?.timezone==='string'?schedule.timezone:'Asia/Jerusalem');setDays(Number(schedule?.days)||1);setMaxCost(value.max_cost==null?'':String(value.max_cost/1_000_000));
    }}).catch(()=>{if(active)setError(true);});return()=>{active=false;}; },[search.campaign,currentClinic?.id]);
  useEffect(() => {
    if (!draft?.id) return;
    let active = true;
    const update = () => void campaignApi<Run[]>(`/campaigns/${draft.id}/runs`).then(v=>{if(active)setRuns(v);}).catch(()=>{});
    update(); const timer = window.setInterval(update,5000);
    return ()=>{active=false;window.clearInterval(timer);};
  },[draft?.id]);
  const act = async (fn:()=>Promise<void>) => {
    if (operation.current) return false;
    operation.current=true;setBusy(true);
    try { await fn();return true; }
    catch(e) { const code=e instanceof Error?e.message:'';toast.error(i18n.exists(`campaign.${code}`)?tr(code):tr('error'));return false; }
    finally { operation.current=false;setBusy(false); }
  };
  const change = (value:Partial<CampaignDraft>) => {setDraft(old=>old?{...old,...value}:old);setQuote(null);setPreviewError(false);setDirty(true);};
  const conditions:Condition[] = (()=>{try{return JSON.parse(draft?.filters || '[]');}catch{return [];}})();
  const setConditions = (values:Condition[]) => change({filters:JSON.stringify(values)});
  const persistDraft = async () => {
    if (!draft) throw new Error('error');
    if (!dirty && draft.id) return draft;
    const session=editorSession.current;
    const value=await campaignApi<CampaignDraft>(draft.id?`/campaigns/${draft.id}`:'/campaigns/',draft,draft.id?'PUT':'POST');
    if(session===editorSession.current){loadedCampaign.current=value.id;setDraft(value);setDirty(false);setQuote(null);if(!draft.id)await navigate({to:'/campaigns',search:{campaign:value.id}});}
    return value;
  };
  const save = () => act(async()=>{await persistDraft();toast.success(tr('saved'));await refresh();});
  const preview = (retry: string | null = retryRun) => {
    const session=editorSession.current;
    setPreviewError(false);setQuote(null);
    return act(async()=>{
      try {
        const saved=await persistDraft();
        if(session!==editorSession.current)return;
        const value=await campaignApi<Quote>(`/campaigns/${saved.id}/preview`,{retry_run:retry});
        if(session!==editorSession.current)return;
        setQuote(value);runKey.current=crypto.randomUUID();setMaxCost(current=>current||String(value.total_cost/1_000_000));
      } catch(error) {if(session===editorSession.current)setPreviewError(true);throw error;}
    });
  };
  const changeTab = (value:string) => {setTab(value);if(value==='review'&&!quote&&!operation.current)void preview();};
  const select = (value:CampaignDraft) => {
    editorSession.current++;loadedCampaign.current=undefined;setRetryRun(null);setDraft(value);setQuote(null);setPreviewError(false);setDirty(false);setTab('audience');setRunDetails(null);setRuns([]);
    const schedule=value.schedule;
    setKind(typeof schedule?.kind==='string'?schedule.kind:'once');setStart(typeof schedule?.start==='string'?schedule.start:'');
    setZone(typeof schedule?.timezone==='string'?schedule.timezone:'Asia/Jerusalem');setDays(Number(schedule?.days)||1);setMaxCost(value.max_cost==null?'':String(value.max_cost/1_000_000));
    void navigate({to:'/campaigns',search:{campaign:value.id}});
  };
  const send = () => act(async()=>{if(!draft?.id||!quote||dirty||quote.errors.length)return;await campaignApi(`/campaigns/${draft.id}/runs`,{quote:quote.quote,request_key:runKey.current,retry_run:retryRun});setQuote(null);setRetryRun(null);setConfirm(false);setTab('results');toast.success(tr('queuedNotice'));});
  const testPreview = useCallback(async(target:CampaignTestTarget) => {
    if(!draft?.id||dirty)throw new Error('quote_stale');
    return campaignApi<Quote>(`/campaigns/${draft.id}/preview`,{tests:[target]});
  },[draft?.id,dirty]);
  const testSend = async(target:CampaignTestTarget,testQuote:Quote) => {
    if(!draft?.id||dirty||!canManage||testQuote.errors.length||!Object.values(target).some(Boolean))return false;
    const fingerprint=JSON.stringify([draft.id,draft.revision,target]);
    if(testRunKey.current.fingerprint!==fingerprint)testRunKey.current={fingerprint,key:crypto.randomUUID()};
    const sent=await act(async()=>{await campaignApi(`/campaigns/${draft.id}/runs`,{quote:testQuote.quote,request_key:testRunKey.current.key,tests:[target]});toast.success(tr('queuedNotice'));});
    if(sent)testRunKey.current={fingerprint:'',key:''};
    return sent;
  };
  const activate = () => void act(async()=>{
    if(!draft||!canManage)return;
    const session=editorSession.current;
    const saved=await persistDraft();
    if(session!==editorSession.current)return;
    const approval=await campaignApi<Quote>(`/campaigns/${saved.id}/preview`,{});
    if(session!==editorSession.current)return;
    if(approval.errors.length)throw new Error(approval.errors[0]);
    const value=await campaignApi<CampaignDraft>(`/campaigns/${saved.id}/schedule`,{revision:saved.revision,quote:approval.quote,schedule:{kind,start,timezone:zone,days},max_cost:Math.round(Number(maxCost)*1_000_000)});
    if(session===editorSession.current){setDraft(value);setQuote(null);await refresh();}
  });
  const pause = () => void act(async()=>{if(!draft?.id)return;const value=await campaignApi<CampaignDraft>(`/campaigns/${draft.id}/pause`,{});setDraft(value);setQuote(null);await refresh();});
  const archive = () => void act(async()=>{if(!draft?.id)return;await campaignApi(`/campaigns/${draft.id}`,undefined,'DELETE');setDraft(null);await refresh();});
  const closeDraft = () => {editorSession.current++;loadedCampaign.current=undefined;setDraft(null);setDirty(false);void navigate({to:'/campaigns',search:{}});};
  const createWithAi = () => {agent?.openCampaignDraft(tr('prompt'));};
  const visibleItems=items.filter(c=>c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const listToolbar={compact:true,searchValue:query,onSearchChange:setQuery,searchPlaceholder:tr('search'),actions:<><Button variant="outline" onClick={createWithAi} disabled={!agent?.available||agent.pending||Boolean(agent.runtime?.controller?.activeRunId)||!canManage}>{tr('ai')}<Sparkles className="size-4"/></Button><Button disabled={!canManage} onClick={()=>{editorSession.current++;setKind('once');setStart('');setDays(1);setZone('Asia/Jerusalem');setMaxCost('');setRetryRun(null);setPreviewError(false);setDraft(blankCampaign(locale,currentClinic?.id));setDirty(true);setQuote(null);setRuns([]);setTab('audience');}}>{tr('new')}<Plus className="size-4"/></Button></>,inlineControls:
    <ToggleGroup type="single" variant="outline" dir={direction} value={view} aria-label={tr('view')} onValueChange={value=>{
      if(value!=='table'&&value!=='cards')return;
      setView(value);
      try {localStorage.setItem('campaigns.view',value);} catch { /* Keep the session choice when storage is unavailable. */ }
    }}>
      <ToggleGroupItem value="table" title={tr('tableView')} aria-label={tr('tableView')}><Rows3 className="size-4" aria-hidden="true"/></ToggleGroupItem>
      <ToggleGroupItem value="cards" title={tr('cardView')} aria-label={tr('cardView')}><LayoutGrid className="size-4" aria-hidden="true"/></ToggleGroupItem>
    </ToggleGroup>};
  return <><SiteHeader title={draft?.name || tr('title')} parentTitle={draft ? tr('title') : undefined} parentLink={draft ? "/campaigns" : undefined} hasUnsavedChanges={!!draft && dirty}/><TableListPageContent>
    {error&&<p role="alert" className="mb-3 text-destructive">{tr('error')} <Button variant="ghost" onClick={()=>void refresh()}>{tr('refresh')}</Button></p>}
    {!draft?<div className="flex min-h-0 flex-1 flex-col gap-2.5">
      {view==='cards'?<><TableFiltersBar {...listToolbar}/><CampaignCardsGrid items={visibleItems} loading={loading} emptyMessage={tr(items.length?'noMatches':'empty')} onOpen={select}/></>:<TableListLayout loading={loading} columnCount={4} toolbar={listToolbar}
        header={<TableRow>{['name','status','next_run','actions'].map(k=><TableHead key={k}>{tr(k)}</TableHead>)}</TableRow>} emptyState={!loading&&!visibleItems.length?tr(items.length?'noMatches':'empty'):undefined}>
        {visibleItems.map(c=><TableRow key={c.id}><TableCell><button className="text-start font-medium" onClick={()=>select(c)}>{c.name}</button><div className="mt-1 flex gap-2 text-muted-foreground">{c.email_enabled&&<Mail className="size-3"/>}{c.sms_enabled&&<MessageSquare className="size-3"/>}</div></TableCell><TableCell><Badge variant="secondary">{tr(c.status||'needs_review')}</Badge></TableCell><TableCell dir="ltr">{c.next_run?new Date(c.next_run).toLocaleString(locale):'—'}</TableCell><TableCell><Button variant="ghost" onClick={()=>select(c)}>{tr('open')}</Button></TableCell></TableRow>)}
      </TableListLayout>}
    </div>:<CampaignEditor
      draft={draft} catalog={catalog} tab={tab} busy={busy} dirty={dirty} canManage={canManage}
      quote={quote} previewError={previewError} runs={runs} deliveries={runDetails} conditions={conditions}
      kind={kind} start={start} days={days} maxCost={maxCost} zone={zone}
      onTabChange={changeTab} onChange={change} onConditions={setConditions} onBack={closeDraft} onSave={save} onPreview={()=>void preview()}
      onRequestSend={()=>setConfirm(true)} onActivate={activate} onKindChange={setKind} onStartChange={setStart} onDaysChange={setDays}
      onMaxCostChange={setMaxCost} onZoneChange={setZone}
      onTestPreview={testPreview} onTestSend={testSend}
      onPause={pause} onArchive={archive}
      onRetry={(runId)=>{setRetryRun(runId);setQuote(null);setTab('review');void preview(runId);}}
      onCancelRun={(runId)=>void act(async()=>{if(!draft.id)return;await campaignApi(`/campaigns/${draft.id}/runs/${runId}/cancel`,{});})}
      onOpenDeliveries={(runId)=>void act(async()=>{if(!draft.id)return;setRunDetails(await campaignApi(`/campaigns/${draft.id}/runs/${runId}/deliveries`));})}
    />}
    <Dialog open={confirm} onOpenChange={setConfirm}><DialogContent dir={direction}><DialogHeader><DialogTitle>{tr('confirm')}</DialogTitle><DialogDescription>{tr('confirmText')}</DialogDescription></DialogHeader><p>{tr('email')}: {quote?.emails} · {tr('sms')}: {quote?.sms} · {money(quote?.total_cost||0,locale)}</p><DialogFooter><Button variant="outline" onClick={()=>setConfirm(false)}>{tr('cancel')}</Button><Button disabled={busy} onClick={send}>{tr('send')}</Button></DialogFooter></DialogContent></Dialog>
  </TableListPageContent></>;
}
