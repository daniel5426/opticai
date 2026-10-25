import { createPortal, flushSync } from "react-dom";
import { useSettings } from "@/hooks/useSettings";
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, ArrowLeft } from 'lucide-react';
import { LegacyOrderDetailPage, type OrderDetailPageProps } from '@/pages/OrderDetailPage';
import { SiteHeader } from '@/components/site-header';
import { ClientSpaceLayout } from '@/layouts/ClientSpaceLayout';
import { ClientSelectModal } from '@/components/ClientSelectModal';
import { BillingTab } from '@/components/BillingTab';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CustomModal } from '@/components/ui/custom-modal';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UnsavedChangesDialog } from '@/components/unsaved-changes-dialog';
import { OrderField } from '@/components/orders/layout/OrderSheet';
import { OrderGroupPanelSkeleton, OrderGroupTabs, OrderGroupToolbar } from './OrderGroupChrome';
import { useKeyboardSave } from "@/hooks/shared/useKeyboardSave";
import { useUnsavedChanges } from '@/hooks/shared/useUnsavedChanges';
import { useAppLocale } from '@/localization/use-app-locale';
import { useClientSidebar } from '@/contexts/ClientSidebarContext';
import { useUser } from '@/contexts/UserContext';
import { getClientById } from '@/lib/db/clients-db';
import { inputSyncManager } from '@/components/exam/shared/OptimizedInputs';
import { groupRequest, applySuggestion, type OrderGroup, type GroupEntry, type GroupLineItem, type EntryHandle, type OrderKind } from '@/lib/order-groups';
import type { Billing, BillingPayment, Client } from '@/lib/db/schema-interface';
import { printOrderGroup } from '@/lib/order-docx/print-order-group';
import { cn } from '@/utils/tailwind';
import { toast } from 'sonner';

interface DraftEntry extends GroupEntry { key: string; client: Client }
function LoadingShell() {
 const {t}=useTranslation();const {direction}=useAppLocale();const noop=()=>{};
 return <><SiteHeader title={t('clients')} backLink="/clients" tabs={{activeTab:'orders',onTabChange:noop}}/><ClientSpaceLayout><div className="flex min-h-0 flex-1 flex-col p-4 lg:p-5" dir={direction}>
 <div className="flex shrink-0 items-end gap-3"><div className="flex min-w-0 flex-1 items-end"><Skeleton className="h-10 w-44 rounded-b-none"/></div><OrderGroupToolbar direction={direction} printDisabled printing={false} onPrint={noop} billingOpen={false} billingDisabled onToggleBilling={noop} editing={false} saving={false} editDisabled onEditOrSave={noop}/></div>
 <div className="min-h-0 flex-1 rounded-xl rounded-ss-none bg-card shadow-sm"><OrderGroupPanelSkeleton/></div>
 </div></ClientSpaceLayout></>;
}

export function OrderGroupGate(props: OrderDetailPageProps) {
 const [capabilities,setCapabilities]=useState<{available:boolean}|null>(null);
 useEffect(()=>{let cancelled=false;groupRequest<{available:boolean}>('/capabilities').then(value=>{if(!cancelled)setCapabilities(value)}).catch(()=>{if(!cancelled)setCapabilities({available:false})});return()=>{cancelled=true}},[]);
 if(!capabilities)return <LoadingShell/>;
 if(!capabilities.available)return <LegacyOrderDetailPage {...props}/>;
 return <OrderGroupWorkspace {...props}/>;
}

