import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import copy from '@/localization/agent.json';
const mock = vi.hoisted(() => ({ json: vi.fn(), download: vi.fn() }));
vi.mock('@/services/agent-client', () => ({ agentJson: mock.json, downloadAgentReport: mock.download }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => ({ scope: { userId: 1, clinicId: 1 } }) }));
import { ApprovalTimeline } from '@/components/agent/ApprovalTimeline';
import { reportMessageResults } from '@/components/agent/report-message-results';
import { MessageReportResults } from '@/components/agent/MessageReportResults';
import { ReportChart } from '@/components/agent/ReportChart';
import { AgentReportAttachments } from '@/services/use-agent-report-attachments';
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false }, resources: Object.fromEntries(Object.entries(copy).map(([locale, translation]) => [locale, { translation }])) });
const tool = (id: string, name: string, output: unknown, input = {}) => ({ id, kind: 'tool', type: 'tool-'+name, toolName: name, state: 'output-available', input, output, presentation: {} });
const text = (id: string, value: string) => ({ id, type: 'text', kind: 'text', text: value });
const show = (children: React.ReactNode) => render(<I18nextProvider i18n={i18n}><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider></I18nextProvider>);
const timeline = (parts: unknown[], isFinal: boolean) => <ApprovalTimeline {...({
  parts, message: { id: 'answer', role: 'assistant', parts, content: '', isFinal }, isLoading: !isFinal,
} as any)} />;
afterEach(() => { cleanup(); vi.resetAllMocks(); vi.unstubAllGlobals(); });

