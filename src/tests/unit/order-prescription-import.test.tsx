import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { findExamComponentData } from '@/lib/exam-component-data';
import i18n from '@/localization/i18n';
import { LegacyOrderDetailPage } from '@/pages/OrderDetailPage';

const fixture = vi.hoisted(() => ({
  data: {} as Record<string, unknown>, search: { importSourceId: '99', importSourceType: 'exam' } as Record<string, string>,
  regularSource: vi.fn(), contactSource: vi.fn(),
  client: { id: 1, first_name: 'Synthetic', last_name: 'Patient' },
  json: vi.fn(), instances: null as any, active: 1,
}));
vi.mock('@/components/order-groups/OrderGroupWorkspace', () => ({ OrderGroupGate: () => null }));
vi.mock('@tanstack/react-router', () => ({ useParams: () => ({clientId:'1'}), useSearch: () => fixture.search, useNavigate: () => vi.fn(), useBlocker: () => ({status:'idle'}) }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => null }));
vi.mock('@/components/agent/AgentLinks', () => ({ AgentLink: () => null }));
vi.mock('@/services/agent-client', () => ({ agentJson: fixture.json, downloadAgentReport: vi.fn() }));
vi.mock('@/contexts/ClientSidebarContext', () => ({ useClientSidebar: () => ({currentClient:fixture.client}) }));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({company:{default_currency:'ILS'}}) }));
vi.mock('@/hooks/shared/useUnsavedChanges', () => ({ useUnsavedChanges: () => ({ baselineInitializedRef:{current:true}, allowNavigationRef:{current:false}, setBaseline:vi.fn() }) }));
vi.mock('@/components/exam/ExamToolbox', () => ({ ExamToolbox: () => null, createToolboxActions: () => ({}) }));
vi.mock('@/lib/db/exams-db', () => ({ getExamPageData: async () => ({ exam:{id:99}, instances:fixture.instances || [{instance:{id:1},exam_data:fixture.data}], chosen_active_instance_id:fixture.active }), getExamById:vi.fn() }));
vi.mock('@/lib/api-client',()=>({apiClient:{getOrderInventoryAllocations:async()=>({data:{items:[]}})}}));
vi.mock('@/lib/db/users-db', () => ({ getAllUsers: async () => [] }));
vi.mock('@/lib/db/orders-db', () => ({ getOrdersByClientId: async () => [], getAllOrders: async () => [], getNextBagNumber: async () => "1", getOrderById: fixture.regularSource, getContactLensOrderById: fixture.contactSource }));
vi.mock('@/components/orders/RegularOrderTab', () => ({default: ({finalPrescriptionData,onFinalPrescriptionChange}:any) => <><output data-testid="rx">{JSON.stringify(finalPrescriptionData)}</output><button onClick={()=>onFinalPrescriptionChange('r_sph','Balance')}>Select Balance</button></>}));
vi.mock('@/components/orders/ContactOrderTab', () => ({default: ({contactLensExamData}:any) => <output data-testid="contact-rx">{JSON.stringify(contactLensExamData)}</output>}));
afterEach(()=>{cleanup(); fixture.instances=null;fixture.active=1;fixture.search={importSourceId:'99',importSourceType:'exam'};vi.clearAllMocks();});
const wrap=(child:React.ReactNode)=>render(<QueryClientProvider client={new QueryClient()}>{child}</QueryClientProvider>);
it.each(['legacy','card-key'])('checks real order import with %s data', async shape => {
  fixture.data=shape==='legacy'?{'final-prescription':{r_sph:-2.25,l_sph:-1.5}}:{'final-prescription-final-prescription-123':{card_instance_id:'final-prescription-123',r_sph:-2.25,l_sph:-1.5}};
  const workspace:any={key:'initial',kind:'regular',record:{client_id:1},client:fixture.client,editing:true,active:true,register:vi.fn(),onChange:vi.fn()};
  wrap(<LegacyOrderDetailPage mode="new" clientId="1" workspace={workspace}/>);
  const output=await screen.findByTestId('rx');
  const rx=JSON.parse(output.textContent!);
  expect(rx.r_sph).toBe(-2.25);
});