export function OrderGroupWorkspace(props: OrderDetailPageProps) {
 const {t}=useTranslation();const {direction}=useAppLocale();const navigate=useNavigate();const queryClient=useQueryClient();
 const params=useParams({strict:false}) as {clientId?:string;orderId?:string};const search=useSearch({strict:false}) as {type?:string;entry?:number;examId?:string};
 const contextClientId=Number(props.clientId||params.clientId);const routeOrder=props.orderId||params.orderId;
 const {currentClient,isOpen:clientSidebarOpen,closeSidebar,panelMode,panelHost,openBillingPanel,resetPanelMode,openSidebar}=useClientSidebar();const {currentClinic,currentUser}=useUser();const {company}=useSettings();
 const [payerId,setPayerId]=useState(contextClientId);const [payerPicker,setPayerPicker]=useState(false);const [otherPayers,setOtherPayers]=useState<Client[]>([]);
 const [group,setGroup]=useState<OrderGroup|null>(null);const [entries,setEntries]=useState<DraftEntry[]>([]);const [active,setActive]=useState('');
 const [billing,setBilling]=useState<Billing>({currency:company?.default_currency||'ILS'} as Billing);const [lines,setLines]=useState<GroupLineItem[]>([]);
 const [removed,setRemoved]=useState<number[]>([]);const [snapshots,setSnapshots]=useState<Record<string,string>>({});
 const [editing,setEditing]=useState(props.mode==='new');const [loading,setLoading]=useState(true);const [error,setError]=useState('');
 const billingOpen=clientSidebarOpen&&panelMode==='billing';
 const [pendingKind,setPendingKind]=useState<OrderKind|null>(null);const [removing,setRemoving]=useState<DraftEntry|null>(null);
 const [generation,setGeneration]=useState(0);const [printing,setPrinting]=useState(false);const [activeHeaderTab,setActiveHeaderTab]=useState('orders');
 const handles=useRef(new Map<string,EntryHandle>());const initialKey=useRef(crypto.randomUUID());const pendingBaseline=useRef(false);const stateRef=useRef({group,entries,billing,lines,snapshots,payerId});stateRef.current={group,entries,billing,lines,snapshots,payerId};
 const suppressed=useRef(new Set<string>());
 const savedBilling=useRef('');
 const serialized=useCallback(()=>JSON.stringify({payer:stateRef.current.payerId,entries:stateRef.current.entries.map(entry=>({key:entry.key,id:entry.id,order:stateRef.current.snapshots[entry.key]||entry.order})),billing:stateRef.current.billing,lines:stateRef.current.lines,removed}),[contextClientId,removed]);
 const guard=useUnsavedChanges({getSerializedState:serialized,isEditing:editing,isNewMode:!group});
 const editable=(currentUser?.role_level||1)>=2;
 useEffect(()=>{if(!billing.id&&!lines.length&&company?.default_currency)setBilling(previous=>previous.currency===company.default_currency?previous:{...previous,currency:company.default_currency})},[company?.default_currency,billing.id,lines.length]);

 const hydrate=useCallback((value:OrderGroup,preferEntry?:number)=>{
  const next=value.entries.map(entry=>({ ...entry,key:`entry:${entry.id}`,client:value.clients.find(client=>client.id===entry.order.client_id)! }));
  setGroup(value);setPayerId(value.payer_client_id);setEntries(next);setRemoved([]);setSnapshots({});setBilling(value.billing||({currency:company?.default_currency||'ILS'} as Billing));
  const hydratedLines=value.line_items.map(item=>({...item,source_client_key:item.source_entry_id?`entry:${item.source_entry_id}`:undefined}));
  setLines(hydratedLines);savedBilling.current=JSON.stringify({billing:value.billing||{currency:company?.default_currency||'ILS'},lines:hydratedLines});
  const requested=next.find(entry=>entry.id===preferEntry)||next.find(entry=>entry.order.client_id===contextClientId)||next[0];setActive(requested?.key||'');
  setGeneration(value=>value+1);guard.baselineInitializedRef.current=false;pendingBaseline.current=true;
 },[contextClientId]);
 const load=useCallback(async()=>{
  setLoading(true);setError('');
  try{
   if(routeOrder && routeOrder!=='new'){
    let value:OrderGroup;
    if(routeOrder.startsWith('group-'))value=await groupRequest<OrderGroup>(`/${routeOrder.slice(6)}`);
    else { const path=`/resolve/${search.type==='contact'?'contact':'regular'}/${routeOrder}`; value=await groupRequest<OrderGroup>(path); if(!value.entries) value=await groupRequest<OrderGroup>(path,{method:'POST'}); }
    if(!value.entries)throw new Error('orderGroupImportPending');
    const explicit=value.entries.find(entry=>String(entry.order.id)===routeOrder&&entry.kind===(search.type==='contact'?'contact':'regular'))?.id;
    hydrate(value,search.entry||explicit);setEditing(false);
   }else{
    const client=currentClient?.id===contextClientId?currentClient:await getClientById(contextClientId);
    if(!client)throw new Error('orderGroupClientMissing');
    const kind:OrderKind=search.type==='contact'?'contact':'regular';
    setEntries([{key:'initial',client,kind,position:0,order:{client_id:client.id,clinic_id:currentClinic?.id,type:kind==='contact'?t('orderGroupContact'):t('orderGroupGlasses'),order_date:new Date().toLocaleDateString('en-CA'),user_id:currentUser?.id}}]);
    setActive('initial');setEditing(true);
   }
  }catch(reason){setError(reason instanceof Error?reason.message:'orderGroupLoadError')}finally{setLoading(false)}
 },[routeOrder,contextClientId,search.type,search.entry,hydrate]);
 useEffect(()=>{void load()},[load]);
 const register=useCallback((key:string,handle:EntryHandle|null)=>{if(handle)handles.current.set(key,handle);else handles.current.delete(key)},[]);
 const onChange=useCallback((key:string,snapshot:string)=>{setSnapshots(previous=>previous[key]===snapshot?previous:{...previous,[key]:snapshot})},[]);
 useEffect(()=>{if(!loading&&entries.every(entry=>handles.current.get(entry.key)?.ready)&&entries.every(entry=>snapshots[entry.key])&&(!guard.baselineInitializedRef.current||pendingBaseline.current)){guard.setBaseline();pendingBaseline.current=false}},[loading,snapshots,entries,billing,lines,payerId,guard.setBaseline]);
 useEffect(()=>()=>resetPanelMode(),[resetPanelMode]);
 const suggest=useCallback((key:string,slot:any,variant:any,quantity:number)=>{
  if(suppressed.current.has(`${key}:${slot}`))return;
  const current=stateRef.current;
  const currency=!current.billing.id&&!current.lines.length&&variant?variant.currency:current.billing.currency||'ILS';
  if(currency!==current.billing.currency)setBilling(previous=>({...previous,currency}));
  setLines(previous=>{try{return applySuggestion(previous,key,slot,variant,quantity,currency)}catch{toast.error(t('cannotMixCurrencies'));return previous}});
 },[t]);
 const financialLines=JSON.stringify(lines.map(item=>[item.id,item.price,item.quantity,item.discount,item.line_total]));
 const priorFinancialLines=useRef(financialLines);
 useEffect(()=>{
  const changed=priorFinancialLines.current!==financialLines;priorFinancialLines.current=financialLines;
  if(!changed||!editing||loading)return;
  const total=Math.round(lines.reduce((sum,item)=>sum+Math.max(0,Number(item.line_total)||0),0)*100)/100;
  setBilling(previous=>{const discount=previous.discount_percent?Math.round(total*previous.discount_percent)/100:previous.discount_amount||0;return {...previous,total_before_discount:total,discount_amount:discount,discount_percent:total?Math.round(discount/total*10000)/100:0,total_after_discount:Math.max(0,Math.round((total-discount)*100)/100)}});
 },[financialLines,editing,loading]);
 const entryWorkspaces=useMemo(()=>new Map(entries.map(entry=>[entry.key,{key:entry.key,kind:entry.kind,record:entry.order,client:entry.client,active:entry.key===active,editing,register,onChange,suggest}])),[entries,active,editing,register,onChange,suggest]);
 const metadata=(entry:DraftEntry)=>{const snapshot=snapshots[entry.key];if(!snapshot)return entry.order;const data=JSON.parse(snapshot);return entry.kind==='regular'?data.formData:data.contactFormData};
 const save=async()=>{
  flushSync(()=>inputSyncManager.flush());if(guard.isSaveInFlight)return;
  if(entries.some(entry=>!handles.current.get(entry.key)?.ready)){toast.error(t("orderGroupWait"));return;}
  const drafts=entries.map((entry,index)=>{const handle=handles.current.get(entry.key);if(!handle?.ready)throw new Error('orderGroupWait');return{...handle.serialize(),id:entry.id,position:index}});
  if(drafts.some(entry=>!entry.order.type)){toast.error(t('orderGroupChooseType'));return}
  guard.setIsSaveInFlight(true);setError('');
  try{
   const payload={clinic_id:group?.clinic_id||currentClinic?.id,payer_client_id:payerId,revision:group?.revision,entries:drafts,removed_entry_ids:removed,...((billing.id||lines.length||billing.prepayment_amount||billing.discount_amount||billing.discount_percent)&&JSON.stringify({billing,lines})!==savedBilling.current?{billing,line_items:lines}:{})};
   const value=await groupRequest<OrderGroup>(group?`/${group.id}`:'',{method:group?'PUT':'POST',headers:group?undefined:{'Idempotency-Key':initialKey.current},body:JSON.stringify(payload)});
   const activeId=value.client_keys?.[active];hydrate(value,activeId);setEditing(false);
   await queryClient.invalidateQueries({predicate:query=>query.queryKey[0]==='client'||query.queryKey[0]==='order-groups'||query.queryKey[0]==='orders'});
   toast.success(t('orderGroupSaved'));
   if(!group){guard.allowNavigationRef.current=true;await navigate({to:'/clients/$clientId/orders/$orderId',params:{clientId:String(contextClientId),orderId:`group-${value.id}`},replace:true});}
  }catch(reason){const message=reason instanceof Error?reason.message:'';setError(message);toast.error(t(message.includes('order_group_conflict')?'orderGroupConflict':'orderGroupSaveError'))}finally{guard.setIsSaveInFlight(false)}
 };
 useKeyboardSave({enabled:editing&&!loading,isSaving:guard.isSaveInFlight,canSave:editable,onSave:save});
 const addClient=async(clientId:number)=>{
  const kind=pendingKind;setPendingKind(null);if(!kind)return;
  try{const client=await getClientById(clientId);if(!client)throw new Error();const key=crypto.randomUUID();setEntries(previous=>[...previous,{key,client,kind,position:previous.length,order:{client_id:client.id,clinic_id:group?.clinic_id||currentClinic?.id,type:kind==='contact'?t('orderGroupContact'):t('orderGroupGlasses'),order_date:new Date().toLocaleDateString('en-CA'),user_id:currentUser?.id}}]);setActive(key);setEditing(true)}catch{toast.error(t('orderGroupClientMissing'))}
 };
 const remove=()=>{if(!removing)return;if(removing.id)setRemoved(previous=>[...previous,removing.id!]);setEntries(previous=>previous.filter(entry=>entry.key!==removing.key));if(active===removing.key)setActive(entries.find(entry=>entry.key!==removing.key)?.key||'');setRemoving(null)};
 const paymentAdapter={create:async(payment:{amount:number;paid_at:string;kind:'payment'})=>{const response=await groupRequest<{payment:BillingPayment;group:OrderGroup}>(`/${group!.id}/payments?revision=${group!.revision}`,{method:'POST',body:JSON.stringify(payment)});setGroup(response.group);setBilling(response.group.billing!);savedBilling.current=JSON.stringify({billing:response.group.billing,lines:stateRef.current.lines});pendingBaseline.current=true;void queryClient.invalidateQueries({queryKey:["order-groups"]});return response.payment},remove:async(paymentId:number)=>{try{const value=await groupRequest<OrderGroup>(`/${group!.id}/payments/${paymentId}?revision=${group!.revision}`,{method:'DELETE'});setGroup(value);setBilling(value.billing!);savedBilling.current=JSON.stringify({billing:value.billing,lines:stateRef.current.lines});pendingBaseline.current=true;void queryClient.invalidateQueries({queryKey:["order-groups"]});return true}catch{toast.error(t('orderGroupConflict'));return false}}};
 const print=async(all:boolean)=>{if(!group)return;setPrinting(true);try{const chosen=all?group.entries:group.entries.filter(entry=>`entry:${entry.id}`===active);const result=await printOrderGroup(chosen);if(!result.success)throw new Error(result.error)}catch{toast.error(t('orderGroupPrintError'))}finally{setPrinting(false)}};
 const reorder=(from:string,to:string)=>{setEntries(previous=>{const next=[...previous];const index=next.findIndex(entry=>entry.key===from);const target=next.findIndex(entry=>entry.key===to);if(index<0||target<0)return previous;const [entry]=next.splice(index,1);next.splice(target,0,entry);return next})};
 const tabEntries=entries.map(entry=>({key:entry.key,client:entry.client,label:metadata(entry).type||t(entry.kind==='regular'?'orderGroupGlasses':'orderGroupContact'),values:metadata(entry)}));
 const payerOptions=Array.from(new Map([...(group?.clients||[]),...otherPayers,...entries.map(entry=>entry.client)].map(client=>[client.id,client])).values());
 const errorKey=error.includes('order_group_conflict')?'orderGroupConflict':error==='orderGroupImportPending'?'orderGroupImportPending':'orderGroupLoadError';
 const removeLine=(id:number)=>setLines(previous=>{const line=previous.find(item=>item.id===id);if(line?.source_client_key&&line.source_slot)suppressed.current.add(`${line.source_client_key}:${line.source_slot}`);return previous.filter(item=>item.id!==id)});

 return <><SiteHeader title={t('clients')} backLink="/clients" clientBackLink={`/clients/${contextClientId}`} examInfo={t('orderGroupTitle')} hasUnsavedChanges={guard.hasUnsavedChanges} tabs={{activeTab:activeHeaderTab,onTabChange:setActiveHeaderTab}}/>
 <ClientSpaceLayout><div className="relative flex h-full min-h-0 flex-1" dir={direction}>
 <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-4 lg:p-5">
 <div className="flex shrink-0 items-end gap-3">
 <OrderGroupTabs entries={tabEntries} activeKey={active} editing={editing} addDisabled={loading||!editable} direction={direction} onSelect={setActive} onReorder={reorder} onRemove={key=>setRemoving(entries.find(entry=>entry.key===key)||null)} onMetadataChange={(key,patch)=>handles.current.get(key)?.setMetadata(patch as Record<string, unknown>)} onAdd={setPendingKind}/>
 <OrderGroupToolbar direction={direction} printDisabled={!group||guard.hasUnsavedChanges||!entries.length} printing={printing} onPrint={all=>void print(all)} billingOpen={billingOpen} billingDisabled={loading} onToggleBilling={()=>{if(billingOpen)closeSidebar();else openBillingPanel()}} editing={editing} saving={guard.isSaveInFlight} editDisabled={loading||!editable} onEditOrSave={()=>{if(editing)void save();else setEditing(true)}}/>
 </div>
 <div data-order-surface className={cn('no-scrollbar flex min-h-0 w-full shrink flex-col overflow-y-auto rounded-xl border-0 bg-card shadow-sm',entries[0]?.key===active&&'rounded-ss-none')} style={{scrollbarWidth:'none'}}>
 {error&&<div role="alert" className="flex shrink-0 items-center justify-between gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-sm text-destructive"><span>{t(errorKey)}</span><Button variant="ghost" size="sm" onClick={()=>guard.handleNavigationAttempt(()=>void load())}>{t('orderGroupReload')}</Button></div>}
 {loading?<OrderGroupPanelSkeleton/>:entries.length?entries.map(entry=><div key={`${entry.key}:${generation}`} hidden={active!==entry.key} id={`order-panel-${entry.key}`} aria-labelledby={`order-tab-${entry.key}`} role="tabpanel">
 <LegacyOrderDetailPage mode={entry.order.id?'view':'new'} clientId={String(entry.client.id)} orderId={entry.order.id?.toString()} examId={entry.key==='initial'?props.examId:undefined} workspace={entryWorkspaces.get(entry.key)!}/>
 </div>):<div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center"><span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"><Plus className="size-5"/></span><p className="text-sm text-muted-foreground">{t('orderGroupEmpty')}</p></div>}
 </div></div>
 {billingOpen&&panelHost&&createPortal(<>
 <Button variant="ghost" size="icon" className="absolute top-2 end-2 z-10 size-8" aria-label={t('agent.returnInfo')} title={t('agent.returnInfo')} onClick={openSidebar}><ArrowLeft className={`size-4 ${direction==='rtl'?'rotate-180':''}`}/></Button>
 <div className="flex h-12 shrink-0 items-center justify-center px-12"><h2 className="text-sm font-medium">{t('orderGroupBilling')}</h2></div>
 <div className="shrink-0 px-4 pb-4"><OrderField label={t('orderGroupPayer')}><Select dir={direction} disabled={!editing} value={String(payerId)} onValueChange={value=>value==='other'?setPayerPicker(true):setPayerId(Number(value))}><SelectTrigger aria-label={t('orderGroupPayer')}><SelectValue/></SelectTrigger><SelectContent>{payerOptions.map(client=><SelectItem key={client.id} value={String(client.id)}>{client.first_name} {client.last_name}</SelectItem>)}<SelectItem value="other">{t('orderGroupOtherPayer')}</SelectItem></SelectContent></Select></OrderField></div>
 <BillingTab compact billingFormData={billing} setBillingFormData={setBilling} orderLineItems={lines} setOrderLineItems={setLines as any} isEditing={editing&&editable} canPay={editable&&Boolean(group)&&!guard.hasUnsavedChanges} paymentAdapter={paymentAdapter} handleDeleteOrderLineItem={removeLine}/>
 </>,panelHost)}
 </div></ClientSpaceLayout>
 <ClientSelectModal isOpen={pendingKind!==null||payerPicker} onClose={()=>{setPendingKind(null);setPayerPicker(false)}} onClientSelect={id=>{if(payerPicker){setPayerPicker(false);void getClientById(id).then(client=>{if(client){setOtherPayers(previous=>[...previous,client]);setPayerId(id)}})}else void addClient(id)}} preferredClient={currentClient||entries.find(entry=>entry.client.id===contextClientId)?.client||group?.clients.find(client=>client.id===contextClientId)}/>
 <CustomModal isOpen={Boolean(removing)} onClose={()=>setRemoving(null)} onConfirm={remove} title={t('orderGroupRemoveOrder')} description={t('orderGroupRemoveConfirm')} confirmText={t('orderGroupRemoveOrder')} cancelText={t('cancel')} direction={direction}/>
 <UnsavedChangesDialog open={guard.showUnsavedDialog} onConfirm={guard.handleUnsavedConfirm} onCancel={guard.handleUnsavedCancel}/>
 </>;
}
