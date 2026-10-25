import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import i18next from 'i18next';
import copy from '@/localization/agent.json';

const mocks = vi.hoisted(() => ({ json: vi.fn(), download: vi.fn() }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => ({ scope: { userId: 1, clinicId: 1, patientId: null } }) }));
vi.mock('@/services/agent-client', () => ({ agentJson: mocks.json, downloadAgentReport: mocks.download }));
vi.mock('@/components/agent/AgentLinks', () => ({ AgentLink: ({ children, href }: any) => <a href={href}>{children}</a> }));
import { AgentDataResults } from '@/components/agent/AgentDataResults';
const i18n = i18next.createInstance();
await i18n.init({ lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false },
  resources: Object.fromEntries(Object.entries(copy).map(([locale, translation]) => [locale, { translation }])) });
afterEach(() => { cleanup(); vi.resetAllMocks(); });
function show(output: unknown) {
  return render(<I18nextProvider i18n={i18n}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <AgentDataResults output={output} />
  </QueryClientProvider></I18nextProvider>);
}
describe('structured search and reports', () => {
  it.each(['en', 'he', 'fr'] as const)('shows original values, differences and source links in %s', async locale => {
    await i18n.changeLanguage(locale);
    const view = show({ type: 'prescription_search', index_ready: true, total: 1, items: [{ client_id: 1,
      client_full_name: 'Synthetic Patient', matches: [{ component_key: 'final-prescription-1', distance: 0.5,
        source_date: '2026-10-01', source: { path: '/clients/1/exams/2' }, eyes: { R: {
          values: { sph: -1, cyl: 0, ax: null, pd: 31, va: '6/6' },
          differences: { sph: { requested: -1.25, recorded: -1, difference: 0.25 } },
        } } }] }] });
    fireEvent.click(screen.getByText('Synthetic Patient'));
    expect(screen.getByRole('link')).toHaveAttribute('href', '/clients/1/exams/2');
    expect(screen.getByText('6/6')).toBeInTheDocument();
    expect(screen.getByText('final-prescription-1')).toBeInTheDocument();
    expect(view.container.textContent).not.toContain('agent.');
  });
  it('pages a snapshot, exports it and saves its definition without rerunning', async () => {
    await i18n.changeLanguage('en');
    const result = { type: 'report_result', status: 'completed', job_id: 'run', columns: ['first_name'],
      rows: [{ first_name: 'First page' }], total: 26, next_offset: 25,
      exports: { xlsx: '/api/v1/agent/reports/run/export?format=xlsx', csv: '/api/v1/agent/reports/run/export?format=csv' },
      definition: { version: 2, dataset: 'clients', title: 'Private report', columns: ['first_name'] } };
    mocks.json.mockImplementation((_scope, path) => Promise.resolve(path.startsWith('/saved-reports') ? { id: 'saved' }
      : path.includes('offset=25') ? { ...result, rows: [{ first_name: 'Second page' }], next_offset: null } : result));
    show({ type: 'report_run', job_id: 'run', status: 'queued' });
    await screen.findByText('First page');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByText('Second page');
    fireEvent.click(screen.getByRole('button', { name: 'CSV' }));
    expect(mocks.download).toHaveBeenCalledWith(expect.objectContaining({ clinicId: 1 }), result.exports.csv);
    fireEvent.click(screen.getByRole('button', { name: 'Save report' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Saved' })).toBeDisabled());
    expect(mocks.json.mock.calls.some(([, path, options]) => path === '/saved-reports' && JSON.parse(options.body).definition.title === 'Private report')).toBe(true);
  });
  it('reports unavailable document coverage explicitly', async () => {
    await i18n.changeLanguage('en');
    show({ type: 'document_search', items: [], total: 0, coverage: { enabled: false, total_files: 3, ready: 0 } });
    expect(screen.getByRole('status')).toHaveTextContent('has not been enabled');
  });
});
