import { describe, expect, test } from 'vitest';
import { editBillingLineTotal, editBillingSummary } from '@/lib/billing-summary';
import type { Billing, OrderLineItem } from '@/lib/db/schema-interface';

const bill = { id: 1, currency: 'ILS', total_before_discount: 100, discount_amount: 10, total_after_discount: 90 } as Billing;
const items = [{ id: 1, price: 100, quantity: 1, discount: 0, line_total: 100 }] as OrderLineItem[];
describe('summary edits use the existing invoice contract', () => {
  test.each([60, 120, 0])('subtotal %s keeps the original item and adds a signed adjustment', value => {
    const result = editBillingSummary(bill, items, 'total_before_discount', value, 'Adjustment');
    expect(result.items[0]).toEqual(items[0]);
    expect(result.items.reduce((sum, item) => sum + item.line_total!, 0)).toBe(value);
    expect(result.billing.total_after_discount).toBe(Math.max(0, value - 10));
  });
  test.each([0, 75, 100, 150])('total %s reconciles exactly', value => {
    const result = editBillingSummary(bill, items, 'total_after_discount', value, 'Adjustment');
    expect(result.items.reduce((sum, item) => sum + item.line_total!, 0) - result.billing.discount_amount!).toBe(value);
    expect(result.billing.total_after_discount).toBe(value);
  });
  test('paid and installments preserve imported financial amounts', () => {
    expect(editBillingSummary(bill, items, 'prepayment_amount', 70, 'Adjustment')).toEqual({ billing: { ...bill, prepayment_amount: 70 }, items });
  });
});


test.each([0, 75, 100, 125, 350, 100.01])('line total %s reconciles with server-calculated price, quantity and discount', target => {
  const edited = editBillingLineTotal({ ...items[0], quantity: 3 }, target);
  expect(Math.round((edited.price! * edited.quantity! - edited.discount!) * 100) / 100).toBe(target);
  expect(edited.line_total).toBe(target);
  expect(edited.quantity).toBe(3);
});
