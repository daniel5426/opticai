import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
const mock = vi.hoisted(() => ({ json: vi.fn(), download: vi.fn(), epoch: 0 }));
vi.mock('@/services/agent-client', () => ({ agentJson: mock.json, downloadAgentReport: mock.download }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => ({ jobActivityKey: mock.epoch, runtime: { controller: { activeRunId: null }, submit: vi.fn() } }) }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en', resolvedLanguage: 'en' } }) }));
import { AgentResults } from '@/components/agent/AgentResults';
import { AgentReportHistory } from '@/components/agent/AgentReportHistory';
const scope = { userId: 1, clinicId: 1 };
const job = (id: string, extra = {}) => ({ id, kind: 'report', title: id, status: 'completed', expired: false, can_analyze: false,
  created_at: '2026-10-18T10:00:00Z', updated_at: '2026-10-18T10:01:00Z', expires_at: '2099-10-25T10:00:00Z', download_path: '/download/' + id, ...extra });
let client: QueryClient;
function Mount({ history = false }: { history?: boolean }) {
  return <QueryClientProvider client={client}>{history ? <AgentReportHistory scope={scope} compact={false} /> : <AgentResults scope={scope} />}</QueryClientProvider>;
}
beforeEach(() => { client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } }); mock.json.mockReset();mock.download.mockReset();mock.epoch = 0; });
afterEach(() => { cleanup(); client.clear(); });

describe('report activity and history', () => {
  it('dismisses a card without cancelling/deleting the job and keeps ongoing work after switching chats', async () => {
    let rows = [job('New result'), job('Ongoing', { status: 'running', download_path: null })];
    mock.json.mockImplementation(() => Promise.resolve({items:rows,since:'2026-10-18T10:00:00Z'}));
    const view = render(<Mount />);
    await screen.findByText('New result');
    const result = screen.getByText('New result').closest('li')!;
    fireEvent.click(within(result).getByRole('button', { name: 'agent.dismissJob' }));
    expect(screen.queryByText('New result')).toBeNull();
    expect(mock.json.mock.calls.every(([, path]) => path.startsWith('/jobs/activity'))).toBe(true);
    rows = [job('Ongoing', { status: 'running', download_path: null })];mock.epoch++;
    view.rerender(<Mount />);
    await screen.findByText('Ongoing');expect(screen.queryByText('New result')).toBeNull();
    rows = [job('Ongoing')];
    await act(async () => { await client.invalidateQueries({ queryKey: ['agent-jobs'] }); });
    await waitFor(() => expect(within(screen.getByText('Ongoing').closest('li')!).getByRole('button', { name: 'agent.download' })).toBeEnabled());
    const completed = screen.getByText('Ongoing').closest('li')!;
    fireEvent.click(within(completed).getByRole('button', { name: 'agent.dismissJob' }));
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('fetches history only on opening, paginates, searches, and blocks expired download actions', async () => {
    mock.json.mockImplementation((_scope, path) => {
      const params = new URLSearchParams(path.split('?')[1]);
      if (params.get('q')) return Promise.resolve({ items: [job('Search match')], next_cursor: null });
      return Promise.resolve(params.has('cursor') ? { items: [job('Older report')], next_cursor: null }
        : { items: [job('Recent report'), job('Expired report', { expired: true, original_path: '/old-original' })], next_cursor: 'page-two' });
    });
    render(<Mount history />);expect(mock.json).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'agent.reportHistory' }));
    await screen.findByText('Recent report');
    const expired = screen.getByText('Expired report').closest('li')!;
    expect(within(expired).getByText('agent.job.expired')).toBeVisible();
    expect(within(expired).queryByRole('button')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'agent.more' }));
    await screen.findByText('Older report');
    expect(mock.json.mock.calls.some(([, path]) => path.includes('cursor=page-two'))).toBe(true);
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'invoice' } });
    await screen.findByText('Search match');
    expect(screen.queryByText('Older report')).toBeNull();
    expect(mock.json.mock.calls.some(([, path]) => path.includes('q=invoice'))).toBe(true);
  });

  it('offers a retry when history loading fails', async () => {
    mock.json.mockRejectedValueOnce(new Error('Offline')).mockResolvedValue({ items: [], next_cursor: null });
    render(<Mount history />);fireEvent.click(screen.getByRole('button', { name: 'agent.reportHistory' }));
    await screen.findByRole('alert');fireEvent.click(screen.getByRole('button', { name: 'agent.retry' }));
    await waitFor(() => expect(screen.getByText('agent.noReports')).toBeVisible());
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
