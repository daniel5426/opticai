import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { printHtml, setDirectPrintingEnabled } from '@/lib/pdf-exporter';

beforeEach(() => localStorage.clear());
afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

function observePrintDialog() {
  const printed: string[] = [];
  const append = document.body.appendChild.bind(document.body);
  vi.spyOn(document.body, 'appendChild').mockImplementation((node) => {
    const result = append(node);
    if (node instanceof HTMLIFrameElement) {
      Object.defineProperty(node, 'contentWindow', {
        value: { document: {}, focus: () => {}, print: () => printed.push(node.srcdoc) },
      });
      node.dispatchEvent(new Event('load'));
    }
    return result;
  });
  return printed;
}

it('prints from a hidden frame that stays while the dialog is open, until the next print', async () => {
  const printed = observePrintDialog();
  await printHtml('<p>first</p>');
  expect(document.querySelectorAll('iframe')).toHaveLength(1);
  await printHtml('<p>second</p>');
  expect(printed).toEqual(['<p>first</p>', '<p>second</p>']);
  expect(document.querySelectorAll('iframe')).toHaveLength(1);
});

it('uses the native printer by default and skips the dialog when submission succeeds', async () => {
  const printHtmlSilently = vi.fn().mockResolvedValue(true);
  vi.stubGlobal('electronAPI', { printHtmlSilently });

  await printHtml('<p>order</p>');

  expect(printHtmlSilently).toHaveBeenCalledExactlyOnceWith('<p>order</p>');
  expect(document.getElementById('print-frame')).toBeNull();
});

it('opens the print dialog when direct printing is disabled', async () => {
  const printHtmlSilently = vi.fn();
  vi.stubGlobal('electronAPI', { printHtmlSilently });
  setDirectPrintingEnabled(false);

  const printed = observePrintDialog();
  await printHtml('<p>order</p>');

  expect(printHtmlSilently).not.toHaveBeenCalled();
  expect(printed).toEqual(['<p>order</p>']);
});

it.each([false, new Error('Printer unavailable')])('falls back to the dialog when direct printing returns %s', async (result) => {
  const printHtmlSilently = vi.fn();
  if (result instanceof Error) printHtmlSilently.mockRejectedValue(result);
  else printHtmlSilently.mockResolvedValue(result);
  vi.stubGlobal('electronAPI', { printHtmlSilently });

  const printed = observePrintDialog();
  await printHtml('<p>referral</p>');

  expect(printHtmlSilently).toHaveBeenCalledExactlyOnceWith('<p>referral</p>');
  expect(printed).toEqual(['<p>referral</p>']);
});
