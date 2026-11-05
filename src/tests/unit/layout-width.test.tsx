import React, { useState } from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import i18n from '@/localization/i18n';
import { CenteredLayoutWidth } from '@/components/exam/CenteredLayoutWidth';
import { parseLayoutData, serializeGridLayoutData } from '@/pages/exam-detail/utils';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('layout width round trips without changing cards and old layouts remain full width', () => {
  const items = [{ id: 'notes', type: 'notes' as const, x: 0, y: 0, w: 12 }];
  const saved = serializeGridLayoutData(items, 24, { sideInsetPx: 84, layoutWidthPx: 1200 });
  expect(parseLayoutData(saved).sideInsetPx).toBe(84);
  expect(parseLayoutData(saved).layoutWidthPx).toBe(1200);
  expect(parseLayoutData(saved).items).toEqual(parseLayoutData(serializeGridLayoutData(items)).items);
  for (const sideInsetPx of [-20, '80', null]) {
    expect(parseLayoutData(JSON.stringify({ ...JSON.parse(saved), sideInsetPx })).sideInsetPx).toBe(0);
  }
  expect(parseLayoutData('[]').sideInsetPx ?? 0).toBe(0);
  expect(parseLayoutData(serializeGridLayoutData(items)).sideInsetPx ?? 0).toBe(0);
});

test.each(['he', 'en', 'fr'])('either edge changes one centered width and Home restores it in %s', async locale => {
  await i18n.changeLanguage(locale);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  function Preview() {
    const [width, setWidth] = useState<number>();
    return <CenteredLayoutWidth layoutWidthPx={width} onChange={setWidth}><div>Cards</div></CenteredLayoutWidth>;
  }
  const { container } = render(<Preview />);
  const left = screen.getByRole('separator', { name: i18n.t('examPreview.resizeLeft') });
  const right = screen.getByRole('separator', { name: i18n.t('examPreview.resizeRight') });
  fireEvent.keyDown(left, { key: 'ArrowRight', shiftKey: true });
  expect(left.getAttribute('aria-valuenow')).toBe('960');
  expect(right.getAttribute('aria-valuenow')).toBe('960');
  expect(container.querySelector('[data-layout-width]')?.getAttribute('style')).toContain('max-width: 960px');
  fireEvent.keyDown(right, { key: 'ArrowLeft' });
  expect(right.getAttribute('aria-valuenow')).toBe('952');
  fireEvent.keyDown(left, { key: 'Home' });
  expect(right.getAttribute('aria-valuenow')).toBeNull();
});

test.each(['left', 'right'])('dragging the %s edge changes both gaps and cancellation ends the drag', async side => {
  await i18n.changeLanguage('en');
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  function Preview() {
    const [width, setWidth] = useState<number>();
    return <CenteredLayoutWidth layoutWidthPx={width} onChange={setWidth}><div>Cards</div></CenteredLayoutWidth>;
  }
  render(<Preview />);
  const edge = screen.getByRole('separator', { name: i18n.t(side === 'left' ? 'examPreview.resizeLeft' : 'examPreview.resizeRight') });
  edge.setPointerCapture = vi.fn();
  fireEvent.pointerDown(edge, { clientX: 100 });
  fireEvent.pointerMove(edge, { clientX: side === 'left' ? 180 : 20 });
  for (const handle of screen.getAllByRole('separator')) expect(handle.getAttribute('aria-valuenow')).toBe('840');
  fireEvent.pointerCancel(edge);
  fireEvent.pointerMove(edge, { clientX: 300 });
  expect(edge.getAttribute('aria-valuenow')).toBe('840');
});


test('chosen width stays fixed as surrounding panels change, and legacy gaps resolve only once', () => {
  let available = 1400;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => available);
  const { container, rerender } = render(<CenteredLayoutWidth sideInsetPx={100} onChange={vi.fn()}>Cards</CenteredLayoutWidth>);
  const wrapper = container.querySelector('[data-layout-width]') as HTMLElement;
  expect(wrapper.style.maxWidth).toBe('1200px');
  available = 1700;
  rerender(<CenteredLayoutWidth sideInsetPx={100} onChange={vi.fn()}>Cards</CenteredLayoutWidth>);
  expect(wrapper.style.maxWidth).toBe('1200px');
  available = 900;
  rerender(<CenteredLayoutWidth layoutWidthPx={1200} onChange={vi.fn()}>Cards</CenteredLayoutWidth>);
  expect(wrapper.style.maxWidth).toBe('1200px');
  expect(wrapper.className).toContain('w-full');
  available = 1700;
  rerender(<CenteredLayoutWidth layoutWidthPx={1200} onChange={vi.fn()}>Cards</CenteredLayoutWidth>);
  expect(wrapper.style.maxWidth).toBe('1200px');
});
