import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Loader2, ScanBarcode, Smartphone, X } from 'lucide-react';
import QRCode from 'qrcode';
import { useUser } from '@/contexts/UserContext';
import { useAppLocale } from '@/localization/use-app-locale';
import { apiClient } from '@/lib/api-client';
import { readScannerEvents, replayScan, setScanChoice, setScanDispatcher, useScanTargetsVersion, visibleScanTargets, type ScanCommand, type ScannerDevice } from '@/lib/scanner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScannerItemDialog } from './ScannerItemDialog';
import type { CatalogVariant } from '@/lib/inventory';
import { SidebarMenuAction } from '@/components/ui/sidebar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

type ScanHistoryState = {
  enabled:boolean; loading:boolean; error:string; items:ScanCommand[]; more:boolean;
  load:(offset?:number)=>Promise<void>; clearError:()=>void; connect:()=>void;
  replay:(variantId:number,onReady:()=>void)=>Promise<void>;
};
const ScanHistoryContext=createContext<ScanHistoryState|null>(null);

export function ScannerHistoryButton() {
  const { t } = useTranslation(); const {direction,locale}=useAppLocale();
  const history=useContext(ScanHistoryContext); const handingOff=useRef(false);
  const [open,setOpen]=useState(false);
  const [loadingItem,setLoadingItem]=useState<string|null>(null);
  const replayRequest=useRef(0); const replayPending=useRef(false);
  useEffect(()=>{if(open&&history?.enabled)void history.load();},[open,history?.enabled,history?.load]);
  if(!history)return null;
  const selectItem = (item:ScanCommand) => {
    if (!item.variant_id || replayPending.current) return;
    const request=++replayRequest.current;
    replayPending.current=true;setLoadingItem(item.id);history.clearError();
    const finish=()=>{if(replayRequest.current===request){replayPending.current=false;setLoadingItem(null);}};
    void history.replay(item.variant_id,()=>{
      if(replayRequest.current!==request)return;
      handingOff.current=true;finish();setOpen(false);
    }).catch(()=>{/* The provider keeps the translated error in the open menu. */}).finally(finish);
  };
  return <DropdownMenu dir={direction} open={open} onOpenChange={value=>{setOpen(value);if(value)history.clearError();}}>
    <DropdownMenuTrigger asChild><SidebarMenuAction className="end-9 group-data-[collapsible=icon]:relative group-data-[collapsible=icon]:end-auto group-data-[collapsible=icon]:top-auto group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:my-1 group-data-[collapsible=icon]:flex group-data-[collapsible=icon]:size-8" aria-label={t('scanner.history')} title={t('scanner.history')}><ScanBarcode /></SidebarMenuAction></DropdownMenuTrigger>
    <DropdownMenuContent side={direction==='rtl'?'left':'right'} align="start" sideOffset={8} className="w-80 max-w-[calc(100vw-1rem)]" aria-label={t('scanner.history')} onCloseAutoFocus={event=>{if(handingOff.current){event.preventDefault();handingOff.current=false;}}}>
      <DropdownMenuLabel>{t('scanner.history')}</DropdownMenuLabel>
      <DropdownMenuItem disabled={!history.enabled||!!loadingItem} onSelect={()=>{handingOff.current=true;history.connect();}}>{t('scanner.connect')}<Smartphone className="ms-auto size-4"/></DropdownMenuItem>
      <DropdownMenuSeparator/>
      {!history.enabled?<DropdownMenuItem disabled>{t('scanner.disabled')}</DropdownMenuItem>:history.loading&&!history.items.length?<DropdownMenuItem disabled>{t('loading')}</DropdownMenuItem>:!history.error&&!history.items.length?<DropdownMenuItem disabled>{t('scanner.empty')}</DropdownMenuItem>:null}
      {history.error&&<p role="alert" className="px-2 py-2 text-sm text-destructive">{t(history.error,{defaultValue:t('scanner.unavailable')})}</p>}
      {history.items.map(item=><DropdownMenuItem key={item.id} disabled={!item.variant_id||!!loadingItem} aria-busy={loadingItem===item.id} className="items-start py-2" onSelect={event=>{event.preventDefault();selectItem(item);}}>
        <div className="min-w-0 flex-1 text-start"><span className="block truncate font-medium">{item.summary.name}</span><span className="block text-xs text-muted-foreground">{t(`scanner.category.${item.summary.category}`,{defaultValue:''})}</span><span className="block text-xs text-muted-foreground"><bdi>{item.barcode}</bdi> · {new Date(item.created_at*1000).toLocaleString(locale)}</span></div>
        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center">{loadingItem===item.id&&<Loader2 role="status" aria-label={t('loading')} className="size-4 animate-spin motion-reduce:animate-none"/>}</span>
      </DropdownMenuItem>)}
      {history.more&&<DropdownMenuItem disabled={history.loading||!!loadingItem} onSelect={event=>{event.preventDefault();void history.load(history.items.length);}}>{history.loading?t('loading'):t('scanner.more')}</DropdownMenuItem>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
export function ScannerProvider({ children }: { children: React.ReactNode }) {
  const { currentClinic, currentUser } = useUser();
  const { t } = useTranslation(); const { direction } = useAppLocale();
  const location = useLocation(); const navigate = useNavigate(); const targetVersion = useScanTargetsVersion();
  const [device, setDevice] = useState<ScannerDevice | null>(null);
  const [enabled, setEnabled] = useState(false); const [error, setError] = useState('');
  const [connect, setConnect] = useState(false);
  const [history, setHistory] = useState<ScanCommand[]>([]); const [more, setMore] = useState(false);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [name, setName] = useState(''); const [code, setCode] = useState(''); const [qr, setQr] = useState('');
  const [infoVariant, setInfoVariant] = useState<CatalogVariant | null>(null);
  const [info, setInfo] = useState<ScanCommand | null>(null);
  const [choice, setChoice] = useState<{title: string; choices: {label: string; value: string}[]; resolve: (value: string | null) => void} | null>(null);
  const activeAck = useRef<((status:string)=>Promise<void>) | null>(null);
  const choiceRef = useRef(choice); choiceRef.current = choice;
  const readerSignals = useRef(new Map<string, AbortSignal>());
  const submissions = useRef(new Map<string, Promise<ScanCommand | null>>());
  const readyHandlers = useRef(new Map<string, () => void>());
  const receiverSync = useRef<{key:string; promise:Promise<unknown>; confirmedAt:number} | null>(null);
  const inFlight = useRef(new Map<string, {done:Promise<void>; resolve:()=>void}>());
  const editTarget = useRef<(() => void) | undefined>(undefined);
  const editRequested = useRef(false);
  const infoDone = useRef<(() => void) | null>(null);
  const lease = useRef(crypto.randomUUID()); const context = useRef(crypto.randomUUID());
  const destination = useRef('details'); const processed = useRef(new Map<string, string>());
  const handleRef = useRef<(scan: ScanCommand) => Promise<void>>(async () => {});
  const currentDevice = useRef(device); currentDevice.current = device;
  const clinicId = currentClinic?.id;
  const activeClinic=useRef(clinicId);activeClinic.current=clinicId;
  const api = useCallback(async <T,>(path: string, options?: RequestInit): Promise<T> => {
    const response = await apiClient.scannerRequest<T>(path, options);
    if (response.error || !response.data) throw new Error(String(response.error || 'scanner.offline'));
    return response.data;
  }, []);
  const syncReceiver = useCallback((d: ScannerDevice, force = false, takeover = false) => {
    const binding = {secret:d.secret,lease:lease.current,context:context.current,destination:destination.current,active:!document.hidden,takeover};
    const key = JSON.stringify([d.id, currentUser?.id, clinicId, binding.lease, binding.context, binding.destination, binding.active]);
    const prior = receiverSync.current;
    // Share an in-flight registration and reuse a recent heartbeat. The server
    // still checks the lease, context, live session and clinic on every scan.
    if (!takeover && prior?.key === key && (!prior.confirmedAt || (!force && Date.now()-prior.confirmedAt < 10000))) return prior.promise;
    const entry = {key,promise:Promise.resolve() as Promise<unknown>,confirmedAt:0};
    entry.promise = api(`/devices/${d.id}/receiver`, {method:'PUT',body:JSON.stringify(binding)}).then(value=>{
      entry.confirmedAt=Date.now(); return value;
    }).catch(error=>{if(receiverSync.current===entry)receiverSync.current=null;throw error;});
    receiverSync.current=entry;
    return entry.promise;
  }, [api,clinicId,currentUser?.id]);
  const loadHistory = useCallback(async (offset = 0) => {
    if (!clinicId) return;
    setHistoryLoading(true);
    try { const value = await api<{items: ScanCommand[]; has_more: boolean}>(`/history?clinic_id=${clinicId}&offset=${offset}`); if(activeClinic.current!==clinicId)return;setHistory(old => offset ? [...old, ...value.items] : value.items); setMore(value.has_more); }
    catch (e) { if(activeClinic.current===clinicId)setError((e as Error).message); }
    finally {if(activeClinic.current===clinicId)setHistoryLoading(false);}
  },[clinicId,api]);
  const ask = useCallback((title: string, choices: {label: string; value: string}[]) => new Promise<string | null>(resolve => {void activeAck.current?.('awaiting_confirmation').catch(()=>{});setChoice({ title, choices, resolve });}), []);
  useEffect(() => { setScanChoice(ask); return () => { setScanChoice(undefined); choiceRef.current?.resolve(null); infoDone.current?.(); }; }, [ask]);
  useEffect(() => {
    // Retain the settings page's existing connect-phone action.
    const show = () => { setError(''); setConnect(true); }; window.addEventListener('prysm:scan-history', show);
    return () => window.removeEventListener('prysm:scan-history', show);
  }, []);
  useEffect(() => {
    let alive = true; setEnabled(false); setDevice(null); setHistory([]);setMore(false);setHistoryLoading(false);
    if (!clinicId || !currentUser?.id) return;
    void api<{enabled: boolean}>('/status').then(value => { if (alive) setEnabled(value.enabled); }).catch(() => {});
    try { const saved = JSON.parse(localStorage.getItem(`prysm:scanner:${clinicId}`) || 'null'); if (saved) setDevice(saved); } catch { /* storage unavailable */ }
    return () => { alive = false; };
  }, [clinicId, currentUser?.id, api]);
  useEffect(() => {
    context.current = crypto.randomUUID();
    const active = visibleScanTargets().filter(target=>target.canApply); destination.current = active.some(x => x.kind === 'count') ? 'count' : active[0]?.kind || 'details';
    choiceRef.current?.resolve(null); setChoice(null); setInfo(null); infoDone.current?.(); infoDone.current = null;
  }, [location.pathname, location.searchStr, targetVersion, currentUser?.id, clinicId]);
  useEffect(() => {
    if (!enabled || !device?.secret || !clinicId || !currentUser?.id) return;
    const controller = new AbortController(); let timer: ReturnType<typeof setTimeout>; let cursor = ''; let chain = Promise.resolve();
    const heartbeat = () => syncReceiver(device, true);
    const run = async () => {
      while (!controller.signal.aborted) {
        try {
          await heartbeat();
          const response = await apiClient.scannerFetch(`/devices/${device.id}/events?lease=${lease.current}`, { signal: controller.signal, headers: cursor ? { 'Last-Event-ID': cursor } : {} });
          await readScannerEvents(response, controller.signal, (event, value, id) => {
            if (id) cursor = id;
            if (event === 'unavailable') throw new Error('scanner.offline');
            if (value.type === 'scan') chain = chain.then(() => handleRef.current(value.scan)).catch(() => {});
          });
        } catch (e) { if (!controller.signal.aborted) setError((e as Error).message); }
        if (!controller.signal.aborted) await new Promise<void>(resolve => { timer = setTimeout(resolve, 2000); controller.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true }); });
      }
    };
    void run();
    const pulse = setInterval(() => { void heartbeat().catch(e => setError(e.message)); }, 10000);
    const visibility = () => { void syncReceiver(device).catch(() => {}); };
    document.addEventListener('visibilitychange', visibility);
    return () => { controller.abort(); clearInterval(pulse); clearTimeout(timer); document.removeEventListener('visibilitychange', visibility); receiverSync.current=null; void api(`/devices/${device.id}/receiver`, { method: 'PUT', body: JSON.stringify({ secret: device.secret, lease: lease.current, context: context.current, active: false }) }).catch(() => {}); };
  }, [enabled, device?.id, clinicId, currentUser?.id, api, syncReceiver]);
  useEffect(() => {
    if (!enabled || !device?.secret || !currentUser?.id) return;
    void syncReceiver(device).catch(()=>{});
  }, [location.pathname, location.searchStr, targetVersion, enabled, device?.id, currentUser?.id, syncReceiver]);
  handleRef.current = async scan => {
    if (scan.device_id !== currentDevice.current?.id || scan.clinic_id !== clinicId || scan.lease !== lease.current || scan.context !== context.current || scan.created_at < Date.now()/1000-120 || scan.status !== 'pending') return;
    const isCurrent = () => scan.context === context.current && scan.clinic_id === clinicId && scan.created_at > Date.now()/1000-120 && !readerSignals.current.get(scan.request_id || '')?.aborted;
    let pendingAck: Promise<unknown> = Promise.resolve();
    const ack = (status: string): Promise<void> => {
      const next = pendingAck.catch(()=>{}).then(()=>api(`/scans/${scan.id}`, { method: 'PATCH', body: JSON.stringify({status}) }));
      pendingAck=next;
      return next.then(()=>{});
    };
    if (inFlight.current.has(scan.id)) return inFlight.current.get(scan.id)!.done;
    const prior = processed.current.get(scan.id); if (prior) { await ack(prior); return; }
    let finish!: () => void;
    const done = new Promise<void>(resolve=>{finish=resolve;});
    inFlight.current.set(scan.id,{done,resolve:finish}); activeAck.current = ack;
    let status = 'displayed'; let reapply = false;
    try {
      // An SSE echo can arrive before its POST response. Share that response so
      // the same scan neither applies twice nor starts a second product lookup.
      let submitted: ScanCommand | null | undefined;
      const submission = submissions.current.get(scan.request_id || '');
      if (submission) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // A stalled POST must not hold up an already-delivered durable event.
          submitted = await Promise.race([submission, new Promise<null>(resolve => { timer=setTimeout(()=>resolve(null),500); })]);
        } finally { clearTimeout(timer); }
      }
      if (submitted?.id === scan.id) scan = submitted;
      // Counting reuses the catalog snapshot already loaded into its draft.
      const counts=visibleScanTargets().filter(target=>target.kind==='count'&&target.canApply);
      const loaded=scan.variant_id&&!scan.summary.archived&&counts.length===1?counts[0].resolveCountVariant?.(scan.variant_id):undefined;
      const variant = scan.variant !== undefined ? scan.variant : loaded || (scan.variant_id
        ? (await api<{items: any[]}>(`/variants/${scan.variant_id}?clinic_id=${clinicId}`)).items[0] : null);
      if (!isCurrent()) throw new Error('scanner.expired');
      let targets = visibleScanTargets().filter(x => !x.category || x.category === variant?.product.category);
      const blockingDialogs = Array.from(document.querySelectorAll('[role="dialog"][data-state="open"]')).filter(el=>!el.querySelector('#scanner-code'));
      if (document.hidden || (blockingDialogs.length && !targets.some(target=>blockingDialogs.some(el=>el.contains(target.element.current))))) throw new Error('scanner.busy');
      const onReady=readyHandlers.current.get(scan.request_id || '');
      readyHandlers.current.delete(scan.request_id || '');
      onReady?.();
      if (targets.some(x => x.kind === 'count')) targets = targets.filter(x => x.kind === 'count');
      if (targets.length > 1) {
        const selected = await ask(t('scanner.choose'), targets.map(x => ({label: x.label, value: x.id})));
        targets = targets.filter(x => x.id === selected);
      }
      const target = targets[0];
      if (variant && !variant.archived_at && !variant.product.archived_at && target?.canApply && !(target.kind === 'order' && ['frame','spectacle_lens'].includes(variant.product.category) && !variant.is_stockable)) {
        let accepted = true;
        if (target.hasValue && target.variantId !== variant.id) {
          accepted = await ask(t('scanner.replace'), [{ label: t('scanner.confirm'), value: 'yes' }]) === 'yes';
        }
        if (accepted && isCurrent() && visibleScanTargets().some(x => x.id === target.id && x.canApply)) {
          if (target.variantId !== variant.id || target.kind === 'count') await target.apply(variant, {...scan,isCurrent});
          status = 'applied';
        } else status = 'rejected';
      } else {
        void ack('awaiting_confirmation').catch(()=>{});
        await new Promise<void>(resolve => { infoDone.current = resolve; editTarget.current = !variant?.archived_at && !variant?.product.archived_at ? target?.edit : undefined; setInfoVariant(variant); setInfo({...scan, summary:{...scan.summary, name:variant?.display_name || scan.summary.name, archived:!!(variant?.archived_at || variant?.product.archived_at)}}); });
        if (editRequested.current) {
          editRequested.current = false;
          reapply = true;
        }
      }
    } catch (e) { setError((e as Error).message); status = 'rejected'; }
    if (scan.context !== context.current) status = 'expired';
    processed.current.set(scan.id, status);
    if (processed.current.size > 500) processed.current.delete(processed.current.keys().next().value!);
    await ack(status).catch(() => {}); inFlight.current.get(scan.id)?.resolve(); inFlight.current.delete(scan.id); activeAck.current=null;
    if (reapply && scan.variant_id) { await new Promise(resolve=>setTimeout(resolve,150)); void replayScan(scan.variant_id).catch(e=>setError(e.message)); }
  };
  useEffect(() => {
    if (!enabled || !clinicId || !currentUser?.id) { setScanDispatcher(undefined); return; }
    setScanDispatcher(async ({signal, onReady, ...input}) => {
      const requestId = crypto.randomUUID();
      if (signal) readerSignals.current.set(requestId, signal);
      if (onReady) readyHandlers.current.set(requestId,onReady);
      const dispatchContext = context.current;
      let complete!: (scan: ScanCommand | null) => void;
      submissions.current.set(requestId,new Promise(resolve=>{complete=resolve;}));
      try {
        let d = currentDevice.current;
        if (!d) {
          d = await api<ScannerDevice>('/devices', json({clinic_id: clinicId, name: currentClinic?.name || t('scanner.name')}));
          localStorage.setItem(`prysm:scanner:${clinicId}`, JSON.stringify(d)); currentDevice.current = d; setDevice(d);
        }
        await syncReceiver(d);
        if (signal?.aborted || dispatchContext !== context.current) return;
        const scan = await api<ScanCommand>(`/devices/${d.id}/scans`, { ...json({ ...input, request_id: requestId, lease: lease.current, context: context.current }), headers: { 'X-Scanner-Device': d.secret! } });
        complete(scan);
        await handleRef.current(scan);
      } finally { complete(null); submissions.current.delete(requestId); readerSignals.current.delete(requestId); readyHandlers.current.delete(requestId); }
    });
    return () => setScanDispatcher(undefined);
  }, [enabled, device?.id, clinicId, currentUser?.id, api, syncReceiver]);
  const pair = async () => {
    try {
      let d = device;
      if (!d) {
        d = await api<ScannerDevice>('/devices', json({clinic_id: clinicId, name: name.trim()}));
        localStorage.setItem(`prysm:scanner:${clinicId}`, JSON.stringify(d)); setDevice(d);
      }
      const value = await api<{code: string}>(`/devices/${d.id}/pairing`, json({secret:d.secret})); setCode(value.code);
      if (window.location.protocol === 'file:' && !import.meta.env.VITE_SCANNER_URL && !/^https:\/\/api\.prysm\.co\.il(?:\/|$)/.test(import.meta.env.VITE_API_URL || '')) throw new Error('scanner.urlRequired');
      const base = import.meta.env.VITE_SCANNER_URL || (window.location.protocol === 'file:' ? 'https://app.prysm.co.il/scanner/' : `${window.location.origin}/scanner/`);
      setQr(await QRCode.toDataURL(`${base}#pair=${value.code}`, { width: 240, margin: 1 }));
    } catch (e) { setError((e as Error).message); }
  };
  const dismissInfo = () => { setInfo(null); infoDone.current?.(); infoDone.current = null; };
  return <ScanHistoryContext.Provider value={{enabled,loading:historyLoading,error,items:history,more,load:loadHistory,clearError:()=>setError(''),connect:()=>setConnect(true),replay:async(variantId,onReady)=>{try{await replayScan(variantId,onReady);}catch(e){setError((e as Error).message);throw e;}}}}>{children}
    <Dialog open={connect} onOpenChange={setConnect}><DialogContent dir={direction} className="sm:max-w-md"><DialogHeader><DialogTitle>{t('scanner.connect')}</DialogTitle><DialogDescription>{currentClinic?.name}</DialogDescription></DialogHeader>
      {!enabled && <p role="status">{t('scanner.disabled')}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{t(error, {defaultValue: t('scanner.unavailable')})}</p>}
      {enabled && <div className="space-y-3 rounded-xl border border-border/50 p-3">
        {!device && <><Label htmlFor="scanner-device-name">{t('scanner.name')}</Label><Input id="scanner-device-name" value={name} onChange={e=>setName(e.target.value)} maxLength={80} /></>}
        {device && <p>{device.name}</p>}
        <Button onClick={() => void pair()} disabled={!device && !name.trim()}>{t('scanner.pair')}</Button>
        {device && <><Button variant="outline" onClick={() => void api(`/devices/${device.id}/receiver`, {method:'PUT', body:JSON.stringify({secret:device.secret, lease:lease.current, context:context.current, destination:destination.current, takeover:true})}).then(()=>setError('')).catch(e=>setError(e.message))}>{t('scanner.takeover')}</Button>
        <Button variant="outline" onClick={() => void api(`/devices/${device.id}/grants`, {method:'DELETE',body:JSON.stringify({secret:device.secret})}).catch(e=>setError(e.message))}>{t('scanner.revoke')}</Button></>}
        {qr && <div className="text-center"><img src={qr} alt={t('scanner.pair')} className="mx-auto size-48"/><strong dir="ltr" className="block select-all text-xl tracking-widest">{code}</strong><p className="mt-2 text-sm text-muted-foreground">{t('scanner.pairHint')}</p></div>}
      </div>}
    </DialogContent></Dialog>
    <Dialog open={!!choice} onOpenChange={value => { if (!value) { choice?.resolve(null); setChoice(null); } }}><DialogContent dir={direction}><DialogHeader><DialogTitle>{choice?.title}</DialogTitle></DialogHeader><div className="flex flex-wrap gap-2">{choice?.choices.map(option => <Button key={option.value} onClick={()=>{ choice.resolve(option.value); setChoice(null); }}>{option.label}</Button>)}<Button variant="outline" onClick={()=>{choice?.resolve(null);setChoice(null);}}>{t('scanner.cancel')}</Button></div></DialogContent></Dialog>
    <ScannerItemDialog scan={info} variant={infoVariant} onClose={dismissInfo}
      onOpenInventory={()=>{dismissInfo();navigate({to:'/inventory'});}}
      onEdit={editTarget.current ? ()=>{editRequested.current=true;editTarget.current?.();dismissInfo();} : undefined}/>
  </ScanHistoryContext.Provider>;
}
