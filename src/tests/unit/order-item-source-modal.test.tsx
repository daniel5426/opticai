import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';

vi.mock('@/lib/prescription-sources', () => ({
  loadOrders: vi.fn(async () => [
    { id: 7, type: 'רחוק', order_date: '2026-03-01', order_data: { lens_frame_tabs: [{ frame: { manufacturer: 'Ray-Ban', model: 'RB5048', color: 'שחור', width: 52, bridge: 18 } }] } },
    { id: 8, type: 'קריאה', order_date: '2025-01-01', order_data: { lens_frame_tabs: [{ frame: { order_id: 0 } }] } },
    { id: 9, type: 'נוכחית', order_date: '2026-05-01', order_data: {} },
  ]),
}));

import { OrderItemSourceModal } from '@/components/orders/OrderItemSourceButton';

afterEach(cleanup);

it('lists earlier orders with their frame, notes the ones without, and fills from a chosen one', async () => {
  await i18n.changeLanguage('he');
  const onSelect = vi.fn();
  render(<OrderItemSourceModal isOpen onClose={() => {}} source={{ clientId: 1, orderId: 9 }} kind="frame" onSelect={onSelect} />);
  expect(await screen.findByText('Ray-Ban · RB5048 · שחור')).toBeTruthy();
  expect(screen.getByText('52-18')).toBeTruthy();
  expect(screen.getByText('אין בהזמנה זו פרטי מסגרת')).toBeTruthy();
  expect(screen.queryByText('נוכחית')).toBeNull();
  const empty = screen.getByText('קריאה').closest('button')!;
  expect(empty.disabled).toBe(true);
  fireEvent.click(screen.getByText('רחוק').closest('button')!);
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ manufacturer: 'Ray-Ban', width: '52', bridge: '18', height: '' }));
});
