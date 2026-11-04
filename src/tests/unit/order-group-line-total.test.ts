import { describe, expect, it } from 'vitest';
import { groupLineTotal } from '@/lib/order-groups';

describe('groupLineTotal', () => {
  it('lets a priceless line lower the deal by its discount', () => {
    expect(groupLineTotal(0, 1, 100)).toBe(-100);
    expect(groupLineTotal(0, 1, 0)).toBe(0);
    expect(Object.is(groupLineTotal(0, 1, 0), -0)).toBe(false);
  });

  it('keeps a priced line from going below zero', () => {
    expect(groupLineTotal(50, 2, 30)).toBe(70);
    expect(groupLineTotal(50, 1, 80)).toBe(0);
  });
});
