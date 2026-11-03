vi.mock('@/contexts/UserContext', () => ({useUser:() => ({currentClinic:{id:5}})}));
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/localization/i18n';
const mock = vi.hoisted(() => ({json:vi.fn()}));
vi.mock('@/contexts/PrysmAgentContext', () => ({usePrysmAgent:() => ({available:true, scope:{userId:1, clinicId:5}})}));
vi.mock('@/services/agent-client', () => ({agentJson:mock.json}));
vi.mock('@/lib/api-client', () => ({apiClient:{getInventoryVariants:vi.fn()}}));
import { SupplyReview, PreviousSupplyImports } from '@/components/inventory/SupplyIntake';
import { ManualInventoryImportDialog } from '@/components/inventory/ManualInventoryImport';
import { ApprovalTimeline } from '@/components/agent/ApprovalTimeline';
const proposal = {status:'prepared', operation:'prices', revision:'review-one', rows:[{id:'0', values:{category:'frame', brand:'Demo', model:'A', default_retail:120}, variant_id:7, source:{row:2}, selected:true, errors:[], action:'update', before:{display_name:'Demo A', default_retail:100}}]};
function mount(children:React.ReactNode) {return render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><I18nextProvider i18n={i18n}>{children}</I18nextProvider></QueryClientProvider>);}
beforeEach(() => {mock.json.mockReset().mockResolvedValue({id:'job', status:'completed', result:proposal});});
afterEach(cleanup);
describe.each(['he','en','fr'])('supply review in %s', locale => {
  it('shows before/after and requires revalidation after an edit', async () => {
    await i18n.changeLanguage(locale); const view = mount(<SupplyReview jobId="job" />);
    const apply = await screen.findByRole('button', {name:i18n.t('supply.apply')});
    expect(view.container.querySelector('input')).not.toBeNull();
    fireEvent.click(view.container.querySelector("summary")!);
    expect(screen.getByText(i18n.t('supply.before') + ': 100')).toBeVisible();
    fireEvent.change(screen.getByLabelText(i18n.t('supply.field.default_retail')), {target:{value:'130'}});
    expect(apply).toBeDisabled();
    mock.json.mockImplementation(async (_scope, path, options) => path.endsWith('/review') ? {...JSON.parse(options.body), revision:'review-two'} : {id:'job', status:'completed', result:{...proposal, revision:'review-two'}});
    fireEvent.click(screen.getByRole('button', {name:i18n.t('supply.validate')}));
    await waitFor(() => expect(apply).toBeEnabled());
    mock.json.mockImplementation(async (_scope, path) => path.endsWith('/apply') ? {...proposal, status:'committed', applied:[{variant_id:7}]} : {id:'job', status:'completed', result:{...proposal,status:'committed',applied:[{variant_id:7}]}});
    fireEvent.click(apply);
    await screen.findByText(i18n.t('supply.appliedCount', {count:1}));
    const request = mock.json.mock.calls.find(call => call[1].endsWith('/apply'));
    expect(JSON.parse(request![2].body)).toEqual({revision:'review-two'});
  });
  it('renders localized intake with intentional direction', async () => {
    await i18n.changeLanguage(locale); mount(<ManualInventoryImportDialog open onOpenChange={() => {}} onFinished={() => {}} />);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    expect(screen.getByLabelText(i18n.t('supply.file'))).toHaveAttribute('accept', '.csv,.xlsx,.xls');
    expect(screen.getByRole('button', {name:i18n.t('supply.manual.template')})).toBeVisible();
    expect(mock.json).not.toHaveBeenCalled();
  });
});

it.each(['he','en','fr'])('explains insufficient AI credits and shows a safe support reference in %s', async locale => {
  await i18n.changeLanguage(locale);
  mock.json.mockResolvedValue({id:'job', status:'failed', result:{platform_failure:{
    code:'BILLING_CREDITS_INSUFFICIENT',failure_id:'1491be5d-ebaf-4f3f-9a3a-6afc1ac91b69',retryable:false,
  }}});
  mount(<SupplyReview jobId="job" />);
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('supply.creditsRequired'));
  expect(screen.getByText('1491be5d-ebaf-4f3f-9a3a-6afc1ac91b69')).toHaveAttribute('dir','ltr');
  expect(screen.queryByRole('button',{name:i18n.t('supply.apply')})).toBeNull();
});

