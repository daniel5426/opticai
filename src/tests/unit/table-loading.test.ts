import { describe, expect, it } from 'vitest';
import { tableLoadingRowCount } from '@/lib/table-loading';

describe('table loading row count', () => {
  it('reserves a full page until the total is available', () => {
    for (const total of [null, 0, 31750]) {
      expect(tableLoadingRowCount({ page: 1, pageSize: 25, total })).toBe(25);
    }
    expect(tableLoadingRowCount({ page: 2, pageSize: 50, total: null })).toBe(50);
  });

  it('matches a known partial last page', () => {
    expect(tableLoadingRowCount({ page: 3, pageSize: 25, total: 57 })).toBe(7);
    expect(tableLoadingRowCount({ page: 4, pageSize: 25, total: 57 })).toBe(1);
  });

  it('retains the compact default for unpaginated tables', () => {
    expect(tableLoadingRowCount()).toBe(14);
  });
});
