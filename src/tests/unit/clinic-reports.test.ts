import { describe, expect, it } from 'vitest';
import en from '@/localization/clinic-reports.json';
import {
  type Catalog, TEMPLATES, columnLabel, emptyDraft, fieldLabel, fieldsOf, formatValue, fromDefinition, periodRange, toDefinition,
} from '@/lib/clinic-reports';

const t = (key: string, options: Record<string, unknown> = {}) =>
  String((en.en as Record<string, string>)[key] ?? key).replace(/{{(\w+)}}/g, (_, name) => String(options[name]));
const catalog: Catalog = {
  orders: { fields: { id: 'int', clinic_id: 'int', order_date: 'date', 'order_date.month': 'Decimal', type: 'str',
    'client.first_name': 'str', 'client.age': 'number', 'details.manufacturing_lab': 'str' } },
  billing: { fields: { id: 'int', order_date: 'date', total: 'number', paid: 'number', outstanding: 'number', currency: 'str' } },
};
const today = new Date(2026, 10, 15);

describe('clinic reports', () => {
  it('offers readable fields only, without technical ids or derived keys', () => {
    expect(fieldsOf(catalog, 'orders').map(field => field.key)).toEqual(['id', 'order_date', 'type', 'client.first_name', 'client.age', 'details.manufacturing_lab']);
    expect(fieldLabel(t, 'client.first_name')).toBe('Client First name');
    expect(fieldLabel(t, 'order_date.month')).toBe('Order date – by month');
    expect(fieldLabel(t, 'r_supplier')).toBe('Right supplier');
    expect(columnLabel(t, 'count_id')).toBe('Count');
    expect(columnLabel(t, 'sum_total')).toBe('Sum · Total');
  });

  it('resolves calendar periods', () => {
    expect(periodRange('this_month', today)).toEqual({ start: '2026-11-01', end: '2026-11-30' });
    expect(periodRange('last_month', today)).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(periodRange('this_quarter', today)).toEqual({ start: '2026-10-01', end: '2026-12-31' });
    expect(periodRange('last_12_months', today)).toEqual({ start: '2025-12-01', end: '2026-11-30' });
    expect(periodRange('all', today)).toBeNull();
  });

  it('builds a list definition with dates, typed conditions and export labels', () => {
    const draft = {
      ...emptyDraft('orders', today), columns: ['order_date', 'client.first_name'], match: 'any' as const,
      conditions: [
        { id: 'a', field: 'client.age', operator: 'gte' as const, value: '40' },
        { id: 'b', field: 'type', operator: 'in' as const, value: 'single, progressive' },
        { id: 'c', field: 'type', operator: 'eq' as const, value: '' },
      ],
    };
    expect(toDefinition(draft, t, catalog)).toEqual({
      version: 2, preset: 'custom', dataset: 'orders', title: 'Glasses orders',
      date_field: 'order_date', start_date: '2026-11-01', end_date: '2026-11-30', comparison: true,
      where: { match: 'any', conditions: [{ field: 'client.age', operator: 'gte', value: 40 }, { field: 'type', operator: 'in', value: ['single', 'progressive'] }] },
      columns: ['order_date', 'client.first_name'], sort_by: [],
      presentation: { labels: { order_date: 'Order date', 'client.first_name': 'Client First name' }, charts: [] },
    });
  });

  it('builds a grouped summary with currency, chart and sorting, and reads it back', () => {
    const draft = TEMPLATES.find(template => template.key === 'salesByMonth')!.draft(today);
    const definition = toDefinition({ ...draft, title: 'Sales' }, t, catalog);
    expect(definition).toMatchObject({
      dataset: 'billing', start_date: '2025-12-01', end_date: '2026-11-30', comparison: false,
      group_by: ['order_date.month'], aggregates: [{ field: 'total', operation: 'sum' }, { field: 'paid', operation: 'sum' }],
      sort_by: ['order_date.month'],
      presentation: { charts: [{ kind: 'bar', x: 'order_date.month', series: ['sum_total', 'sum_paid'] }] },
    });
    expect(Object.keys(definition.presentation.labels)).toEqual(['order_date.month', 'currency', 'sum_total', 'sum_paid']);
    const restored = fromDefinition(definition, 'Sales', today);
    expect(restored).toMatchObject({ dataset: 'billing', title: 'Sales', mode: 'summary', period: 'custom', groupBy: ['order_date.month'], chart: 'bar' });
    expect(toDefinition(restored, t, catalog)).toEqual(definition);
  });

  it('formats months, dates and numbers for reading', () => {
    expect(formatValue(202611, 'order_date.month', 'en', t)).toBe('11/2026');
    expect(formatValue('2026-11-03', 'order_date', 'en', t)).toBe('03/11/2026');
    expect(formatValue('2026-11-03T09:30:00', 'paid_at', 'en', t)).toBe('03/11/2026 09:30');
    expect(formatValue(1234.5, 'sum_total', 'en', t)).toBe('1,234.5');
    expect(formatValue(null, 'type', 'en', t)).toBe('—');
    expect(formatValue('female', 'client.gender', 'en', t)).toBe('Female');
  });
});
