import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MotionConfig } from 'motion/react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { ScannerScreen } from './ScannerScreen';
import translations from '@/localization/scanner.json';
import { readScannerEvents, type ScanCommand, type ScannerDevice } from '@/lib/scanner';
import { phoneToken } from './storage';
import { cameraScanOptions, ScanLatch, scanPending, resolveScanResponse } from './scan-feedback';
import './scanner.css';

const base = (import.meta.env.VITE_API_URL || 'https://api.prysm.co.il/api/v1').replace(/\/$/,'');
type Language = keyof typeof translations;
export function ScannerApp() {
  const [language] = useState<Language>(() => {const saved=localStorage.getItem('scanner-language');return saved==='en'||saved==='fr'?saved:'he';});
  const t = (key: string) => (translations[language] as Record<string,string>)[key.startsWith('scanner.') ? key : `scanner.${key}`] || (translations.en as Record<string,string>)[`scanner.${key}`] || (translations[language] as Record<string,string>)['scanner.unavailable'];
  const [token, setToken] = useState<string>(); const [devices, setDevices] = useState<ScannerDevice[]>([]);
  const [selected, setSelected] = useState(localStorage.getItem('scanner-device') || '');
  const [drawerOpen,setDrawerOpen] = useState(false);
  const drawerVisible=useRef(drawerOpen);drawerVisible.current=drawerOpen;
  const [active, setActive] = useState(false);
  const [error, setError] = useState(''); const [last, setLast] = useState<ScanCommand>(); const [pending, setPending] = useState(false);
  const [torch, setTorch] = useState(false); const [torchAvailable, setTorchAvailable] = useState(false);
  const video = useRef<HTMLVideoElement>(null); const controls = useRef<IScannerControls | undefined>(undefined);
  const current = useRef({active, pending, selected, devices, token, last}); current.current = {active,pending,selected,devices,token,last};
  const detection = useRef(new ScanLatch()); const earlyResults = useRef(new Map<string, ScanCommand>()); const scanId = useRef(''); const startRecipient = useRef('');
  const stop = () => { current.current.active = false; setActive(false); controls.current?.stop(); controls.current = undefined; const stream = video.current?.srcObject as MediaStream | null; stream?.getTracks().forEach(track=>track.stop()); setTorchAvailable(false); setTorch(false); };
  async function api<T>(path: string, body?: unknown, credential = current.current.token): Promise<T> {
    const response = await fetch(`${base}/scanner${path}`, { method:body===undefined?'GET':'POST', headers:{...(credential?{Authorization:`Bearer ${credential}`} : {}),'Content-Type':'application/json'}, ...(body===undefined?{}:{body:JSON.stringify(body)}), cache:'no-store' });
    if (!response.ok) { const value = await response.json().catch(()=>({})); throw new Error(typeof value.detail==='string'?value.detail:'scanner.offline'); }
    return response.json();
  }
  const refresh = async () => { try { const rows = await api<ScannerDevice[]>('/phone/devices'); setDevices(rows); if (!rows.some(d=>d.id===selected)) setSelected(rows[0]?.id || ''); } catch(e) { setError((e as Error).message); } };
  useEffect(()=> { document.documentElement.lang = language; document.documentElement.dir=language==='he'?'rtl':'ltr'; localStorage.setItem('scanner-language',language); },[language]);
  useEffect(()=> { void phoneToken().then(setToken).catch(()=>setError('scanner.pairAgain')); if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/scanner/sw.js',{scope:'/scanner/'}); return stop; },[]);
  useEffect(()=> { if(token) void refresh(); },[token]);
  useEffect(()=> { localStorage.setItem('scanner-device',selected); },[selected]);
  useEffect(()=> { const onHidden=()=>{if(document.hidden)stop();}; const offline=()=>{stop();setError('scanner.offline');}; document.addEventListener('visibilitychange',onHidden); window.addEventListener('offline',offline);return()=>{document.removeEventListener('visibilitychange',onHidden);window.removeEventListener('offline',offline);}; },[]);
  useEffect(()=> {
    if(!token || !selected)return;
    const controller=new AbortController(); let cursor=''; let timer: ReturnType<typeof setTimeout>;
    const run=async()=>{
      while(!controller.signal.aborted){
        try {
          const response=await fetch(`${base}/scanner/phone/devices/${selected}/events`,{headers:{Authorization:`Bearer ${token}`,...(cursor?{'Last-Event-ID':cursor}:{})},signal:controller.signal,cache:'no-store'});
          await readScannerEvents(response,controller.signal,(event,value,id)=>{
            if(id)cursor=id;
            if(event==='unavailable'){stop();setPending(false);setError('scanner.offline');return;}
            if(event==='device'){
              if(current.current.pending && current.current.last && value.context!==current.current.last.context){
                scanId.current='';current.current.pending=false;setPending(false);const expired={...current.current.last,status:'expired'};current.current.last=expired;setLast(expired);
              }
              setDevices(rows=>rows.map(d=>d.id===value.id?value:d));
              if(current.current.active && (!value.online || value.recipient!==startRecipient.current)){stop();setPending(false);setError('scanner.offline');}
            }
            if(value.type==='result') {earlyResults.current.set(value.scan.id,value.scan);if(earlyResults.current.size>500)earlyResults.current.delete(earlyResults.current.keys().next().value!);}
            if(value.type==='result' && scanId.current && (value.scan.id===scanId.current||value.scan.request_id&&value.scan.request_id===current.current.last?.request_id)){
              scanId.current=value.scan.id;current.current.last=value.scan;setLast(value.scan);current.current.pending=scanPending(value.scan);setPending(scanPending(value.scan));
            }
          });
        }catch(e){if(!controller.signal.aborted){stop();setError((e as Error).message);}}
        if(!controller.signal.aborted)await new Promise<void>(resolve=>{timer=setTimeout(resolve,2000);controller.signal.addEventListener('abort',()=>{clearTimeout(timer);resolve();},{once:true});});
      }
    };void run();
    return()=>{controller.abort();clearTimeout(timer);};
  },[token,selected]);
  useEffect(()=> {
    if(!active)return;
    const timer=setInterval(()=>{void api<ScannerDevice>(`/phone/devices/${selected}/start`,{}).then(d=>{
      if(d.recipient!==startRecipient.current){stop();setError('scanner.offline');}
      const scan=current.current.last;
      if(scan&&scanPending(scan)&&scan.created_at<Date.now()/1000-120){scanId.current='';current.current.pending=false;setPending(false);const expired={...scan,status:'expired'};current.current.last=expired;setLast(expired);}
    }).catch(e=>{stop();setError(e.message);});},10000);
    return()=>clearInterval(timer);
  },[active,selected]);
  const send=async(barcode:string)=>{
    const c=current.current;if(!c.active||c.pending||!barcode.trim())return;
    const d=c.devices.find(d=>d.id===c.selected);if(!d?.online){stop();setError('scanner.offline');return;}
    c.pending=true;setPending(true);setError('');
    const requestId=crypto.randomUUID();scanId.current=requestId;
    const captured:ScanCommand={id:requestId,request_id:requestId,barcode,source:'phone',status:'pending',created_at:Date.now()/1000,lease:d.lease,context:d.context,summary:{}};
    c.last=captured;setLast(captured);
    try {
      const result=await api<ScanCommand>(`/phone/devices/${d.id}/scans`,{request_id:requestId,barcode,lease:d.lease,context:d.context});
      if(scanId.current!==requestId||current.current.selected!==d.id)return;
      scanId.current=result.id;
      const resolved=resolveScanResponse(result,earlyResults.current.get(result.id));current.current.last=resolved;setLast(resolved);
      current.current.pending=scanPending(resolved);setPending(scanPending(resolved));
    }catch(e){if(scanId.current!==requestId)return;current.current.pending=false;setPending(false);stop();setError((e as Error).message);}
  };
  const start=async(takeover=false)=>{
    try{
      setError(''); const d=await api<ScannerDevice>(`/phone/devices/${selected}/start`,{takeover});startRecipient.current=d.recipient;
      setDevices(rows=>rows.map(x=>x.id===d.id?d:x));setActive(true);current.current.active=true;detection.current.reset();
      const reader=new BrowserMultiFormatReader(undefined,cameraScanOptions);
      controls.current=await reader.decodeFromConstraints({video:{facingMode:{ideal:'environment'},width:{ideal:1280},height:{ideal:720}},audio:false},video.current!, (result)=>{
        const text=result?.getText();
        if(detection.current.observe(text,drawerVisible.current||current.current.pending||!current.current.active,Date.now(),current.current.devices.find(d=>d.id===current.current.selected)?.destination==='count')&&text)void send(text);
      });
      if(!current.current.active){controls.current.stop();return;}
      const track=(video.current?.srcObject as MediaStream)?.getVideoTracks()[0];setTorchAvailable(!!(track?.getCapabilities() as any)?.torch);
    }catch(e){stop();setError((e as Error).message.startsWith('scanner.')?(e as Error).message:'scanner.camera');}
  };
  const pair=async(pairing:string)=>{
    try{const result=await api<{token:string}>('/pair',{code:pairing,phone_token:current.current.token});await phoneToken(result.token);setToken(result.token);setError('');return true;}catch(e){setError((e as Error).message);return false;}
  };
  const pairRef=useRef(pair);pairRef.current=pair;
  useEffect(()=>{const code=new URLSearchParams(location.hash.slice(1)).get('pair');if(code){history.replaceState(null,'',location.pathname);void phoneToken().then(value=>{current.current.token=value;return pairRef.current(code);});}},[]);
  useEffect(()=>{
    const viewport=window.visualViewport;
    const resize=()=>{
      document.documentElement.style.setProperty('--scanner-viewport-height',`${viewport?.height || window.innerHeight}px`);
      document.documentElement.style.setProperty('--scanner-keyboard-offset',`${Math.max(0,window.innerHeight-(viewport?.height||window.innerHeight)-(viewport?.offsetTop||0))}px`);
    };
    resize();viewport?.addEventListener('resize',resize);window.addEventListener('resize',resize);
    return()=>{viewport?.removeEventListener('resize',resize);window.removeEventListener('resize',resize);};
  },[]);
  return <MotionConfig reducedMotion="user"><ScannerScreen t={t} direction={language==='he'?'rtl':'ltr'} devices={devices} selected={selected}
    active={active} pending={pending} last={last} error={error} torch={torch} torchAvailable={torchAvailable} video={video}
    drawerOpen={drawerOpen} setDrawerOpen={setDrawerOpen} selectDevice={id=>{stop();scanId.current='';current.current.pending=false;current.current.selected=id;current.current.last=undefined;setPending(false);setSelected(id);setError('');setLast(undefined);}}
    refresh={()=>{if(token)void refresh();}} pair={pair} send={send} takeover={()=>void start(true)} toggleCamera={()=>active?stop():void start()}
    toggleTorch={()=>{const track=(video.current?.srcObject as MediaStream)?.getVideoTracks()[0];void track?.applyConstraints({advanced:[{torch:!torch} as any]}).then(()=>setTorch(!torch)).catch(()=>{});}} /></MotionConfig>;
}
createRoot(document.getElementById('scanner')!).render(<ScannerApp/>);
