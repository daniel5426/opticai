import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExamGridLayout } from '@/components/exam/ExamGridLayout';

afterEach(() => {cleanup();vi.unstubAllGlobals();});
const items=[{id:'first',type:'notes',x:0,y:0,w:12},{id:'second',type:'notes',x:12,y:2,w:12}];

test('imported packing follows measured heights without remounting edited fields', () => {
  let resize: ResizeObserverCallback;
  const observed: Element[]=[];
  vi.stubGlobal('ResizeObserver',class {constructor(callback:ResizeObserverCallback){resize=callback;} observe(element:Element){observed.push(element);} disconnect(){}});
  const {container}=render(<ExamGridLayout compact items={items} renderItem={item=><input aria-label={item.id} defaultValue="source" />} />);
  fireEvent.change(screen.getByLabelText('first'),{target:{value:'edited'}});
  act(() => {resize!(observed.map((target,index) => {vi.spyOn(target,'getBoundingClientRect').mockReturnValue({height:index ? 340 : 120} as DOMRect);return {target} as ResizeObserverEntry;}),{} as ResizeObserver);});
  const first=screen.getByLabelText('first');
  expect((first as HTMLInputElement).value).toBe('edited');
  expect(first.closest('[style*="grid-row"]')?.getAttribute('style')).toContain('span 136');
  expect(container.firstElementChild?.getAttribute('style')).toContain('row dense');
  expect(container.querySelector('[style*="min-height"]')).toBeNull();
});

test('ordinary layouts preserve saved rows, columns and explicit empty lanes', () => {
  const {container}=render(<ExamGridLayout items={items} renderItem={item=><span>{item.id}</span>} />);
  expect(screen.getByText('second').closest('[style*="grid-row"]')?.getAttribute('style')).toContain('grid-row: 3');
  expect(container.querySelector('[style*="min-height"]')).toBeTruthy();
});
