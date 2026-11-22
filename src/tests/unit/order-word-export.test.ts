import { expect, test } from 'vitest';
import PizZip from 'pizzip';
import { buildOrderForm } from '@/lib/order-docx/order-form';
import { orderFormDocumentXml, orderFormDocxBytes } from '@/lib/order-docx/render-order-word';
import { renderOrderPdfHtml } from '@/lib/order-docx/render-order-pdf';

const contact: any = {
  order_number: '163251', client_name: 'נירית כהן', client_id: '016735', phone_home: '02-6781254', phone_work: '', phone_mobile: '050-6262671',
  r_lens_type: 'רכות חודשיות', r_model: '1.6 DEFENDER', l_model: 'BIOMEDICS TOR', r_bc: '8.9', l_sph: '‎-4.25‎', r_va: '6/6',
  line_items_rows: [{ line_index: '1', line_description: 'זוג Biofinity', line_quantity: '2', line_price: '100', line_total: '200' }],
  total_price: '200', amount_paid: '0', balance_due: '200', payment_status: 'לא שולם', clinic_notes: 'זוג לניסיון', supplier_notes: '',
};

test('the Word export carries the same paper-form layout as the print', () => {
  const form = buildOrderForm('contact', contact);
  const xml = orderFormDocumentXml(form);
  expect(new DOMParser().parseFromString(xml, 'application/xml').querySelector('parsererror')).toBeNull();
  expect(xml).toContain('<w:bidiVisual/>');
  expect(xml).toContain('הזמנה : 163251');
  expect(xml).toContain('*163251*');
  expect(xml).toContain('w:fill="D9D9D9"');
  for (const text of ['עדשות', 'מרשם', 'VA', 'פריטי חיוב', 'חיובים', 'הערות', 'זוג לניסיון', 'נירית כהן']) expect(xml).toContain(text);
  // English and numbers keep their order in the right-to-left form.
  expect(xml).toContain('‎1.6 DEFENDER‎');
  // The print shows the same blocks.
  const html = renderOrderPdfHtml({ kind: 'contact', data: contact });
  for (const text of ['הזמנה : 163251', 'פריטי חיוב', 'חיובים']) expect(html).toContain(text);
});

test('the Word export is a complete .docx package', () => {
  const zip = new PizZip(orderFormDocxBytes(buildOrderForm('regular', { ...contact, frame_brand: 'Ray-Ban' })));
  for (const part of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml', 'word/styles.xml', 'word/_rels/document.xml.rels']) {
    expect(zip.file(part)).toBeTruthy();
  }
  expect(zip.file('word/document.xml')!.asText()).toContain('Ray-Ban');
});

test('without billing, neither the items nor the charges are exported', () => {
  const xml = orderFormDocumentXml(buildOrderForm('contact', contact, false));
  expect(xml).not.toContain('פריטי חיוב');
  expect(xml).not.toContain('חיובים');
});

test('a table or box without a single value is left out of both print and Word', () => {
  const data: any = { ...contact, r_lens_type: '', r_model: '', l_model: '', r_quantity: '0', l_quantity: '0', priority: 'רגילה' };
  const form = buildOrderForm('contact', data);
  const titles = form.blocks.flatMap((block) => (block.type === 'grid' ? [block.title] : []));
  expect(titles).not.toContain('עדשות');
  expect(titles).toContain('מרשם');
  expect(renderOrderPdfHtml({ kind: 'contact', data })).not.toContain('<th colspan="6">עדשות</th>');
  expect(form.blocks.some((block) => block.type === 'info' && block.pairs.some(([label]) => label === 'תמיסת ניקוי'))).toBe(true);
  const empty = buildOrderForm('contact', { ...data, priority: '', cleaning_solution: '' });
  expect(empty.blocks.some((block) => block.type === 'info' && block.pairs.some(([label]) => label === 'תמיסת ניקוי'))).toBe(false);
});

test('eye tables read left to right, R first', () => {
  expect(renderOrderPdfHtml({ kind: 'contact', data: contact })).toContain('<table class="grid" dir="ltr">');
  const xml = orderFormDocumentXml(buildOrderForm('contact', contact));
  const eyeRow = xml.split('<w:tr>').find((row) => row.includes('>R<'))!;
  // Right-to-left tables list their cells from the right, so R, shown at the left, comes last.
  expect(eyeRow.lastIndexOf('>R<')).toBeGreaterThan(eyeRow.indexOf('8.9'));
});
