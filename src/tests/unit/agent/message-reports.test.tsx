import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react';
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
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false }, resources: Object.fromEntries(Object.entries(copy).map(([locale, translation]) => [locale, { translation }])) });
const tool = (id: string, name: string, output: unknown, input = {}) => ({ id, kind: 'tool', type: 'tool-'+name, toolName: name, state: 'output-available', input, output, presentation: {} });
const text = (id: string, value: string) => ({ id, type: 'text', kind: 'text', text: value });
const show = (children: React.ReactNode) => render(<I18nextProvider i18n={i18n}><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{children}</QueryClientProvider></I18nextProvider>);
afterEach(() => { cleanup(); vi.resetAllMocks(); });

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
  it('renders a report after the final answer text, rather than at its tool call', async () => {
    await i18n.changeLanguage('en');
    mock.json.mockResolvedValue({title:'Sales report',status:'completed',download_path:'/api/v1/agent/jobs/report/download'});
    const parts = [text('intro','I am preparing the report.'),tool('export','export_report',{job_id:'report'},{definition:{title:'Sales report'}}),text('final','Here is the final analysis.')];
    const view = show(<ApprovalTimeline {...({parts,message:{id:'answer',role:'assistant',parts,content:'',responseCompletion:{}},isLoading:false} as any)}/>);
    const name = await screen.findByText('Sales report');
    expect(screen.getByText('Here is the final analysis.').compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(view.container.querySelectorAll('[data-report-attachment]')).toHaveLength(1);
    expect(view.container.querySelector('.agent-results')).toBeNull();
  });
  it.each(['en','he','fr'])('shows two named downloads with no ready label in %s', async locale => {
    await i18n.changeLanguage(locale);
    mock.json.mockImplementation((_scope,path) => Promise.resolve({title:path.includes('first')?'Monthly sales':'Payment breakdown',status:'completed',download_path:'/api/v1/agent/jobs/download'}));
    const view = show(<MessageReportResults reports={[{type:'legacy_report',job_id:'first'},{type:'legacy_report',job_id:'second'}]}/>);
    await screen.findByText('Monthly sales');await screen.findByText('Payment breakdown');
    const region = screen.getByLabelText(i18n.t('agent.data.reportAttachments'));
    expect(region).toHaveClass('grid-cols-2');
    expect(within(region).getAllByRole('button')).toHaveLength(2);
    expect(region).not.toHaveTextContent(i18n.t('agent.job.completed'));
    expect(view.container.querySelectorAll('[data-report-attachment]')).toHaveLength(2);
    fireEvent.click(within(region).getAllByRole('button')[0]);
    await waitFor(()=>expect(mock.download).toHaveBeenCalledWith(expect.objectContaining({clinicId:1}),'/api/v1/agent/jobs/download'));
    expect(mock.json.mock.calls.every(([,path])=>path.endsWith('?metadata_only=true'))).toBe(true);
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
