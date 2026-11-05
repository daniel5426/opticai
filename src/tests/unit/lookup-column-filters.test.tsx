import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import { ActiveColumnFilters, ColumnFilterControl, ColumnFiltersProvider } from '@/components/column-filter';
import type { ColumnFilters } from '@/lib/column-filters';

vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentUser: { company_id: 1 }, currentClinic: { id: 42, company_id: 1 } }) }));
vi.mock('@/lib/api-client', () => ({ apiClient: {
  getRecordClinics: vi.fn(async () => ({ data: [{ id: 42, name: 'Clinic A' }, { id: 43, name: 'Clinic B' }] })),
  getRecordStaff: vi.fn(async () => ({ data: [{ id: 7, full_name: 'Examiner A' }, { id: 8, full_name: 'Examiner B' }] })),
} }));
vi.mock('@/lib/db/lookup-db', () => ({ lookupTables: { referralType: { getAll: vi.fn(async () => [{ id: 3, name: 'Specialist' }]) } } }));
afterEach(cleanup);

function Harness({ filterKey }: { filterKey: string }) {
  const [filters, setFilters] = React.useState<ColumnFilters>({});
  return <ColumnFiltersProvider filters={filters} onChange={setFilters} definitions={[
    { key: 'clinic', label: i18n.t('companyClients.clinic'), kind: 'text' },
    { key: 'examiner', label: i18n.t('examList.examiner'), kind: 'text' },
    { key: 'type', label: 'Referral type', kind: 'text' },
  ]}><ColumnFilterControl filterKey={filterKey} /><ActiveColumnFilters /><output data-testid="filters">{JSON.stringify(filters)}</output></ColumnFiltersProvider>;
}

describe.each(['he', 'en', 'fr'] as const)('lookup column filters in %s', locale => {
  test.each([
    ['clinic', 'Clinic B', '43'],
    ['examiner', 'Examiner B', '8'],
    ['type', 'Specialist', 'Specialist'],
  ])('%s offers selections and retains the selected value for the API and export', async (key, label, value) => {
    await i18n.changeLanguage(locale);
    render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}><Harness filterKey={key} /></QueryClientProvider>);
    fireEvent.click(screen.getByRole('button'));
    const option = await screen.findByRole('checkbox', { name: label });
    expect(option.closest('[data-radix-popper-content-wrapper]')?.firstElementChild).toHaveAttribute('dir', locale === 'he' ? 'rtl' : 'ltr');
    expect(screen.queryByPlaceholderText(i18n.t('columnFilters.containsPlaceholder'))).not.toBeInTheDocument();
    fireEvent.click(option);
    expect(JSON.parse(screen.getByTestId('filters').textContent || '{}')).toEqual({ [key]: [value] });
    expect(screen.getByRole('group', { name: i18n.t('columnFilters.activeFilters') })).toHaveTextContent(label);
  });
});
