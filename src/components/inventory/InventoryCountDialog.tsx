import React, { useRef, useState } from 'react';
import { Check, ScanBarcode, X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { useAppLocale } from '@/localization/use-app-locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BarcodeScanButton } from './BarcodeScanButton';
import { apiClient } from '@/lib/api-client';
import { dispatchBarcode, useScanTarget } from '@/lib/scanner';
import type { CatalogVariant } from '@/lib/inventory';
import './inventory-count.css';

type Props={open:boolean;onOpenChange:(open:boolean)=>void;variants:CatalogVariant[];clinicId:number;onSaved:()=>void};
type Entry={id:string;variantId:number;name:string;removed?:boolean};
export function InventoryCountDialog(p:Props){return <Dialog open={p.open} onOpenChange={p.onOpenChange}>{p.open&&<CountSession {...p}/>}</Dialog>;}
function CountSession({variants,clinicId,onOpenChange,onSaved}:Props){
 const {t}=useTranslation();const {direction}=useAppLocale();
 const [counts,setCounts]=useState<Record<number,string>>({});const current=useRef(counts);current.current=counts;
 const [products,setProducts]=useState<Record<number,CatalogVariant>>({});
 const [history,setHistory]=useState<Entry[]>([]);const [saving,setSaving]=useState(false);const lock=useRef(false);const undone=useRef(new Set<string>());const revisionKey=useRef(crypto.randomUUID());
 const change=(id:number,value:string)=>{if(current.current[id]!==value)revisionKey.current=crypto.randomUUID();const next={...current.current,[id]:value};current.current=next;setCounts(next);};
 const add=(variant:CatalogVariant)=>{
  if(lock.current||!variant.is_stockable||variant.archived_at||variant.product.archived_at)throw new Error('scanner.unavailable');
  setProducts(old=>({...old,[variant.id]:variant}));change(variant.id,String((Number(current.current[variant.id])||0)+1));
  setHistory(old=>[{id:crypto.randomUUID(),variantId:variant.id,name:variant.display_name||[variant.product.brand,variant.product.model].filter(Boolean).join(' ')},...old]);
 };
 const scanRef=useScanTarget({id:'inventory-count',kind:'count',label:t('scanner.count'),canApply:!saving,resolveCountVariant:id=>products[id]||variants.find(v=>v.id===id),apply:add});
 const entered=Object.values(products).filter(v=>Number(counts[v.id])>0||counts[v.id]==='');
 const invalid=entered.some(v=>!counts[v.id]?.trim()||!Number.isSafeInteger(Number(counts[v.id]))||Number(counts[v.id])<(v.balance?.reserved||0));
 const total=Object.values(counts).reduce((sum,n)=>sum+(Number(n)||0),0);
 const latest=history[0];const dirty=history.length>0;
 const undo=(entry:Entry)=>{if(lock.current||undone.current.has(entry.id))return;undone.current.add(entry.id);change(entry.variantId,String(Math.max(0,(Number(current.current[entry.variantId])||0)-1)));setHistory(old=>old.map(item=>item.id===entry.id?{...item,removed:true}:item));};
 const save=async()=>{
  if(lock.current||!entered.length||invalid)return;lock.current=true;setSaving(true);
  try{const response=await apiClient.submitInventoryCount({clinic_id:clinicId,reason:t('supply.count'),idempotency_key:'count-'+revisionKey.current,items:entered.map(v=>({variant_id:v.id,counted_quantity:Number(current.current[v.id])}))});
   if(response.error){toast.error(String(response.error));return;}toast.success(t('supply.applied'));onOpenChange(false);onSaved();
  }catch{toast.error(t('scanner.unavailable'));}finally{lock.current=false;setSaving(false);}
 };
 return <DialogContent dir={direction} className="count-workspace" showCloseButton={false} onInteractOutside={e=>{if(dirty||saving)e.preventDefault();}} onEscapeKeyDown={e=>{if(saving||dirty)e.preventDefault();}}>
  <button className="absolute top-4 end-4 p-2" aria-label={t('scanner.close')} disabled={saving} onClick={()=>onOpenChange(false)}><X size={18}/></button><DialogHeader><DialogTitle>{t('supply.count')}</DialogTitle><DialogDescription>{t('scanner.countWorkspaceHint')}</DialogDescription></DialogHeader>
  <div className="count-toolbar"><div><strong>{total}</strong><span>{t('scanner.countUnits')}</span><strong>{entered.length}</strong><span>{t('scanner.countProducts')}</span></div><BarcodeScanButton keepOpen disabled={saving} label={t('barcode.scan')} onScan={async code=>{
   if(await dispatchBarcode(code))return;
   const matches=variants.filter(v=>v.barcode===code);if(matches.length!==1)throw new Error(t('barcode.outsideCount'));add(matches[0]);
  }}/></div>
  <div ref={scanRef} className="count-body">
   <aside className="count-recent" aria-label={t('scanner.countRecent')}><h3>{t('scanner.countRecent')}</h3><div className="count-history-list">{history.length?history.map(entry=><div key={entry.id} className="count-history-row" data-removed={!!entry.removed}><span className="count-history-delta">{entry.removed?'−1':'+1'}</span><span>{entry.name}</span><button disabled={saving||entry.removed||!(Number(counts[entry.variantId])>0)} aria-label={t('scanner.undoCount',{name:entry.name})} title={t('scanner.undoCount',{name:entry.name})} onClick={()=>undo(entry)}><X size={15}/></button></div>):<p className="count-muted">{t('scanner.countHistoryEmpty')}</p>}</div></aside>
   <section className="count-main">
    <div className="count-latest" data-undone={!!latest?.removed} role="status" aria-live="polite">{latest?<><span className="count-check"><Check size={24}/></span><div><span className="count-muted">{t(latest.removed?'scanner.countRemoved':'scanner.countLatest')}</span><strong>{latest.name}</strong></div><bdi className="count-plus">{latest.removed?'−1':'+1'}</bdi></>:<><ScanBarcode size={32}/><div><strong>{t('scanner.readyToCount')}</strong><span className="count-muted">{t('scanner.countStartHint')}</span></div></>}</div>
    <div className="count-products">{entered.map(v=><article key={v.id} className="count-product"><div><strong>{v.display_name||[v.product.brand,v.product.model].filter(Boolean).join(' ')}</strong><bdi className="count-muted">{v.barcode}</bdi></div><input dir="ltr" inputMode="numeric" aria-label={t('scanner.countQuantity',{name:v.display_name})} className="count-number" value={counts[v.id]} disabled={saving} onChange={e=>{if(/^\d*$/.test(e.target.value))change(v.id,e.target.value);}} onBlur={()=>{if(current.current[v.id]==='')change(v.id,'0');}}/>{Number(counts[v.id])<(v.balance?.reserved||0)&&<span className="count-invalid">{t('scanner.countReserved',{count:v.balance?.reserved||0})}</span>}</article>)}</div>
    {!entered.length&&<div className="count-empty"><ScanBarcode size={42}/><p>{t('scanner.countEmpty')}</p></div>}
   </section>
  </div>
  <DialogFooter><Button variant="outline" disabled={saving} onClick={()=>onOpenChange(false)}>{t('supply.close')}</Button><Button onClick={()=>void save()} disabled={saving||invalid||!entered.length}>{t('supply.apply')}{saving&&<Loader2 className="size-4 animate-spin"/>}</Button></DialogFooter>
 </DialogContent>;
}
