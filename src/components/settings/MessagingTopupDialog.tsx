import React from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useAppLocale } from '@/localization/use-app-locale';
import { campaignApi, money, type Topup } from '@/lib/campaigns';

declare global {
  interface Window {
    AllpayPayment?: new (options:{iframeId:string;onSuccess:()=>void;onError:(code:number,message:string)=>void})=>{pay:()=>void};
  }
}
let sdk: Promise<void> | undefined;
function loadSdk(){
  if(window.AllpayPayment)return Promise.resolve();
  sdk??=new Promise<void>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://allpay.to/js/allpay-hf.js';script.async=true;
    script.onload=()=>resolve();script.onerror=()=>{script.remove();sdk=undefined;reject(new Error('payment_sdk_unavailable'));};
    document.head.appendChild(script);
  });
  return sdk;
}

export function MessagingTopupDialog({payment,onClose,onPaid}:{payment:Topup;onClose:()=>void;onPaid:()=>void}){
  const {t,i18n}=useTranslation();const {direction}=useAppLocale();const tr=(key:string)=>t(`campaign.${key}`);
  const redirect=payment.checkout_mode==='redirect';
  const iframeId=React.useId().replaceAll(':','');const [loaded,setLoaded]=React.useState(false);const [ready,setReady]=React.useState(false);
  const [busy,setBusy]=React.useState(false);const [error,setError]=React.useState(false);const instance=React.useRef<{pay:()=>void}|null>(null);
  const onPaidRef=React.useRef(onPaid);onPaidRef.current=onPaid;
  React.useEffect(()=>{if(redirect)return;let active=true;loadSdk().then(()=>{if(active)setReady(true);}).catch(()=>{if(active)setError(true);});return()=>{active=false;};},[redirect]);
  React.useEffect(()=>{
    if(!loaded||!ready||!window.AllpayPayment||instance.current)return;
    instance.current=new window.AllpayPayment({iframeId,onSuccess:()=>setBusy(true),onError:()=>{setBusy(false);setError(true);}});
  },[loaded,ready,iframeId]);
  const check=React.useCallback(async()=>{
    try{
      const result=await campaignApi<Topup>(`/messaging/topups/${payment.id}/reconcile`,{});
      if(result.status==='paid'){onPaidRef.current();return true;}
      if(['failed','expired','refunded','partially_refunded'].includes(result.status)){setBusy(false);setError(true);}
    }catch{setError(true);}
    return false;
  },[payment.id]);
  React.useEffect(()=>{let active=true;let timer:ReturnType<typeof setTimeout>;const poll=async()=>{const paid=await check();if(active&&!paid)timer=setTimeout(poll,3000);};timer=setTimeout(poll,2000);return()=>{active=false;clearTimeout(timer);};},[check]);
  // A pending provider URL is a capability, supplied only by our authenticated API.
  const url=payment.payment_url&&new URL(payment.payment_url);
  if(!url||url.protocol!=='https:'||url.hostname!=='allpay.to')return null;
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent dir={direction} className="sm:max-w-md"><DialogHeader><DialogTitle>{tr('topup')}</DialogTitle><DialogDescription>{tr('secureTopup')}</DialogDescription></DialogHeader><p className="text-lg font-semibold"><bdi>{money(payment.amount_minor*10000,i18n.language)}</bdi></p>{payment.test_mode&&<p className="text-sm text-muted-foreground">{tr('sandboxPayment')}</p>}{redirect?<Button asChild><a href={url.toString()} target="_blank" rel="noopener noreferrer" onClick={event=>{if(window.electronAPI?.openExternalAuthUrl){event.preventDefault();void window.electronAPI.openExternalAuthUrl(url.toString());}}}>{tr('continuePayment')}</a></Button>:<div className="overflow-hidden rounded-lg border border-border bg-white p-3 [color-scheme:light]"><iframe id={iframeId} title={tr('cardDetails')} src={url.toString()} onLoad={()=>setLoaded(true)} className="h-[300px] w-full border-0"/></div>}{error&&<p role="alert" className="text-sm text-destructive">{tr('paymentCheckHelp')}</p>}<DialogFooter><Button variant="outline" onClick={()=>void check()}>{tr('reconcile')}</Button>{!redirect&&<Button disabled={!loaded||!ready||busy} onClick={()=>{setError(false);setBusy(true);instance.current?.pay();}}>{tr(busy?'paymentProcessing':'payTopup')}</Button>}</DialogFooter></DialogContent></Dialog>;
}
