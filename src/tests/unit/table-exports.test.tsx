import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import i18n from '@/localization/i18n';
import { apiClient } from '@/lib/api-client';
import { TableFiltersBar } from '@/components/table-filters-bar';
import { TableExportProvider } from '@/components/table-export/context';
import { TableExportDialog } from '@/components/table-export/TableExportDialog';
import { exportDatePreset, getExportTask, setExportTask, type ExportSnapshot, type ExportRequest } from '@/lib/table-exports';

vi.mock('@/lib/api-client', () => ({ apiClient: { tableExportFetch: vi.fn() } }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentUser: { id: 1, company_id: 1, role_level: 1 }, currentClinic: { id: 7, name: 'Test clinic' } }) }));
const snapshot: ExportSnapshot = { table: 'clients', clinicId: 7, clinicName: 'Test clinic', sort: 'id_desc', search: 'latest search', filters: [{ key: 'gender', value: 'all', label: 'Gender', options: [{ value: 'all', label: 'All' }, { value: 'נקבה', label: 'Female' }] }] };
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200, headers: { 'Content-Type': 'application/json' } });

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.mocked(apiClient.tableExportFetch).mockReset().mockImplementation(async () => response({ rows: 124 }));
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});
afterEach(() => { cleanup(); setExportTask('test'); setExportTask('1:1:clients:7'); vi.unstubAllGlobals(); });

it('exports full matching results from the current search without changing table filters', async () => {
  const onSearchChange = vi.fn(), onGenderChange = vi.fn();
  render(<TableExportProvider value={{ table: 'clients', clinicId: 7, sort: 'id_desc' }}><TableFiltersBar exportTable="clients" searchValue="latest search" onSearchChange={onSearchChange} filters={[{ key: 'gender', value: 'all', onChange: onGenderChange, placeholder: 'Gender', options: [{ value: 'all', label: 'All' }] }]} actions={<button>New client</button>} /></TableExportProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByLabelText('Search')).toHaveValue('latest search');
  fireEvent.change(within(dialog).getByLabelText('Search'), { target: { value: 'export only' } });
  expect(onSearchChange).not.toHaveBeenCalled();
  expect(onGenderChange).not.toHaveBeenCalled();
  await screen.findByText('124 matching rows · 7 columns');
  const calls = vi.mocked(apiClient.tableExportFetch).mock.calls;
  expect(JSON.parse(calls[calls.length - 1][1]!.body as string)).toMatchObject({ table: 'clients', search: 'export only', clinic_id: 7, sort: 'id_desc' });
  fireEvent.click(screen.getByRole('button', { name: 'Reset to table settings' }));
  expect(within(dialog).getByLabelText('Search')).toHaveValue('latest search');
  fireEvent.keyDown(dialog, { key: 'Escape' });
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Export' })).toHaveFocus();
});

describe.each(['he', 'en', 'fr'] as const)('manual export in %s', locale => {
  it('localizes the dialog and preserves direction with selectable displayed columns', async () => {
    await i18n.changeLanguage(locale);
    render(<TableExportDialog open onOpenChange={vi.fn()} snapshot={snapshot} taskKey="test" />);
    expect(screen.getByRole('dialog')).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    expect(screen.getByRole('heading', { name: i18n.t('tableExport.title', { table: i18n.t('tableExport.table.clients') }) })).toBeInTheDocument();
    const details = document.querySelector('details')!;
    details.open = true;
    const checkbox = screen.getByRole('checkbox', { name: i18n.t('tableExport.column.email') });
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    await screen.findByText(i18n.t('tableExport.summary', { rows: 124, columns: 6 }));
    const calls = vi.mocked(apiClient.tableExportFetch).mock.calls;
    expect(JSON.parse(calls[calls.length - 1][1]!.body as string).columns).not.toContain('email');
  });
});

it('discards stale counts when the filter changes and disables empty exports', async () => {
  let resolveOld: (value: Response) => void = () => {};
  vi.mocked(apiClient.tableExportFetch).mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; })).mockImplementation(async () => response({ rows: 0 }));
  render(<TableExportDialog open onOpenChange={vi.fn()} snapshot={snapshot} taskKey="test" />);
  await waitFor(() => expect(apiClient.tableExportFetch).toHaveBeenCalledTimes(1));
  fireEvent.change(screen.getByLabelText('Search'), { target: { value: 'empty' } });
  await screen.findByText('No matching rows. Adjust the filters.');
  resolveOld(response({ rows: 999 }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled());
  expect(screen.queryByText('999 matching rows · 7 columns')).not.toBeInTheDocument();
});