function workspace(){return {key:'initial',kind:'regular',record:{client_id:1},client:fixture.client,editing:true,active:true,register:vi.fn(),onChange:vi.fn()} as any;}
it('preserves a supported SPH Balance preset in order state and serialized payload', async()=>{
 fixture.data={'final-prescription':{r_sph:-2.25}};
 const entry=workspace();
 wrap(<LegacyOrderDetailPage mode="new" clientId="1" workspace={entry}/>);
 await screen.findByTestId('rx');
 fireEvent.click(screen.getByText('Select Balance'));
 await waitFor(()=>expect(JSON.parse(screen.getByTestId('rx').textContent!).r_sph).toBe('Balance'));
 const handle=entry.register.mock.calls.filter((call:any)=>call[1]?.ready).at(-1)[1];
 expect(handle.serialize().order.order_data['final-prescription'].r_sph).toBe('Balance');
});
it('finds the prescription anywhere in the exam, independently of layout activity', async()=>{
 fixture.active=1;
 fixture.instances=[{instance:{id:1,is_active:true},exam_data:{'objective':{r_sph:-7}}},{instance:{id:2,is_active:false},exam_data:{'final-prescription-final-123':{r_sph:0,l_sph:-2.25}}}];
 wrap(<LegacyOrderDetailPage mode="new" clientId="1" workspace={workspace()}/>);
 const output=await screen.findByTestId('rx');
 expect(JSON.parse(output.textContent!)).toMatchObject({r_sph:0,l_sph:-2.25});
});
it('prefers populated card data over empty or stale legacy aliases across the whole exam',()=>{
 const data=findExamComponentData({instances:[{exam_data:{'final-prescription':{r_sph:-7}}},{exam_data:{'final-prescription-card':{card_instance_id:'card',r_sph:0,l_sph:-2.25}}}]},'final-prescription');
 expect(data).toMatchObject({r_sph:0,l_sph:-2.25});
 expect(findExamComponentData({instances:[{exam_data:{'final-prescription-card':{card_instance_id:'card'},'final-prescription':{r_sph:-2}}}]},'final-prescription')?.r_sph).toBe(-2);
});

it('reopens a saved order with a text prescription intact', async () => {
  const saved = workspace();
  saved.record = { id: 100, client_id: 1, order_data: { 'final-prescription': { r_sph: 'Balance', l_sph: 0 } } };
  wrap(<LegacyOrderDetailPage mode="view" clientId="1" workspace={saved} />);
  const output = await screen.findByTestId('rx');
  expect(JSON.parse(output.textContent!)).toMatchObject({ r_sph: 'Balance', l_sph: 0 });
});

it('reports the saved order and prescription in the first workspace snapshot after saving', async () => {
  const entry = workspace();
  entry.record = { id: 100, client_id: 1, order_data: { 'final-prescription': { r_sph: -1 } } };
  wrap(<LegacyOrderDetailPage mode="view" clientId="1" workspace={entry} />);
  const handle = await waitFor(() => {
    const ready = entry.register.mock.calls.find((call:any) => call[1]?.ready)?.[1];
    expect(ready).toBeDefined();
    return ready;
  });
  entry.onChange.mockClear();
  const order = { ...entry.record, clinic_id: 7, order_data: { 'final-prescription': { r_sph: -2 } } };
  act(() => handle.applySaved({ order }));
  const firstSnapshot = JSON.parse(entry.onChange.mock.calls[0][1]);
  expect(firstSnapshot.formData.clinic_id).toBe(7);
  expect(firstSnapshot.finalPrescriptionFormData.r_sph).toBe(-2);
});

