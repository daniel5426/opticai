import React from 'react';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18n from '@/localization/i18n';
import ExamLayoutEditorPage from '@/pages/ExamLayoutEditorPage';
import { parseLayoutData } from '@/pages/exam-detail/utils';

const { load, save } = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(async (_layout: { layout_data: string }) => ({ id: 12 })),
}));
vi.mock('@tanstack/react-router', async importOriginal => ({
  ...await importOriginal<typeof import('@tanstack/react-router')>(),
  useNavigate: () => vi.fn(),
  useParams: () => ({ layoutId: '12' }),
  useSearch: () => ({}),
}));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentClinic: { id: 1 } }) }));
vi.mock('@/components/site-header', () => ({ SiteHeader: () => null }));
vi.mock('@/components/exam/ExamCardRenderer', () => ({
  ExamCardRenderer: () => <div>Card preview</div>,
  getColumnCount: () => 4,
  hasNoteCard: () => true,
}));
vi.mock('@/lib/db/exam-layouts-db', () => ({
  getExamLayoutById: load,
  updateExamLayout: save,
  createExamLayout: vi.fn(),
}));

const notes = { id: 'notes', type: 'notes', x: 0, y: 0, w: 8 };
const loadLayout = (items = [notes]) => load.mockResolvedValueOnce({
  id: 12,
  name: 'Fixture',
  layout_data: JSON.stringify({ version: 2, grid: { columns: 24 }, items }),
});

afterEach(() => { cleanup(); load.mockReset(); save.mockClear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

test('resizing a card changes its saved width independently of the overall layout width', async () => {
  await i18n.changeLanguage('he');
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
  loadLayout();
  render(<ExamLayoutEditorPage />);
  const card = (await screen.findByText('Card preview')).closest<HTMLElement>('[data-grid-card]')!;
  const rightHandle = card.querySelectorAll('[data-resize-handle]')[1];
  expect(card.style.width).toBe('416px');
  fireEvent.pointerDown(rightHandle, { clientX: 416 });
  fireEvent.pointerMove(window, { clientX: 524 });
  fireEvent.pointerUp(window);
  expect(card.style.width).toBe('524px');

  const layoutHandle = screen.getByRole('separator', { name: i18n.t('examPreview.resizeLeft') });
  fireEvent.keyDown(layoutHandle, { key: 'ArrowRight', shiftKey: true });
  expect(layoutHandle).toHaveAttribute('aria-valuenow', '960');
  expect(card.style.width).toBe('524px');

  fireEvent.click(screen.getByRole('button', { name: 'שמור פריסה', exact: true }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(JSON.parse(save.mock.calls[0][0].layout_data)).toMatchObject({
    layoutWidthPx: 960,
    items: [{ id: 'notes', x: 0, y: 0, w: 10 }],
  });
});

test('a card can reach the exact right edge and keep its position after the pane narrows', async () => {
  await i18n.changeLanguage('he');
  vi.stubGlobal('PointerEvent', MouseEvent);
  let paneWidth = 1900;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(() => paneWidth);
  loadLayout();
  render(<ExamLayoutEditorPage />);
  const card = (await screen.findByText('Card preview')).closest<HTMLElement>('[data-grid-card]')!;
  const lane = card.closest<HTMLElement>('[data-exam-lane]')!;
  lane.style.padding = '12px';
  vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, bottom: 200 } as DOMRect);
  vi.spyOn(card, 'getBoundingClientRect').mockReturnValue({ left: 12, right: 428 } as DOMRect);

  fireEvent.pointerDown(card, { button: 0, clientX: 100, clientY: 80 });
  fireEvent.pointerMove(window, { clientX: 1750, clientY: 80 });
  fireEvent.pointerUp(window);
  expect(card.style.width).toBe('416px');
  paneWidth = 1000;

  fireEvent.click(screen.getByRole('button', { name: 'שמור פריסה', exact: true }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  const saved = parseLayoutData(save.mock.calls[0][0].layout_data);
  expect(saved.grid.grid.columns).toBe(36);
  expect(saved.items).toMatchObject([{ id: 'notes', y: 0, w: 8 }]);
  expect(saved.items[0].x * 54 + 416).toBeCloseTo(1876);
});

test('dragging across a neighbor keeps the row in its original order', async () => {
  await i18n.changeLanguage('he');
  vi.stubGlobal('PointerEvent', MouseEvent);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1900);
  loadLayout([notes, { ...notes, id: 'second', x: 12 }]);
  const { container } = render(<ExamLayoutEditorPage />);
  await screen.findAllByText('Card preview');
  const lane = container.querySelector<HTMLElement>('[data-exam-lane]')!;
  const first = lane.querySelector<HTMLElement>('[data-grid-card="notes"]')!;
  const second = lane.querySelector<HTMLElement>('[data-grid-card="second"]')!;
  vi.spyOn(lane, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, bottom: 200 } as DOMRect);
  vi.spyOn(first, 'getBoundingClientRect').mockReturnValue({ left: 0, right: 416 } as DOMRect);
  vi.spyOn(second, 'getBoundingClientRect').mockReturnValue({ left: 648, right: 1064 } as DOMRect);

  fireEvent.pointerDown(second, { button: 0, clientX: 720, clientY: 80 });
  fireEvent.pointerMove(window, { clientX: 40, clientY: 80 });
  expect([...lane.querySelectorAll('[data-grid-card]')]).toEqual([first, second]);
  fireEvent.pointerUp(window);

  fireEvent.click(screen.getByRole('button', { name: 'שמור פריסה', exact: true }));
  await waitFor(() => expect(save).toHaveBeenCalledOnce());
  expect(parseLayoutData(save.mock.calls[0][0].layout_data).items).toMatchObject([
    { id: 'notes', x: 0, w: 8 },
    { id: 'second', x: 8, w: 8 },
  ]);
});
