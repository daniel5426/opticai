import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExamLayoutRenderer } from '@/components/exam/ExamLayoutRenderer';

vi.mock('@/components/exam/ExamCardRenderer', () => ({
  ExamCardRenderer: ({item}: {item: {id: string}}) => <input aria-label={item.id} defaultValue="source" />,
  hasNoteCard: () => false,
  getColumnCount: () => 6,
}));
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

test('pane resizing reflows cards without a window resize, remount or loss of unsaved input', () => {
  let resize: ResizeObserverCallback;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: ResizeObserverCallback) {resize = callback;}
    observe() {}
    disconnect = disconnect;
  });
  const props = {
    cardRows: [], customWidths: {}, gridItems: [
      {id:'measurement', type:'opticplus-measurements', x:0, y:0, w:6},
      {id:'ocular', type:'opticplus-ocular-health', x:0, y:1, w:8},
      {id:'questionnaire', type:'opticplus-questionnaire', x:8, y:1, w:8},
    ], detailProps: {}, activeCoverTestTabs: {}, computedCoverTestTabs: {},
    activeOldRefractionTabs: {}, computedOldRefractionTabs: {}, activeOldRefractionExtensionTabs: {}, computedOldRefractionExtensionTabs: {},
  } as unknown as React.ComponentProps<typeof ExamLayoutRenderer>;
  const view = render(<ExamLayoutRenderer {...props} />);
  const setWidth = (width: number) => act(() => resize!([{contentRect:{width}} as ResizeObserverEntry], {} as ResizeObserver));
  setWidth(1600);
  const input = screen.getByLabelText('measurement');
  fireEvent.change(input, {target:{value:'unsaved edit'}});
  expect(input.closest('[style*="grid-column"]')?.getAttribute('style')).toContain('span 6');
  setWidth(720);
  expect(screen.getByLabelText('measurement')).toBe(input);
  expect((input as HTMLInputElement).value).toBe('unsaved edit');
  expect(input.closest('[style*="grid-column"]')?.getAttribute('style')).toContain('span 24');
  setWidth(1600);
  expect(input.closest('[style*="grid-column"]')?.getAttribute('style')).toContain('span 6');
  expect(screen.getAllByRole('textbox')).toHaveLength(3);
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});
