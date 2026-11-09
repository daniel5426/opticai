import React, { useEffect, useRef, useState } from 'react';
import * as Select from '@radix-ui/react-select';
import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Camera, ScanBarcode, Monitor, Link2, ChevronDown, Check, X, Flashlight, Square, RefreshCw, Download, Share, SquarePlus, EllipsisVertical } from 'lucide-react';
import { spring } from '@/lib/springs';
import type { ScannerDevice, ScanCommand } from '@/lib/scanner';
import { useScannerInstall } from './useScannerInstall';
import { ScanResultCard } from './ScanResultCard';
import { scanFeedback } from './scan-feedback';

type Props = {
  t: (key:string)=>string; direction:'rtl'|'ltr'; devices:ScannerDevice[]; selected:string;
  active:boolean; pending:boolean; last?:ScanCommand; error:string; torch:boolean; torchAvailable:boolean;
  video:React.RefObject<HTMLVideoElement | null>; drawerOpen:boolean; setDrawerOpen:(open:boolean)=>void;
  selectDevice:(id:string)=>void; refresh:()=>void; toggleCamera:()=>void; toggleTorch:()=>void;
  pair:(code:string)=>Promise<boolean>; send:(code:string)=>Promise<void>; takeover:()=>void;
};
export function ScannerScreen(p:Props) {
  const [pairCode,setPairCode]=useState(''); const [barcode,setBarcode]=useState(''); const [pairing,setPairing]=useState(false);
  const close=useRef<HTMLButtonElement>(null); const reduce=useReducedMotion();
  const installation=useScannerInstall();
  const [drawerMode,setDrawerMode]=useState<'pair'|'install'>('pair');
  const [installing,setInstalling]=useState(false);
  const offered=useRef(false);
  const openPair=()=>{setDrawerMode('pair');p.setDrawerOpen(true);};
  const closeDrawer=()=>{if(drawerMode==='install')installation.dismiss();p.setDrawerOpen(false);};
  useEffect(()=>{
    if(installation.offer&&!offered.current&&!p.active&&!p.drawerOpen){
      offered.current=true;setDrawerMode('install');p.setDrawerOpen(true);
    }
  },[installation.offer,p.active,p.drawerOpen,p.setDrawerOpen]);
  useEffect(()=>{if(installation.installed&&drawerMode==='install'&&p.drawerOpen)p.setDrawerOpen(false);},[installation.installed,drawerMode,p.drawerOpen,p.setDrawerOpen]);
  const device=p.devices.find(d=>d.id===p.selected);
  const feedback=scanFeedback(p.last,p.pending,p.error);
  const status=p.error ? p.t(p.error) : p.pending ? p.t(p.last?.status==='awaiting_confirmation'?'awaiting_confirmation':'sending') : p.last ? p.t(p.last.status) : device ? (device.online ? p.t('ready') : p.t('offline')) : p.t('chooseComputer');
  return <main className="scanner-shell" dir={p.direction}>
    <header className="scanner-header">
      <div className="brand"><ScanBarcode size={21} aria-hidden="true"/><span>Prysm</span></div>
      <button className="icon-button pairing-button" aria-label={p.t('connect')} title={p.t('connect')} onClick={openPair}><Link2 size={20}/></button>
      <Select.Root dir={p.direction} value={p.selected} onValueChange={p.selectDevice}>
        <Select.Trigger className="pc-select" aria-label={p.t('chooseComputer')} title={device?.name||p.t('chooseComputer')} onPointerDown={()=>p.refresh()}>
          <Monitor size={16} aria-hidden="true"/><span className="pc-name" hidden={!device}><Select.Value>{device?.name||''}</Select.Value></span><Select.Icon className="pc-chevron"><ChevronDown size={14} aria-hidden="true"/></Select.Icon>
        </Select.Trigger>
        <Select.Portal><Select.Content className="pc-options" position="popper" sideOffset={8} dir={p.direction}><Select.Viewport>
          {p.devices.map(d=><Select.Item key={d.id} value={d.id} className="pc-option"><Select.ItemText>{d.name}</Select.ItemText><span className="pc-availability">{d.online?p.t('ready'):p.t('disconnected')}</span><Select.ItemIndicator><Check size={14}/></Select.ItemIndicator></Select.Item>)}
          {!p.devices.length&&<p className="pc-empty">{p.t('noComputers')}</p>}
        </Select.Viewport></Select.Content></Select.Portal>
      </Select.Root>
    </header>
    <section className="scanner-stage" aria-label={p.t('start')}>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={spring.moderate} className="camera-surface" data-feedback={feedback}>
        <video ref={p.video} autoPlay playsInline muted aria-label={p.t('start')}/>
        {!p.active&&<div className="camera-placeholder"><Camera size={36}/><span>{p.t(device?.online?'start':'connect')}</span></div>}
        <div className="scan-guide" data-active={p.active} aria-hidden="true"><i/><i/><i/><i/></div>
        <motion.div className="camera-feedback" data-feedback={feedback} aria-hidden="true" initial={false} animate={{opacity:feedback==='idle'?0:1}} transition={spring.fast}/>
        {p.active&&device&&<span className="scan-destination">{p.t(device.destination||'details')}</span>}
      </motion.div>
      <ScanResultCard scan={p.last} pending={p.pending} error={p.error} counting={device?.destination==='count'} status={status} t={p.t}/>
      <div className="scanner-feedback">
        {p.error==='scanner.busy'&&<button className="text-action" onClick={p.takeover}>{p.t('takeoverPhone')}</button>}
      </div>
    </section>
    <footer className="scanner-controls">
      <button className="shutter" aria-label={p.t(p.active?'stop':device?.online?'start':'connect')} onClick={()=>p.active||device?.online?p.toggleCamera():openPair()}>{p.active?<Square size={23} fill="currentColor"/>:<ScanBarcode size={29}/>}</button>
      {p.torchAvailable&&<button className="icon-button torch" aria-label={p.t('torch')} aria-pressed={p.torch} onClick={p.toggleTorch}><Flashlight size={20}/></button>}
    </footer>
    <Dialog.Root open={p.drawerOpen} onOpenChange={open=>open?p.setDrawerOpen(true):closeDrawer()}>
      <AnimatePresence>{p.drawerOpen&&<Dialog.Portal forceMount>
        <Dialog.Overlay asChild><motion.div className="drawer-overlay" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={spring.fast}/></Dialog.Overlay>
        <Dialog.Content asChild onOpenAutoFocus={e=>{e.preventDefault();close.current?.focus();}}>
          <motion.section className="scanner-drawer" dir={p.direction} initial={{y:reduce?0:'100%'}} animate={{y:0}} exit={{y:reduce?0:'100%',opacity:0}} transition={spring.moderate}>
            <div className="drawer-grip" aria-hidden="true"/>
            <div className="drawer-heading"><Dialog.Title>{p.t(drawerMode==='install'?'installTitle':'connect')}</Dialog.Title><div>{drawerMode==='pair'&&<button className="icon-button" aria-label={p.t('refresh')} title={p.t('refresh')} onClick={p.refresh}><RefreshCw size={18}/></button>}<Dialog.Close asChild><button ref={close} className="icon-button" aria-label={p.t('close')}><X size={20}/></button></Dialog.Close></div></div>
            {drawerMode==='install'?<>
              <Dialog.Description>{p.t('installDescription')}</Dialog.Description>
              {!installation.nativeAvailable&&<ol className="install-steps">
                <li>{installation.ios?<Share size={21} aria-hidden="true"/>:<EllipsisVertical size={21} aria-hidden="true"/>}<span>{p.t(installation.ios?'installIosShare':'installBrowserMenu')}</span></li>
                <li><SquarePlus size={21} aria-hidden="true"/><span>{p.t(installation.ios?'installIosAdd':'installBrowserAdd')}</span></li>
                <li><Check size={21} aria-hidden="true"/><span>{p.t(installation.ios?'installIosConfirm':'installBrowserConfirm')}</span></li>
              </ol>}
              <div className="install-actions">
                <button className="secondary" onClick={closeDrawer}>{p.t('installLater')}</button>
                {installation.nativeAvailable?<button className="primary" disabled={installing} onClick={async()=>{setInstalling(true);try{if(await installation.install())closeDrawer();}finally{setInstalling(false);}}}><Download size={17} aria-hidden="true"/>{p.t('installTitle')}</button>:<button className="primary" onClick={closeDrawer}>{p.t('installDone')}</button>}
              </div>
            </>:<>
            <Dialog.Description>{p.t('getCode')}</Dialog.Description>
            <form onSubmit={async e=>{e.preventDefault();setPairing(true);try{if(await p.pair(pairCode)){setPairCode('');p.setDrawerOpen(false);}}finally{setPairing(false);}}}>
              <label htmlFor="pair-code">{p.t('pairingCode')}</label><div className="input-row"><input id="pair-code" dir="ltr" autoComplete="off" autoCapitalize="characters" maxLength={160} value={pairCode} onChange={e=>setPairCode(e.target.value)}/><button className="primary" disabled={!pairCode.trim()||pairing}>{p.t('pair')}</button></div>
            </form>
            {p.error&&<p role="alert" className="error">{p.t(p.error)}</p>}
            {p.active&&<form className="manual-entry" onSubmit={async e=>{e.preventDefault();await p.send(barcode);setBarcode('');}}><label htmlFor="manual-barcode">{p.t('manualBarcode')}</label><div className="input-row"><input id="manual-barcode" dir="ltr" autoComplete="off" maxLength={256} value={barcode} onChange={e=>setBarcode(e.target.value)}/><button className="secondary" disabled={!barcode.trim()||p.pending}>{p.t('send')}</button></div></form>}
            {!installation.installed&&<button className="installation-link" onClick={()=>setDrawerMode('install')}><Download size={17} aria-hidden="true"/>{p.t('installTitle')}</button>}
            </>}
          </motion.section>
        </Dialog.Content>
      </Dialog.Portal>}</AnimatePresence>
    </Dialog.Root>
  </main>;
}