it('keeps a background export available after the dialog closes and reopens', async () => {
  const job = { id: 'job-1', status: 'running' as const, expired: false, format: 'xlsx' as const, rows: null };
  vi.mocked(apiClient.tableExportFetch).mockImplementation(async path => path === '/count' ? response({ rows: 124 }) : response(job));
  const props = { open: true, onOpenChange: vi.fn(), snapshot, taskKey: 'test' };
  const result = render(<TableExportDialog {...props} />);
  await screen.findByText('124 matching rows · 7 columns');
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  await screen.findByText('Preparing your export…');
  expect(getExportTask('test')?.request.search).toBe('latest search');
  result.unmount();
  render(<TableExportDialog {...props} />);
  expect(screen.getByText('Preparing your export…')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: 'Close' })[0]);
  expect(props.onOpenChange).toHaveBeenCalledWith(false);
  expect(getExportTask('test')?.job.id).toBe('job-1');
});

it('does not add exports to tables without an explicit main-list configuration', () => {
  render(<TableFiltersBar searchValue="" onSearchChange={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
});

it('uses Israel calendar dates for presets across month and DST boundaries', () => {
  expect(exportDatePreset('month', '2026-11-03')).toEqual({ start_date: '2026-11-01', end_date: '2026-11-30' });
  expect(exportDatePreset('last30', '2026-11-03')).toEqual({ start_date: '2026-10-05', end_date: '2026-11-03' });
  expect(exportDatePreset('all', '2026-11-03')).toEqual({ start_date: null, end_date: null });
});

it('offers only valid file formats and submits the selected format', async () => {
  vi.mocked(apiClient.tableExportFetch).mockImplementation(async path => response(path === '/count' ? { rows: 124 } : { id: 'csv-job', status: 'completed', expired: false, format: 'csv', rows: 124 }));
  render(<TableExportDialog open onOpenChange={vi.fn()} snapshot={snapshot} taskKey="test" />);
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'File format' }), { key: 'ArrowDown' });
  const option = await screen.findByRole('option', { name: 'CSV (.csv)' });
  expect(screen.queryByRole('option', { name: 'Clear' })).not.toBeInTheDocument();
  fireEvent.click(option);
  await screen.findByText('124 matching rows · 7 columns');
  fireEvent.click(screen.getByRole('button', { name: 'Export' }));
  await screen.findByText('Your export is ready');
  const creation = vi.mocked(apiClient.tableExportFetch).mock.calls.find(call => call[0] === '');
  expect(JSON.parse(creation![1]!.body as string).format).toBe('csv');
});

it('hides the previous count when an incomplete custom date range is selected', async () => {
  render(<TableExportDialog open onOpenChange={vi.fn()} snapshot={snapshot} taskKey="test" />);
  await screen.findByText('124 matching rows · 7 columns');
  fireEvent.keyDown(screen.getByRole('combobox', { name: 'Date range' }), { key: 'ArrowDown' });
  fireEvent.click(await screen.findByRole('option', { name: 'Custom' }));
  expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  expect(screen.queryByText('124 matching rows · 7 columns')).not.toBeInTheDocument();
  expect(screen.getByText('Enter a valid date range.')).toBeInTheDocument();
});

describe.each(['completed', 'failed'] as const)('reopening a %s export', status => {
  it('preserves a retry and uses current table settings for a fresh export or reset', async () => {
    const request: ExportRequest = { table: 'clients', clinic_id: 7, search: 'previous export', filters: { gender: 'all' }, columns: ['id'], sort: 'id_desc', locale: 'en', format: 'csv', start_date: null, end_date: null, request_key: 'old-key' };
    setExportTask('test', { request, snapshot, job: { id: 'old-job', status, expired: false, format: 'csv', rows: status === 'completed' ? 124 : null } });
    render(<TableExportDialog open onOpenChange={vi.fn()} snapshot={{ ...snapshot, search: 'current table' }} taskKey="test" />);
    fireEvent.click(screen.getByRole('button', { name: status === 'failed' ? 'Try again' : 'Configure another export' }));
    expect(screen.getByLabelText('Search')).toHaveValue(status === 'failed' ? 'previous export' : 'current table');
    if (status === 'failed') {
      expect(screen.getByRole('combobox', { name: 'File format' })).toHaveTextContent('CSV (.csv)');
      fireEvent.click(screen.getByRole('button', { name: 'Reset to table settings' }));
      expect(screen.getByLabelText('Search')).toHaveValue('current table');
    }
    await screen.findByText('124 matching rows · 7 columns');
  });
});
