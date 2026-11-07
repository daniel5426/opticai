import React from 'react';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/localization/i18n';
import { TrashTab } from '@/components/settings/TrashTab';
import type { TrashItem } from '@/lib/trash';

const api = vi.hoisted(() => ({
  getTrash: vi.fn(),
  getTrashCounts: vi.fn(),
  getUsersByClinic: vi.fn(),
  getClinicsByCompany: vi.fn(),
  restoreTrashItem: vi.fn(),
}));
vi.mock('@/lib/api-client', () => ({ apiClient: api }));

const item = (overrides: Partial<TrashItem>): TrashItem => ({
  id: 1,
  clinic_id: 69,
  root_entity_type: 'client',
  root_entity_id: 10,
  display_label: 'Ada Lovelace',
  client_id: 10,
  client_label: 'Ada Lovelace',
  deleted_by_user_id: 1,
  deleted_by: 'Worker',
  deleted_at: '2026-11-01T10:00:00Z',
  expires_at: '2026-12-01T10:00:00Z',
  status: 'trashed',
  included_counts: { client: 1 },
  warnings: [],
  ...overrides,
});

const client = item({});
const exam = item({ id: 2, root_entity_type: 'exam', root_entity_id: 20, display_label: 'Annual exam', client_label: 'Ada L.' });

const renderTab = () => render(
  <QueryClientProvider client={new QueryClient()}>
    <TrashTab currentClinic={{ id: 69, name: 'Clinic' } as never} currentUser={{ id: 1, role_level: 2 } as never} />
  </QueryClientProvider>,
);

beforeEach(async () => {
  await i18n.changeLanguage('he');
  api.getUsersByClinic.mockResolvedValue({ data: [] });
  api.getTrashCounts.mockResolvedValue({ data: { client: 1, exam: 1 } });
  api.getTrash.mockImplementation(async ({ entityType }: { entityType?: string }) => {
    const items = [client, exam].filter(row => !entityType || row.root_entity_type === entityType);
    return { data: { items, total: items.length, limit: 25, offset: 0 } };
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('Trash tabs by item type', () => {
  it('shows a tab with a count for every item type', async () => {
    renderTab();
    const tabs = await screen.findByRole('tablist');
    await within(tabs).findByRole('tab', { name: /הכל\s*2/ });
    expect(within(tabs).getByRole('tab', { name: /לקוחות\s*1/ })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: /בדיקות\s*1/ })).toBeInTheDocument();
    expect(within(tabs).getByRole('tab', { name: /קבצים\s*0/ })).toBeInTheDocument();
    expect(within(tabs).getAllByRole('tab')).toHaveLength(10);
    expect(await screen.findByText('Annual exam')).toBeInTheDocument();
  });

  it('lists only the selected type and hides the redundant type column', async () => {
    renderTab();
    await screen.findByText('Annual exam');
    await userEvent.click(screen.getByRole('tab', { name: /בדיקות/ }));
    await waitFor(() => expect(api.getTrash).toHaveBeenLastCalledWith(expect.objectContaining({ entityType: 'exam', clinicId: 69 })));
    await waitFor(() => expect(screen.queryByText('Ada Lovelace')).toBeNull());
    expect(screen.getByText('Annual exam')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'סוג' })).toBeNull();
    expect(api.getTrashCounts).toHaveBeenLastCalledWith(expect.not.objectContaining({ entityType: expect.anything() }));
  });

  it('shows a type-specific empty state', async () => {
    renderTab();
    await screen.findByText('Annual exam');
    await userEvent.click(screen.getByRole('tab', { name: /קבצים/ }));
    expect(await screen.findByText('אין קבצים שנמחקו לפי הסינון הנוכחי')).toBeInTheDocument();
  });
});
