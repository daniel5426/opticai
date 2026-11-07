import React from 'react';
import '@/localization/i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OrderGroupWorkspace } from '@/components/order-groups/OrderGroupWorkspace';
import { groupRequest } from '@/lib/order-groups';
import i18n from '@/localization/i18n';
const fixture=vi.hoisted(()=>({params:{clientId:'1',orderId:'group-1'}}));
vi.mock('@tanstack/react-router',()=>({useParams:()=>fixture.params,useSearch:()=>({}),useNavigate:()=>vi.fn(),useBlocker:()=>({status:'idle'})}));
vi.mock('@/contexts/NavigationGuardContext',()=>({useNavigationGuard:()=>({registerGuard:()=>{}})}));
vi.mock('@/contexts/ClientSidebarContext',()=>({useClientSidebar:()=>({isOpen:false,resetPanelMode:()=>{}})}));
vi.mock('@/hooks/useSettings',()=>({useSettings:()=>({company:{default_currency:'ILS'}})}));
vi.mock('@/components/site-header',()=>({SiteHeader:({clientBackLink}:any)=><output data-testid="current-client">{clientBackLink}</output>}));
vi.mock('@/layouts/ClientSpaceLayout',()=>({ClientSpaceLayout:({children}:any)=>children}));
vi.mock('@/components/ClientSelectModal',()=>({ClientSelectModal:()=>null}));
vi.mock('@/components/BillingTab',()=>({BillingTab:()=>null}));
vi.mock('@/lib/order-groups',async original=>({...await original<object>(),groupRequest:vi.fn()}));
vi.mock('@/pages/OrderDetailPage',()=>({LegacyOrderDetailPage:({workspace}:any)=>{
 const [notes,setNotes]=React.useState('');
 React.useEffect(()=>{workspace.register(workspace.key,{ready:true,serialize:()=>({kind:'regular',order:{...workspace.record,notes}}),applySaved:(entry:any)=>setNotes(entry.order.notes||'')});workspace.onChange(workspace.key,JSON.stringify({formData:{...workspace.record,notes}}));return()=>workspace.register(workspace.key,null)},[workspace.key,workspace.register,workspace.onChange,workspace.record,notes]);
 return <><output data-testid="loaded-record">{`${workspace.client.id}:${workspace.record.id}`}</output><input aria-label="Draft notes" value={notes} onChange={event=>setNotes(event.target.value)}/></>;
}}));
afterEach(()=>{cleanup();fixture.params={clientId:'1',orderId:'group-1'};vi.clearAllMocks();});
const group=(id:number)=>({id,clinic_id:1,payer_client_id:id,revision:1,clients:[{id,first_name:'Synthetic',last_name:`Client ${id}`}],entries:[{id,position:0,kind:'regular',order:{id:id*10,client_id:id,type:'Distance'}}],billing:null,line_items:[]});
it('a late request for the previous route cannot replace the current order or save target',async()=>{
 const {useUser}=await import('@/contexts/UserContext');vi.mocked(useUser).mockReturnValue({currentUser:{id:1,role_level:2},currentClinic:{id:1}} as any);
 let resolveFirst!:(value:any)=>void;const first=new Promise(resolve=>{resolveFirst=resolve});
 vi.mocked(groupRequest).mockImplementation((path,opts)=>opts?.method==='PUT'?Promise.resolve(group(2) as any):path==='/1'?first as any:Promise.resolve(group(2) as any));
 const client=new QueryClient();const view=()=><QueryClientProvider client={client}><OrderGroupWorkspace mode="view"/></QueryClientProvider>;
 const rendered=render(view());
 await waitFor(()=>expect(groupRequest).toHaveBeenCalledWith('/1'));
 fixture.params={clientId:'2',orderId:'group-2'};rendered.rerender(view());
 await waitFor(()=>expect(screen.getByTestId('loaded-record')).toHaveTextContent('2:20'));
 await act(async()=>resolveFirst(group(1)));
 await waitFor(()=>expect(screen.getByTestId('loaded-record')).toHaveTextContent('2:20'));
 expect(screen.getByTestId('current-client')).toHaveTextContent('/clients/2');
 fireEvent.click(screen.getByRole('button',{name:i18n.t('orderGroupEdit')}));
 fireEvent.change(screen.getByLabelText('Draft notes'),{target:{value:'New draft'}});
 fireEvent.click(screen.getByRole('button',{name:i18n.t('orderGroupSave')}));
 await waitFor(()=>expect(vi.mocked(groupRequest).mock.calls.some(([path,opts])=>path==='/2'&&opts?.method==='PUT')).toBe(true));
});

it('does not show a previous order when the next route fails to load',async()=>{
 vi.mocked(groupRequest).mockImplementation(path=>path==='/1'?Promise.resolve(group(1) as any):Promise.reject(new Error('Unavailable')));
 const client=new QueryClient();const view=()=><QueryClientProvider client={client}><OrderGroupWorkspace mode="view"/></QueryClientProvider>;
 const rendered=render(view());
 await screen.findByTestId('loaded-record');
 fixture.params={clientId:'2',orderId:'group-2'};rendered.rerender(view());
 await screen.findByRole('alert');
 expect(screen.queryByTestId('loaded-record')).toBeNull();
 expect(screen.getByRole('button',{name:i18n.t('orderGroupEdit')})).toBeDisabled();
});

it('keeps the same editor mounted and editable across repeated saves without reloading',async()=>{
 let current:any=group(1);
 vi.mocked(groupRequest).mockImplementation(async(_path,options)=>{
  if(options?.method==='PUT') { const payload=JSON.parse(options.body as string);current={...current,revision:current.revision+1,entries:payload.entries.map((entry:any)=>({...entry,id:1})),client_keys:{'entry:1':1}}; }
  return current;
 });
 const cache=new QueryClient();render(<QueryClientProvider client={cache}><OrderGroupWorkspace mode="view"/></QueryClientProvider>);
 const input=await screen.findByLabelText('Draft notes');
 fireEvent.click(screen.getByRole('button',{name:i18n.t('orderGroupEdit')}));
 for(const value of ['First save','Second save']) {
  fireEvent.change(input,{target:{value}});
  fireEvent.click(screen.getByRole('button',{name:i18n.t('orderGroupSave')}));
  await waitFor(()=>expect(screen.getByText(i18n.t('saveStatus.saved'))).toBeInTheDocument());
  expect(screen.getByLabelText('Draft notes')).toBe(input);
  expect(input).toHaveValue(value);
  expect(screen.getByRole('button',{name:i18n.t('orderGroupSave')})).toBeEnabled();
 }
 expect(vi.mocked(groupRequest).mock.calls.filter(([,options])=>!options)).toHaveLength(1);
 expect(vi.mocked(groupRequest).mock.calls.filter(([,options])=>options?.method==='PUT')).toHaveLength(2);
});
