import { afterEach, expect, it, vi } from 'vitest';
import { affectedQuery, affectsFamily, notifyRecordWrite, RECORDS_CHANGED } from '@/lib/record-changes';

afterEach(() => vi.useRealTimers());

it('invalidates only the affected patient section in the current company', () => {
  const change = {family: 'orders' as const, ids:[4], clientIds:[2,3]};
  expect(affectedQuery(['client',2,7,'orders'],change,7)).toBe(true);
  expect(affectedQuery(['client',3,7,'orders-context'],change,7)).toBe(true);
  expect(affectedQuery(['client',4,7,'orders'],change,7)).toBe(false);
  expect(affectedQuery(['client',2,8,'orders'],change,7)).toBe(false);
  expect(affectedQuery(['client',2,7,'exams'],change,7)).toBe(false);
  expect(affectedQuery(['users',7],change,7)).toBe(false);
  expect(affectedQuery(['order-groups',8],change,7)).toBe(false);
});

it('coalesces a logical write and retains all order participants and the payer', () => {
  vi.useFakeTimers();
  const events: CustomEvent[] = [];
  const handler = (event: Event) => events.push(event as CustomEvent);
  window.addEventListener(RECORDS_CHANGED,handler);
  notifyRecordWrite('/order-groups/4',{method:'PUT',body:JSON.stringify({entries:[{order:{client_id:2}}]})}, {id:4,payer_client_id:3,clients:[{id:2},{id:3}]});
  notifyRecordWrite('/order-groups/4',{method:'PUT'}, {id:4,payer_client_id:3});
  expect(events).toHaveLength(0);
  vi.runAllTimers();
  expect(events).toHaveLength(1);
  expect(events[0].detail).toEqual({family:'orders',ids:[4],clientIds:[3,2]});
  expect(affectsFamily(events[0],'exams')).toBe(false);
  expect(affectsFamily(events[0],'orders')).toBe(true);
  window.removeEventListener(RECORDS_CHANGED,handler);
});

it('keeps old restore notifications functional and does not invalidate unrelated exam pages', () => {
  expect(affectsFamily(new Event(RECORDS_CHANGED),'files')).toBe(true);
  const change = {family:'exams' as const,ids:[9],clientIds:[2]};
  expect(affectedQuery(['exam-page-data',9],change)).toBe(true);
  expect(affectedQuery(['exam-page-data',10],change)).toBe(false);
});
