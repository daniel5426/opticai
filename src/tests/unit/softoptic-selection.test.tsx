import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/localization/i18n';
import copy from '@/localization/softoptic.json';
import { SoftOpticMigrationTab } from '@/components/settings/SoftOpticMigrationTab';

vi.mock('@/lib/api-client', () => ({apiClient: {
  listMigrationImports: vi.fn(async () => ({data: []})),
}}));

afterEach(() => { cleanup(); window.localStorage.clear(); vi.restoreAllMocks(); });

test.each(['he', 'en', 'fr'] as const)('single-client selection uses %s copy and layout', async language => {
  await i18n.changeLanguage(language);
  const scan = vi.fn(async () => ({supported: true, candidates: [
    {id: 'rrdb', kind: 'dsn', label: 'RRDB', dsn: 'RRDB', score: 1, recommended: true, reasons: []},
  ]}));
  const start = vi.fn(async () => ({success: false, error: 'softoptic.clientNotFound'}));
  const previous = window.electronAPI;
  window.electronAPI = {migrationScan: scan, migrationStartExport: start} as any;
  try {
    const {container} = render(<SoftOpticMigrationTab clinicId={7} />);
    const input = screen.getByLabelText(copy[language].clientNumber);
    expect(container.querySelector('[dir]')?.getAttribute('dir')).toBe(language === 'he' ? 'rtl' : 'ltr');
    expect(input.getAttribute('dir')).toBe('ltr');
    expect(screen.getByText(copy[language].clientNumberHint)).toBeTruthy();
    fireEvent.change(input, {target: {value: '23470'}});
    expect(screen.getByPlaceholderText('ללא מגבלה')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'סרוק מחשב'}));
    await waitFor(() => expect(scan).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', {name: /ייבוא נתונים בלבד/}));
    fireEvent.click(screen.getByRole('button', {name: 'ייצא נתונים'}));
    await waitFor(() => expect(start).toHaveBeenCalledWith(expect.objectContaining({clientAccountCode: '23470', clientImportLimit: null})));
    expect(await screen.findByText(copy[language].clientNotFound)).toBeTruthy();
  } finally { window.electronAPI = previous; }
});

test('a failed job remains resumable after reopening the migration tab', async () => {
  const {apiClient} = await import('@/lib/api-client');
  vi.spyOn(apiClient, 'listMigrationImports').mockResolvedValueOnce({data: [{
    id: 'failed-job', status: 'failed', progress: 42, step: 'Client import', error: 'softoptic.workerExited',
    source_metadata: {client_account_code: '23470'},
  }]} as any);
  await i18n.changeLanguage('en');
  render(<SoftOpticMigrationTab clinicId={7} />);
  expect(await screen.findByText(copy.en.workerExited)).toBeTruthy();
  expect(screen.getByRole('button', {name: 'המשך'})).toBeEnabled();
  expect(screen.getByLabelText(copy.en.clientNumber)).toHaveValue('23470');
  expect(screen.getByLabelText(copy.en.clientNumber)).toBeDisabled();
});