describe('reports belong to their assistant response', () => {
  it('deduplicates retained native receipts and preserves named legacy exports', () => {
    const parts = [tool('a','run_report',{type:'report_run',job_id:'same'}, {definition:{title:'Monthly sales'}}),
      tool('b','read_report',{kind:'tool_result',content:JSON.stringify({type:'report_result',job_id:'same',columns:['total']})}),
      tool('c','export_report',{job_id:'legacy'}, {definition:{title:'Older report'}}),
      tool('d','job_status',{id:'legacy',kind:'report',status:'completed'}),
      tool('e','export_report',{kind:'tool_result',content:'{"job_id":'}),
      tool('f','search_records',{type:'record_search',job_id:'unrelated'})];
    const reports = reportMessageResults(parts);
    expect(reports).toHaveLength(2);
    expect(reports[0]).toMatchObject({type:'report_result',job_id:'same'});
    expect(reports[1]).toMatchObject({type:'legacy_report',job_id:'legacy',title:'Older report'});
  });
  it('keeps report UI out of the active response and attaches only downloads after completion', async () => {
    await i18n.changeLanguage('en');
    const id = '11111111-1111-4111-8111-111111111111';
    const other = '22222222-2222-4222-8222-222222222222';
    mock.json.mockResolvedValue({title:'Sales report',status:'completed',report_version:2,download_path:`/api/v1/agent/jobs/${id}/download`});
    const parts = [tool('report','run_report',{type:'report_result',job_id:id,columns:['first_name'],
      rows:[{first_name:'Automatic preview row'}],metrics:[{key:'count_id',current:867}],next_offset:25}),
      text('final', `Here is the final analysis.

- [Repeat CSV](/api/v1/agent/reports/${id}/export?format=csv)
- [Repeat Excel](/api/v1/agent/jobs/${id}/download)

See [another download](/api/v1/agent/jobs/${other}/download).`)];
    const client = new QueryClient();
    const view = render(timeline(parts, false), { wrapper: ({ children }) =>
      <I18nextProvider i18n={i18n}><QueryClientProvider client={client}>{children}</QueryClientProvider></I18nextProvider> });
    expect(screen.queryByLabelText(i18n.t('agent.data.reportAttachments'))).not.toBeInTheDocument();
    expect(mock.json).not.toHaveBeenCalled();
    view.rerender(timeline(parts, true));
    const name = await screen.findByText('Sales report');
    expect(screen.getByText('Here is the final analysis.').compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.container.querySelectorAll('[data-report-attachment]')).toHaveLength(1);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.queryByText('Automatic preview row')).not.toBeInTheDocument();
    expect(screen.queryByText('867')).not.toBeInTheDocument();
    expect(screen.queryByText('Repeat CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Repeat Excel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'another download' })).toBeInTheDocument();
    expect(mock.json.mock.calls.map(([,path]) => path)).toEqual([`/jobs/${id}?metadata_only=true`]);
  });
  it.each(['he','en','fr'])('saves the report and offers scoped CSV/Excel downloads in %s', async locale => {
    await i18n.changeLanguage(locale);
    const user = userEvent.setup();
    const definition = { version: 2, title: 'Monthly sales', dataset: 'orders' };
    mock.json.mockImplementation((_scope,path) => Promise.resolve(path === '/saved-reports' ? {id:'saved'}
      : {title:definition.title,status:'completed',download_path:'/api/v1/agent/jobs/first/download',report_version:2,report_definition:definition}));
    const view = show(<MessageReportResults reports={[{type:'report_result',job_id:'first'}]}/>);
    await screen.findByText(definition.title);
    const region = screen.getByLabelText(i18n.t('agent.data.reportAttachments'));
    expect(within(region).getAllByRole('button')).toHaveLength(2);
    expect(region).not.toHaveTextContent(i18n.t('agent.job.completed'));
    expect(mock.json.mock.calls.every(([,path])=>path.endsWith('?metadata_only=true'))).toBe(true);
    const trigger = within(region).getByRole('button', {name:i18n.t('agent.data.downloadNamed', {name:definition.title})});
    for (const format of ['csv', 'xlsx']) {
      await user.click(trigger);
      const menu = screen.getByRole('menu');
      expect(menu).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
      expect(within(menu).getAllByRole('menuitem')).toHaveLength(2);
      await user.click(within(menu).getByRole('menuitem', {name:i18n.t(`agent.data.exportFormat.${format}`)}));
      await waitFor(() => expect(mock.download).toHaveBeenCalledWith(expect.objectContaining({clinicId:1}),`/api/v1/agent/reports/first/export?format=${format}`));
    }
    await user.click(within(region).getByRole('button', {name:i18n.t('agent.data.save')}));
    expect(await within(region).findByRole('status')).toHaveTextContent(i18n.t('agent.data.saved'));
    expect(mock.json).toHaveBeenCalledWith(expect.objectContaining({clinicId:1}), '/saved-reports', {
      method:'POST',body:JSON.stringify({action:'save',title:definition.title,definition}),
    });
    expect(view.container.querySelectorAll('[data-report-attachment]')).toHaveLength(1);
  });
  it('keeps the original download on retained single-format reports', async () => {
    await i18n.changeLanguage('en');
    mock.json.mockResolvedValue({title:'Older report',status:'completed',download_path:'/api/v1/agent/jobs/legacy/download'});
    show(<MessageReportResults reports={[{type:'legacy_report',job_id:'legacy'}]}/>);
    fireEvent.click(await screen.findByRole('button', {name:'Download Older report'}));
    await waitFor(() => expect(mock.download).toHaveBeenCalledWith(expect.objectContaining({clinicId:1}), '/api/v1/agent/jobs/legacy/download'));
  });
  it('renders explicitly requested report views in the answer without report controls', async () => {
    await i18n.changeLanguage('en');
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    mock.json.mockResolvedValue({status:'completed',report_version:2});
    const output = {type:'report_result',job_id:'first',columns:['week','total'],rows:[{week:'Week one',total:13}],
      metrics:[{key:'count_id',current:867}],charts:[{kind:'bar',x:'week',series:['total'],title:'Weekly totals',rows:[{week:'Week one',total:13}]}]};
    const block = ['```prysm-report', '{"job_id":"first","views":["stats","charts","table"]}', '```'].join('\n');
    const markdownTable = '| A | B |\n| --- | --- |\n| Markdown cell | 5 |';
    show(timeline([tool('run','run_report',output),text('answer', `Selected visuals\n\n${block}\n\n${markdownTable}`)], true));
    expect(await screen.findByText('867')).toBeInTheDocument();
    expect(screen.getByRole('figure', {name:'Weekly totals'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name:'Week one'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name:'Markdown cell'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name:'Next'})).not.toBeInTheDocument();
    expect(screen.queryByText('{"job_id":"first","views":["stats","charts","table"]}')).not.toBeInTheDocument();
  });
  it('recovers a ready report without a model receipt or automatic visuals', async () => {
    await i18n.changeLanguage('en');
    const report = { id: 'recovered', run_id: 'run', title: 'Recovered report', status: 'completed', expired: false,
      report_version: 2, report_format: 'xlsx' as const };
    mock.json.mockResolvedValue({ ...report, download_path: '/api/v1/agent/jobs/recovered/download' });
    show(<AgentReportAttachments.Provider value={new Map([['answer', [report]]])}>
      {timeline([text('failure', 'Analysis was interrupted.')], false)}
    </AgentReportAttachments.Provider>);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Download Recovered report' })).toBeEnabled());
    expect(screen.getByRole('button', { name: 'Save report' })).toBeEnabled();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
  it('orders selected report visuals and omits unselected data', async () => {
    mock.json.mockResolvedValue({ status: 'completed' });
    const output = { type: 'report_result', job_id: 'first', columns: ['week', 'total'], rows: [{ week: 'Hidden week', total: 13 }],
      metrics: [{ key: 'selected', current: 867 }, { key: 'omitted', current: 999 }] };
    const block = '```prysm-report\n{"job_id":"first","views":[{"view":"table","columns":["total"]},{"view":"stats","metrics":["selected"]}]}\n```';
    show(timeline([tool('run', 'run_report', output), text('answer', block)], true));
    const total = await screen.findByRole('cell', { name: '13' });
    expect(total.compareDocumentPosition(screen.getByText('867')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('Hidden week')).not.toBeInTheDocument();
    expect(screen.queryByText('999')).not.toBeInTheDocument();
  });
  it('only renders new structured results selected in the answer', async () => {
    const output = { type: 'record_search', result_ref: 'lookup', total: 2,
      items: [{ values: { name: 'Omitted result' } }, { values: { name: 'Selected result' } }] };
    const block = '```prysm-results\n{"result_ref":"lookup","view":"table","indexes":[1],"columns":["name"]}\n```';
    show(timeline([tool('search', 'search_records', output), text('answer', block)], true));
    expect(await screen.findByRole('cell', { name: 'Selected result' })).toBeInTheDocument();
    expect(screen.queryByText('Omitted result')).not.toBeInTheDocument();
  });
  it('does not enable expired report downloads', async () => {
    mock.json.mockResolvedValue({title:'Expired report',status:'completed',expired:true,download_path:null});
    show(<MessageReportResults reports={[{type:'legacy_report',job_id:'expired'}]}/>);
    await screen.findByText('Expired report');expect(screen.getByRole('button')).toBeDisabled();
  });
  it('does not draw an invalid distribution as a pie chart', async () => {
    await i18n.changeLanguage('en');
    show(<ReportChart chart={{kind:'pie',x:'kind',series:['amount'],rows:[{kind:'Refund',amount:-20}]}} label={value=>value}/>);
    expect(screen.getByRole('status')).toHaveTextContent('non-negative numeric values');
    expect(screen.queryByRole('img')).toBeNull();
  });
});
