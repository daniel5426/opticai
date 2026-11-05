import React from 'react';
import '@/localization/i18n';
import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { ColumnFiltersProvider } from '@/components/column-filter';
import { TableExportContext } from '@/components/table-export/context';
afterEach(cleanup);
function Snapshot() {
  const value = React.useContext(TableExportContext);
  return <output>{value?.columnFilters}</output>;
}
test('export snapshots inherit the exact active column filters', () => {
  const filters = { first_name: 'Dana', gender: ['נקבה'] };
  render(<TableExportContext.Provider value={{table:'clients',sort:'id_desc'}}><ColumnFiltersProvider filters={filters} definitions={[]} onChange={() => {}}><Snapshot /></ColumnFiltersProvider></TableExportContext.Provider>);
  expect(JSON.parse(screen.getByRole('status').textContent || '{}')).toEqual(filters);
});
