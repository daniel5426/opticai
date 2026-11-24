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
  expect(xml).toContain('הזמנת עדשות מגע 163251');
  for (const text of ['עדשות', 'מרשם', 'VA', 'פריטי חיוב', 'התקבל', 'הערות', 'זוג לניסיון', 'נירית כהן']) expect(xml).toContain(text);
  // English and numbers keep their order in the right-to-left form.
  expect(xml).toContain('‎1.6 DEFENDER‎');
  // The print shows the same blocks.
  const html = renderOrderPdfHtml({ kind: 'contact', data: contact });
  for (const text of ['הזמנת עדשות מגע 163251', 'פריטי חיוב', 'התקבל']) expect(html).toContain(text);
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
  expect(xml).not.toContain('התקבל');
});

test('a table or box without a single value is left out of both print and Word', () => {
  const data: any = { ...contact, r_lens_type: '', r_model: '', l_model: '', r_quantity: '0', l_quantity: '0', cleaning_solution: 'Opti-Free' };
  const form = buildOrderForm('contact', data);
  const titles = form.blocks.flatMap((block) => (block.type === 'grid' ? [block.title] : []));
  expect(titles).not.toContain('עדשות');
  expect(titles).toContain('מרשם');
  expect(renderOrderPdfHtml({ kind: 'contact', data })).not.toContain('<h2>עדשות</h2>');
  expect(form.blocks.some((block) => block.type === 'info' && block.pairs.some(([label]) => label === 'תמיסת ניקוי'))).toBe(true);
  const empty = buildOrderForm('contact', { ...data, cleaning_solution: '' });
  expect(empty.blocks.some((block) => block.type === 'info' && block.pairs.some(([label]) => label === 'תמיסת ניקוי'))).toBe(false);
});

test('eye tables read left to right, R first', () => {
  expect(renderOrderPdfHtml({ kind: 'contact', data: contact })).toContain('<table class="grid" dir="ltr">');
  const xml = orderFormDocumentXml(buildOrderForm('contact', contact));
  const eyeRow = xml.split('<w:tr>').find((row) => row.includes('>R<'))!;
  // Right-to-left tables list their cells from the right, so R, shown at the left, comes last.
  expect(eyeRow.lastIndexOf('>R<')).toBeGreaterThan(eyeRow.indexOf('8.9'));
});

test('the form leaves out status, priority, promised date, lab, temple length, multifocal and combined PD', () => {
  const regular: any = { ...contact, order_status: 'בהזמנה', priority: 'דחוף', promised_date: '01/12/2026', manufacturing_lab: 'שמיר',
    frame_width: '52', frame_bridge: '18', frame_length: '140', multifocal_block: 'PA: 1', comb_pd: '62', comb_pd_close: '58', r_sph: '-1.00' };
  for (const xml of [orderFormDocumentXml(buildOrderForm('regular', regular)), renderOrderPdfHtml({ kind: 'regular', data: regular })]) {
    for (const text of ['סטטוס<', 'עדיפות', 'הובטח', 'מעבדה', 'רב מוקדי', 'משולב', '140', 'PA: 1']) expect(xml).not.toContain(text);
    expect(xml).toContain('52-18');
  }
});

test.each(['regular', 'contact'] as const)('the %s form leaves out who delivered it and when', (kind) => {
  const data: any = { ...contact, delivered_by: 'מוסר', delivered_date: '02/12/2026', deliverer_name: 'מוסר', delivery_date: '02/12/2026' };
  for (const text of [orderFormDocumentXml(buildOrderForm(kind, data)), renderOrderPdfHtml({ kind, data })]) {
    for (const gone of ['נמסר', 'תאריך מסירה', 'מוסר', '02/12/2026']) expect(text).not.toContain(gone);
  }
});

test('empty fields and columns are left out, while a prescription keeps its columns', () => {
  const form = buildOrderForm('contact', { ...contact, client_address: '', clinic_notes: '' });
  const grid = (title: string) => form.blocks.find((block) => block.type === 'grid' && block.title === title) as any;
  expect(grid('עדשות').labels).toEqual(['סוג', 'דגם']);
  expect(grid('עדשות').rows[0]).toEqual(['רכות חודשיות', '1.6 DEFENDER']);
  expect(grid('מרשם').labels).toHaveLength(9);
  expect(JSON.stringify(form.blocks)).not.toContain('כתובת');
  expect(form.blocks.some((block) => block.type === 'notes')).toBe(false);
});
