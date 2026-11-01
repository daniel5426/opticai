import React, {useEffect,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link,useNavigate} from '@tanstack/react-router';
import {useTranslation} from 'react-i18next';
import {ORDER_STATUS_OPTIONS} from '@/lib/order-status';
import {SortableTableHead} from '@/components/sortable-table-head';
import {ColumnFiltersProvider,FilterableHeaderLabel,useColumnFilterState} from '@/components/column-filter';
import {serializeColumnFilters,type ColumnFilterDefinition,type ColumnFilters} from '@/lib/column-filters';
import {Plus,Trash2} from 'lucide-react';
import {type OrderGroup} from '@/lib/order-groups';
import {apiClient} from '@/lib/api-client';
import {loadOrderList,loadLegacyOrderCount,removeOrderListRow,type OrderListPage} from '@/lib/order-list-compat';
import {onBillingPaymentsChanged} from '@/lib/billing-events';
import {useAppLocale} from '@/localization/use-app-locale';
import {useUser} from '@/contexts/UserContext';
import {Button} from '@/components/ui/button';
import {TableRow,TableHead,TableCell} from '@/components/ui/table';
import {TableListLayout} from '@/components/table-list-layout';
import {CustomModal} from '@/components/ui/custom-modal';
import {ClientSelectModal} from '@/components/ClientSelectModal';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from '@/components/ui/dropdown-menu';
import {OrderGroupPaymentCell} from './OrderGroupPaymentCell';
import {toast} from 'sonner';

