import type { Billing, OrderLineItem } from './db/schema-interface';
import { billingLineOffsets, recalculateLineBilling } from './discounts';

const money = (value: number) => Math.round(value * 100) / 100;

// Keep summary edits representable by the existing item/discount API.
export function editBillingSummary(billing: Billing, items: OrderLineItem[], field: string, value: number, adjustmentLabel: string) {
  if (value === Number(billing[field as keyof Billing] || 0)) return { billing, items };
  const subtotal = Number(billing.total_before_discount) || 0;
  const discount = Number(billing.discount_amount) || 0;
  const offsets = billingLineOffsets(billing, items);
  const sum = items.reduce((total, item) => total + (Number(item.line_total) || 0), 0);
  const rawSubtotal = sum + offsets.subtotalOffset;
  const beforeHeaderDiscount = sum + offsets.totalOffset;
  let nextItems = items;
  let nextBilling = { ...billing };
  if (field === 'total_before_discount' || field === 'total_after_discount') {
    const delta = money(field === 'total_before_discount' ? value - rawSubtotal : Math.max(0, value - beforeHeaderDiscount));
    if (delta) nextItems = [...items, {
      id: -(Math.max(0, ...items.map(item => Math.abs(item.id || 0))) + 1),
      billings_id: billing.id || 0, description: adjustmentLabel, currency: billing.currency || 'ILS',
      price: Math.max(0, delta), quantity: 1, discount: Math.max(0, -delta), line_total: delta,
    }];
    nextBilling.discount_amount = field === 'total_after_discount' ? money(Math.max(0, beforeHeaderDiscount + delta - value)) : Math.min(discount, value);
    nextBilling.discount_percent = 0;
  } else if (field === 'discount_amount') nextBilling.discount_amount = Math.min(value, subtotal);
  else if (field === 'discount_percent') nextBilling.discount_amount = money(subtotal * Math.min(value, 100) / 100);
  else return { billing: { ...billing, [field]: value }, items };
  nextBilling = recalculateLineBilling(nextBilling, nextItems, billing, items);
  nextBilling.discount_percent = nextBilling.total_before_discount ? money((nextBilling.discount_amount || 0) / nextBilling.total_before_discount * 100) : 0;
  return { billing: nextBilling, items: nextItems };
}


// Represent a directly edited line total with the existing unit-price/discount fields.
export function editBillingLineTotal(item: OrderLineItem, total: number): OrderLineItem {
  const target = Math.max(0, money(total));
  const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
  let price = Number(item.price) || 0;
  if (money(price * quantity) < target) price = Math.ceil((target + (Number(item.discount) || 0)) / quantity * 100) / 100;
  const discount = Math.max(0, money(price * quantity - target));
  return { ...item, quantity, price, discount, line_total: target, manually_edited: true };
}
