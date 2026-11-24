import { afterEach, expect, it } from 'vitest';
import { printHtml } from '@/lib/pdf-exporter';

afterEach(() => { document.body.innerHTML = ''; });

it('prints from a hidden frame that stays while the dialog is open, until the next print', async () => {
  const printed: string[] = [];
  const print = async (html: string) => {
    const done = printHtml(html);
    const frame = document.getElementById('print-frame') as HTMLIFrameElement;
    Object.defineProperty(frame, 'contentWindow', { value: { document: {}, focus: () => {}, print: () => printed.push(frame.srcdoc) } });
    frame.dispatchEvent(new Event('load'));
    await done;
  };
  await print('<p>first</p>');
  expect(document.querySelectorAll('iframe')).toHaveLength(1);
  await print('<p>second</p>');
  expect(printed).toEqual(['<p>first</p>', '<p>second</p>']);
  expect(document.querySelectorAll('iframe')).toHaveLength(1);
});