export function useOrderGroupCapabilities(enabled=true) {
 return useQuery({queryKey:['order-group-capabilities'],enabled,staleTime:60000,queryFn:async()=>{const result=await apiClient.orderGroupRequest<{available:boolean}>('/capabilities');if(result.status===404||result.status===405)return {available:false};if(result.error||!result.data)throw new Error(result.error||'orderGroupLoadError');return result.data}});
}
export function OrderGroupList({clientId,enabled=true}:{clientId?:number;enabled?:boolean}) {
 const {t}=useTranslation();const {locale,direction}=useAppLocale();const {currentClinic,currentUser}=useUser();const navigate=useNavigate();const cache=useQueryClient();
 const capabilities=useOrderGroupCapabilities(enabled);const backend=capabilities.data?.available?'groups':'legacy';
 const [kind,setKind]=useState('all'),[status,setStatus]=useState('all'),[sort,setSort]=useState({key:'date',direction:'desc' as 'asc'|'desc'});
 const statusKeys=['orderGroupStatusProduction','orderGroupStatusLenses','orderGroupStatusFrame','orderGroupStatusShipping','orderGroupStatusCollection','orderGroupStatusDelivered'];
 const statusLabel=(value:string)=>{const index=ORDER_STATUS_OPTIONS.indexOf(value as any);return index>=0?t(statusKeys[index]):value};
 const [page,setPage]=useState(1),[search,setSearch]=useState(''),[q,setQ]=useState('');
 const columnFilterState=useColumnFilterState(undefined,undefined);const filters=serializeColumnFilters(columnFilterState.filters);
 const setColumnFilters=(next:ColumnFilters)=>{columnFilterState.setFilters(next);setPage(1)};
 const columnFilterDefinitions=React.useMemo<ColumnFilterDefinition[]>(()=>[{key:'date',label:t('orderGroupGroupDate'),kind:'date'},{key:'clients',label:t('orderGroupClients'),kind:'text'},{key:'kinds',label:t('orderGroupKinds'),kind:'options',options:[{value:'regular',label:t('orderGroupGlasses')},{value:'contact',label:t('orderGroupContact')}]},{key:'status',label:t('orderGroupStatus'),kind:'options',options:ORDER_STATUS_OPTIONS.map(value=>({value,label:statusLabel(value)}))},{key:'payer',label:t('orderGroupPayer'),kind:'text'}],[t]);const [removing,setRemoving]=useState<OrderGroup|null>(null);const [adding,setAdding]=useState<'regular'|'contact'|null>(null);const [deleting,setDeleting]=useState(false);
 useEffect(()=>{const timer=setTimeout(()=>{setQ(search);setPage(1)},300);return()=>clearTimeout(timer)},[search]);
 const query=useQuery<OrderListPage>({queryKey:['order-groups',currentClinic?.id,clientId,page,q,kind,status,sort.direction,backend,filters],enabled:enabled&&Boolean(currentClinic?.id)&&Boolean(capabilities.data),queryFn:()=>loadOrderList(backend,{clinicId:currentClinic!.id,clientId,page,q,kind,status,direction:sort.direction,filters})});
 const count=useQuery({queryKey:['order-group-count',currentClinic?.id,q,kind,status],enabled:enabled&&backend==='legacy'&&!clientId&&query.data?.total===null,queryFn:()=>loadLegacyOrderCount({clinicId:currentClinic!.id,page,q,kind,status,direction:sort.direction})});
 useEffect(()=>onBillingPaymentsChanged(()=>{void cache.invalidateQueries({queryKey:['order-groups']});void cache.invalidateQueries({queryKey:['order-group-count']});void cache.invalidateQueries({queryKey:['order-group-quick-payment']})}),[cache]);
 const open=(group:OrderGroup)=>{const target=clientId||group.payer_client_id||group.entries[0]?.order.client_id;if(target)navigate({to:'/clients/$clientId/orders/$orderId',params:{clientId:String(target),orderId:group.legacy_order?String(group.legacy_order.id):`group-${group.id}`},search:{type:group.legacy_order?.kind==='contact'?'contact':undefined} as any})};
 const create=(id:number,kind=adding)=>{setAdding(null);navigate({to:'/clients/$clientId/orders/new',params:{clientId:String(id)},search:{type:kind==='contact'?'contact':undefined} as any})};
 const remove=async()=>{if(!removing)return;setDeleting(true);try{await removeOrderListRow(backend,removing);setRemoving(null);if(query.data?.items.length===1&&page>1)setPage(page-1);await cache.invalidateQueries({queryKey:['order-groups']});await cache.invalidateQueries({queryKey:['order-group-count']});await cache.invalidateQueries({queryKey:['client']})}catch{toast.error(t('orderGroupConflict'))}finally{setDeleting(false)}};
 const clientLink=(group:OrderGroup,id:number)=>{const client=group.clients.find(client=>client.id===id);return client?<Link to="/clients/$clientId" params={{clientId:String(id)}} search={{tab:'orders'}} className="rounded-sm text-blue-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={event=>event.stopPropagation()}>{`${client.first_name||''} ${client.last_name||''}`.trim()}</Link>:null};
 const headerClass='text-start';
 return <ColumnFiltersProvider filters={columnFilterState.filters} definitions={backend==='groups'?columnFilterDefinitions:[]} onChange={setColumnFilters}><TableListLayout fillHeight columnCount={7} loading={capabilities.isPending||query.isLoading}
 emptyState={!capabilities.isError&&!query.isError&&!query.data?.items.length?t('orderGroupNone'):undefined}
 toolbar={{hasActiveFilters:Boolean(search.trim())||kind!=='all'||status!=='all'||columnFilterState.active,onReset:()=>{setSearch('');setQ('');setKind('all');setStatus('all');columnFilterState.setFilters({});setPage(1)},searchValue:search,
onSearchChange:setSearch,
searchPlaceholder:t('orderGroupSearch'),
filters:[{key:'kind',value:kind,onChange:value=>{setKind(value);setPage(1)},placeholder:t('orderGroupKinds'),widthClassName:'w-[190px]',options:[{value:'all',label:t('orderGroupAllKinds')},{value:'regular',label:t('orderGroupGlasses')},{value:'contact',label:t('orderGroupContact')}]},{key:'status',value:status,onChange:value=>{setStatus(value);setPage(1)},placeholder:t('orderGroupStatus'),widthClassName:'w-[190px]',options:[{value:'all',label:t('orderGroupAllStatuses')},...ORDER_STATUS_OPTIONS.map(value=>({value,label:statusLabel(value)}))]}],
actions:<DropdownMenu dir={direction}><DropdownMenuTrigger asChild><Button disabled={!capabilities.data||(currentUser?.role_level||1)<2}><span>{t('orderGroupAddOrder')}</span><Plus className="h-4 w-4"/></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={()=>clientId?create(clientId,'regular'):setAdding('regular')}>{t('orderGroupGlasses')}</DropdownMenuItem><DropdownMenuItem onSelect={()=>clientId?create(clientId,'contact'):setAdding('contact')}>{t('orderGroupContact')}</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}}
 header={<TableRow><SortableTableHead className={headerClass} sortKey="date" sort={sort} onSortChange={value=>{setSort(value);setPage(1)}}>{t('orderGroupGroupDate')}</SortableTableHead><TableHead className={headerClass}><FilterableHeaderLabel filterKey="clients">{t('orderGroupClients')}</FilterableHeaderLabel></TableHead><TableHead className={headerClass}><FilterableHeaderLabel filterKey="kinds">{t('orderGroupKinds')}</FilterableHeaderLabel></TableHead><TableHead className={headerClass}><FilterableHeaderLabel filterKey="status">{t('orderGroupStatus')}</FilterableHeaderLabel></TableHead><TableHead className={headerClass}><FilterableHeaderLabel filterKey="payer">{t('orderGroupPayer')}</FilterableHeaderLabel></TableHead><TableHead className={headerClass}>{t('orderGroupBalance')}</TableHead><TableHead className={headerClass}/></TableRow>}
 pagination={{page,pageSize:25,total:query.data?.total??count.data??null,hasMore:query.data?.hasMore,loading:capabilities.isPending||query.isFetching,onPageChange:setPage}}>
 {(capabilities.isError||query.isError)?<TableRow><TableCell colSpan={7} className="p-8 text-center">{t('orderGroupLoadError')}</TableCell></TableRow>:query.data?.items.map(group=><TableRow key={`${group.legacy_order?.kind||'group'}:${group.id}`} className="cursor-pointer" onClick={()=>open(group)}><TableCell className="px-3 py-2 whitespace-nowrap">{group.opened_date?new Date(`${group.opened_date}T12:00:00`).toLocaleDateString(locale==='he'?'he-IL':locale==='fr'?'fr-FR':'en-US'):''}</TableCell><TableCell className="px-3 py-2">{Array.from(new Set(group.entries.map(entry=>entry.order.client_id))).map((id,index)=><React.Fragment key={id}>{index>0?', ':''}{clientLink(group,id)}</React.Fragment>)}</TableCell><TableCell className="px-3 py-2">{group.entries.map(entry=>entry.order.type||t(entry.kind==='regular'?'orderGroupGlasses':'orderGroupContact')).join(', ')}</TableCell><TableCell className="px-3 py-2">{Array.from(new Set(group.entries.map(entry=>entry.kind==='contact'?entry.order.order_status:entry.order.order_data?.details?.order_status))).filter(Boolean).map(value=>statusLabel(value as string)).join(', ')}</TableCell><TableCell className="px-3 py-2">{clientLink(group,group.payer_client_id)}</TableCell><TableCell className="px-3 py-2 tabular-nums whitespace-nowrap"><OrderGroupPaymentCell group={group} backend={backend}/></TableCell><TableCell className="px-3 py-2"><div className="flex items-center gap-2"><Button variant="ghost" size="sm" onClick={event=>{event.stopPropagation();open(group)}}>{t('orderGroupOpen')}</Button><Button variant="ghost" size="icon-sm" aria-label={t('orderGroupDelete')} disabled={!capabilities.data||(currentUser?.role_level||1)<2} onClick={event=>{event.stopPropagation();setRemoving(group)}}><Trash2 className="h-4 w-4 text-red-600"/></Button></div></TableCell></TableRow>)}
 </TableListLayout>
 <ClientSelectModal isOpen={adding!==null} onClose={()=>setAdding(null)} onClientSelect={id=>create(id)}/>
 <CustomModal isOpen={Boolean(removing)} onClose={()=>setRemoving(null)} onConfirm={()=>void remove()} isLoading={deleting} title={t('orderGroupDelete')} description={t('orderGroupDeleteConfirm')} confirmText={t('orderGroupDelete')} cancelText={t('cancel')} direction={direction}/>
 </ColumnFiltersProvider>;
}
