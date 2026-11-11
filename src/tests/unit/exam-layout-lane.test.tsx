import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { ExamLayoutLane, examCardColumnOffset, examColumnFromPointer, examColumnPitch } from '@/components/exam/ExamLayoutLane';
import type { GridLayoutItem } from '@/pages/exam-detail/utils';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

test('editor pointer positions follow collapsed gaps and a scrolled row', () => {
  const items: GridLayoutItem[] = [
    {id:'first',type:'notes',x:0,y:0,w:6},
    {id:'second',type:'notes',x:16,y:0,w:6},
  ];
  const {container} = render(<ExamLayoutLane items={items}>
    {(item, _index, style) => <div data-grid-card={item.id} style={style} />}
  </ExamLayoutLane>);
  const lane = container.querySelector<HTMLElement>('[data-exam-lane]')!;
  const cards = lane.querySelectorAll<HTMLElement>('[data-grid-card]');
  vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({left:100} as DOMRect);
  // The saved ten-column gap has collapsed to 16px, and the row is scrolled.
  lane.scrollLeft = 80;
  vi.spyOn(cards[0], 'getBoundingClientRect').mockReturnValue({left:20,right:328} as DOMRect);
  vi.spyOn(cards[1], 'getBoundingClientRect').mockReturnValue({left:344,right:652} as DOMRect);
  expect(examColumnFromPointer(lane, 344, items)).toBe(16);
  expect(examColumnFromPointer(lane, 344 + examColumnPitch() * 2, items)).toBe(18);
  expect(examColumnFromPointer(lane, 336, items)).toBe(11);
  expect(examColumnFromPointer(lane, 668 + examColumnPitch() * 2, items)).toBe(24);
});

test('empty lanes keep placement on the fixed grid after horizontal scrolling', () => {
  const {container} = render(<ExamLayoutLane items={[]} className="p-3">{() => null}</ExamLayoutLane>);
  const lane = container.querySelector<HTMLElement>('[data-exam-lane]')!;
  vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({left:100} as DOMRect);
  lane.style.paddingLeft = '12px';
  expect(examColumnFromPointer(lane, 112 + examColumnPitch() * 8, [])).toBe(8);
});

test('grabbing a compacted card starts the drag at its saved position', () => {
  const item: GridLayoutItem = { id: 'notes', type: 'notes', x: 8, y: 0, w: 12 };
  const { container } = render(<ExamLayoutLane items={[item]}>
    {(card, _index, style) => <div data-grid-card={card.id} style={style} />}
  </ExamLayoutLane>);
  const lane = container.querySelector<HTMLElement>('[data-exam-lane]')!;
  const card = lane.querySelector<HTMLElement>('[data-grid-card]')!;
  const rect = { left: 48, right: 464 } as DOMRect;
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue(rect);
  const clientX = 256;
  const offset = examCardColumnOffset(item, clientX, rect);
  expect(offset * examColumnPitch()).toBeCloseTo(316);
  expect(examColumnFromPointer(lane, clientX, [item]) - offset).toBeCloseTo(item.x);
});
