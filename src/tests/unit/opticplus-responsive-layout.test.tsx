import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ExamLayoutRenderer } from '@/components/exam/ExamLayoutRenderer';

vi.mock('@/components/exam/ExamCardRenderer', () => ({
  ExamCardRenderer: ({item}: {item: {id: string}}) => <input aria-label={item.id} defaultValue="source" />,
  hasNoteCard: () => false,
  getColumnCount: () => 6,
}));
afterEach(() => {cleanup(); vi.unstubAllGlobals();});

test('pane resizing preserves imported card widths, rows and unsaved input', () => {
  const props = {
    cardRows: [], customWidths: {}, gridItems: [
      {id:'measurement', type:'opticplus-measurements', x:0, y:0, w:6},
      {id:'ocular', type:'opticplus-ocular-health', x:0, y:1, w:8},
      {id:'questionnaire', type:'opticplus-questionnaire', x:8, y:1, w:8},
    ], detailProps: {}, activeCoverTestTabs: {}, computedCoverTestTabs: {},
    activeOldRefractionTabs: {}, computedOldRefractionTabs: {}, activeOldRefractionExtensionTabs: {}, computedOldRefractionExtensionTabs: {},
  } as unknown as React.ComponentProps<typeof ExamLayoutRenderer>;
  const view = render(<div style={{width:1600}}><ExamLayoutRenderer {...props} /></div>);
  const input = screen.getByLabelText('measurement');
  fireEvent.change(input, {target:{value:'unsaved edit'}});
  const width = input.parentElement!.parentElement!.style.width;
  expect(width).toBeTruthy();
  view.rerender(<div style={{width:720}}><ExamLayoutRenderer {...props} /></div>);
  expect(screen.getByLabelText('measurement')).toBe(input);
  expect((input as HTMLInputElement).value).toBe('unsaved edit');
  expect(input.parentElement!.parentElement!.style.width).toBe(width);
  view.rerender(<div style={{width:1600}}><ExamLayoutRenderer {...props} /></div>);
  expect(input.parentElement!.parentElement!.style.width).toBe(width);
  expect(screen.getAllByRole('textbox')).toHaveLength(3);
  view.unmount();
});