it.each([403, 404, 410])('renders a failed proposal fetch inline (%s)', async status => {
  await i18n.changeLanguage('en'); mock.json.mockRejectedValue(Object.assign(new Error(), {status}));
  mount(<SupplyReview jobId="denied" />);
  const key = status === 403 ? 'supply.permissionDenied' : status === 410 ? 'supply.expired' : 'supply.unavailable';
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t(key));
  expect(screen.queryByRole('button', {name:i18n.t('supply.apply')})).toBeNull();
});
it('requires a reload after stale inventory and renders the persisted applied result on restoration', async () => {
  await i18n.changeLanguage('en'); mount(<SupplyReview jobId="job" />);
  const apply = await screen.findByRole('button', {name:i18n.t('supply.apply')});
  mock.json.mockRejectedValueOnce(Object.assign(new Error(), {status:409}));
  fireEvent.click(apply);
  expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('supply.stale'));
  expect(apply).toBeDisabled();
  mock.json.mockResolvedValue({id:'job',status:'completed',result:{...proposal,status:'committed',applied:[{variant_id:7}]}});
  fireEvent.click(screen.getByRole('button',{name:i18n.t('supply.reload')}));
  await screen.findByText(i18n.t('supply.appliedCount',{count:1}));
});
it('paginates editable proposals without changing the row index', async () => {
  await i18n.changeLanguage('en');
  mock.json.mockResolvedValue({id:'job',status:'completed',result:{...proposal,rows:Array.from({length:26},(_,index)=>({...proposal.rows[0],id:String(index),values:{...proposal.rows[0].values,model:'Row '+index}}))}});
  mount(<SupplyReview jobId="job" />);
  await screen.findByText(/Row 0/); expect(screen.queryByText(/Row 25/)).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:i18n.t('orderGroupNext')}));
  expect(screen.getByText(/Row 25/)).toBeVisible();
  fireEvent.change(screen.getByLabelText(i18n.t('supply.field.model')),{target:{value:'Edited last'}});
  mock.json.mockResolvedValue({...proposal,rows:[]});
  fireEvent.click(screen.getByRole('button',{name:i18n.t('supply.validate')}));
  await waitFor(()=>expect(mock.json.mock.calls.some(call=>call[1].endsWith('/review'))).toBe(true));
  const sent=JSON.parse(mock.json.mock.calls.find(call=>call[1].endsWith('/review'))![2].body);
  expect(sent.rows[25].values.model).toBe('Edited last'); expect(sent.rows[0].values.model).toBe('Row 0');
});
it('recovers legacy imports inline without a dialog', async () => {
  await i18n.changeLanguage('en');
  mock.json.mockImplementation(async (_scope,path)=>path.includes('legacy_only')?[{id:'legacy',title:'Previous Excel'}]:{id:'legacy',status:'completed',result:proposal});
  mount(<PreviousSupplyImports />);
  const summary=screen.getByText(i18n.t('supply.previousImports'));
  fireEvent.click(summary);
  fireEvent.click(await screen.findByRole('button',{name:'Previous Excel'}));
  await screen.findByRole('button',{name:i18n.t('supply.apply')});
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('restores and deduplicates inline supply cards from retained tool receipts', async () => {
  await i18n.changeLanguage('en');
  const part = {id:'tool',kind:'tool',type:'tool-prepare_supply',toolName:'prepare_supply',presentation:{},state:'output-available',output:{kind:'tool_result',content:JSON.stringify({job_id:'job'})}};
  const view=mount(<ApprovalTimeline {...({message:{id:'message',role:'assistant',responseCompletion:'completed'},parts:[part,{...part,id:'duplicate'}],responseProps:{}} as any)} />);
  await screen.findByRole('button',{name:i18n.t('supply.apply')});
  expect(view.container.querySelectorAll('[data-supply-proposal="job"]')).toHaveLength(1);
  expect(screen.queryByRole('dialog')).toBeNull();
});