it.each(['regular', 'contact'])('imports only the prescription from a previous %s order', async kind => {
  fixture.search = { importSourceId: '88', importSourceType: 'order-prescription', ...(kind === 'contact' ? { type: 'contact' } : {}) };
  const source = { id: 88, client_id: 1, type: 'Old type', user_id: 99, dominant_eye: 'left', order_data: {
    'final-prescription': { r_sph: 'Balance', l_sph: 0, r_ad: 2.5 },
    'contact-lens-exam': { r_sph: -3, l_sph: -2.5, r_bc: 8.6 },
    'contact-lens-details': { r_supplier: 'Old supplier', r_price: 900 },
    'keratometer-contact-lens': { r_k1: 42 }, 'schirmer-test': { r_value: 10 },
    'contact-lens-diameters': { r_diameter: 14 },
    details: { notes: 'Old note', order_status: 'Old status' },
    lens_frame_tabs: [{ lens: { r_price: 900 }, frame: { model: 'Old frame' } }],
  } };
  fixture.regularSource.mockResolvedValue(source);
  fixture.contactSource.mockResolvedValue(source);
  const entry = workspace(); entry.kind = kind;
  wrap(<LegacyOrderDetailPage mode="new" clientId="1" workspace={entry} />);
  const output = await screen.findByTestId(kind === 'contact' ? 'contact-rx' : 'rx');
  expect(JSON.parse(output.textContent!)).toMatchObject(kind === 'contact' ? source.order_data['contact-lens-exam'] : source.order_data['final-prescription']);
  expect(kind === 'contact' ? fixture.contactSource : fixture.regularSource).toHaveBeenCalledWith(88);
  expect(kind === 'contact' ? fixture.regularSource : fixture.contactSource).not.toHaveBeenCalled();
  await waitFor(() => expect(entry.register.mock.calls.some((call:any) => call[1]?.ready)).toBe(true));
  const handle = entry.register.mock.calls.filter((call:any) => call[1]?.ready).at(-1)[1];
  const serialized = handle.serialize().order;
  expect(JSON.stringify(serialized)).not.toMatch(/Old note|Old status|Old frame|Old supplier|Old type|900/);
  expect(serialized.user_id).not.toBe(99);
  if (kind === 'contact') {
    expect(serialized.order_data['keratometer-contact-lens']).toMatchObject({ r_k1: 42 });
    expect(serialized.order_data['contact-lens-diameters']).toMatchObject({ r_diameter: 14 });
  }
});

it('imports contact lens prescription data from the latest exam across layout instances', async () => {
  fixture.search = { importSourceId: '99', importSourceType: 'exam', type: 'contact' };
  fixture.instances = [{ instance: { id: 1 }, exam_data: { objective: { r_sph: -9 } } },
    { instance: { id: 2 }, exam_data: { 'contact-lens-exam-card': { card_instance_id: 'card', r_sph: 0, l_sph: -2.5 } } }];
  const entry = workspace(); entry.kind = 'contact';
  wrap(<LegacyOrderDetailPage mode="new" clientId="1" workspace={entry} />);
  const output = await screen.findByTestId('contact-rx');
  expect(JSON.parse(output.textContent!)).toMatchObject({ r_sph: 0, l_sph: -2.5 });
});

it.each(['regular', 'contact'])('blocks a new %s order if its prescription source cannot be loaded', async kind => {
  fixture.search = { importSourceId: '88', importSourceType: 'order-prescription', ...(kind === 'contact' ? { type: 'contact' } : {}) };
  fixture.regularSource.mockResolvedValue(null);
  fixture.contactSource.mockResolvedValue(null);
  const entry = workspace(); entry.kind = kind;
  wrap(<LegacyOrderDetailPage mode="new" clientId="1" workspace={entry} />);
  expect(await screen.findByText(i18n.t('orderGroupLoadError'))).toBeVisible();
  expect(screen.queryByTestId('rx')).toBeNull();
  expect(screen.queryByTestId('contact-rx')).toBeNull();
  expect(entry.register.mock.calls.some((call:any) => call[1]?.ready)).toBe(false);
});
