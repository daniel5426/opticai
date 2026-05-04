import { exportHtmlToPdf, printHtml } from "@/lib/pdf-exporter";
import type {
  ContactOrderPrintModel,
  OrderExportKind,
  RegularOrderPrintModel,
} from "./types";

type FieldPair = [string, string | undefined | null];

function getLogoUrl(): string {
  if (typeof window === "undefined") return "";
  return new URL("logo-name.png", window.location.href).toString();
}

async function getLogoDataUrl(): Promise<string> {
  try {
    const response = await fetch(getLogoUrl());
    if (!response.ok) return getLogoUrl();
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return getLogoUrl();
  }
}

function htmlText(value?: string | number | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\n/g, "<br />");
}

function buildPdfFileName(
  kind: OrderExportKind,
  data: RegularOrderPrintModel | ContactOrderPrintModel,
) {
  const parts = [
    kind === "contact" ? "הזמנת_עדשות_מגע" : "הזמנה_רגילה",
    data.client_name,
    data.order_number,
  ].filter(Boolean);

  return `${parts.join("_")}.pdf`;
}

const PDF_CSS = `
  @page { size: A4; margin: 10mm 15.8mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    direction: rtl;
    color: #18181b;
    font-family: Assistant, Arial, sans-serif;
    font-size: 12px;
    line-height: 1.4;
  }
  body {
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .header {
    display: grid;
    grid-template-columns: 1fr 1fr;
    align-items: center;
    margin-bottom: 14px;
  }
  .logo-wrap {
    text-align: left;
  }
  .logo {
    width: 128px;
    height: 128px;
    object-fit: contain;
  }
  h1 {
    margin: 0 0 6px;
    font-size: 26px;
    line-height: 1.1;
    font-weight: 700;
    text-align: right;
  }
  .branch {
    color: #71717a;
    font-size: 12px;
    font-weight: 700;
    text-align: right;
  }
  .spacer { height: 9px; }
  h2 {
    margin: 12px 0 5px;
    font-size: 13px;
    line-height: 1.2;
    text-align: right;
    font-weight: 700;
    break-after: avoid;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    border: 1px solid #e4e4e7;
    break-inside: avoid;
    margin: 0;
  }
  td, th {
    border: 1px solid #e4e4e7;
    padding: 5px 8px;
    height: 29px;
    vertical-align: middle;
    text-align: right;
    font-weight: 400;
  }
  th, .label {
    background: #f4f4f5;
    color: #52525b;
    font-weight: 700;
  }
  .value {
    background: #fafafa;
    color: #18181b;
    font-size: 12px;
  }
  .section-cell {
    background: #18181b;
    color: #fff;
    text-align: center;
    font-weight: 700;
  }
  .center { text-align: center; }
  .ltr {
    direction: ltr;
    unicode-bidi: isolate;
  }
  .notes td {
    vertical-align: top;
    height: 72px;
    padding: 7px 9px;
  }
  .note-title {
    font-size: 12px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .note-body {
    white-space: pre-wrap;
    font-size: 12px;
  }
`;

function documentHtml(title: string, clinicInfo: string, body: string, logoUrl = getLogoUrl()) {
  return `<!doctype html>
    <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>${htmlText(title)}</title>
        <style>${PDF_CSS}</style>
      </head>
      <body>
        <header class="header">
          <div>
            <h1>${htmlText(title)}</h1>
            <div class="branch">סניף: ${htmlText(clinicInfo)}</div>
          </div>
          <div class="logo-wrap"><img class="logo" src="${htmlText(logoUrl)}" /></div>
        </header>
        ${body}
      </body>
    </html>`;
}

function sectionTitle(title: string) {
  return `<h2>${htmlText(title)}</h2>`;
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function valueClass(value?: string | null) {
  return /[\u200e+-]\d/.test(value || "") ? "value ltr" : "value";
}

function metricTable(items: FieldPair[], pairsPerRow = 4) {
  const rows = chunk(items, pairsPerRow)
    .map((rowItems) => {
      const cells = rowItems.map(([label, value]) => `
        <th class="label">${htmlText(label)}</th>
        <td class="${valueClass(value)}">${htmlText(value)}</td>
      `);
      while (cells.length < pairsPerRow) {
        cells.push('<th class="label"></th><td class="value"></td>');
      }
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");

  return `<table>${rows}</table>`;
}

function kvTable(pairs: FieldPair[], pairsPerRow = 2) {
  const rows = chunk(pairs, pairsPerRow)
    .map((rowPairs) => {
      const cells = rowPairs.map(([label, value]) => `
        <th class="label">${htmlText(label)}</th>
        <td class="${valueClass(value)}">${htmlText(value)}</td>
      `);
      while (cells.length < pairsPerRow) {
        cells.push('<th class="label"></th><td class="value"></td>');
      }
      return `<tr>${cells.join("")}</tr>`;
    })
    .join("");

  return `<table>${rows}</table>`;
}

function eyeTable(
  rowLabelTitle: string,
  labels: string[],
  rightValues: string[],
  leftValues: string[],
) {
  const headerCells = [...labels]
    .map((label) => `<th class="label center">${htmlText(label)}</th>`)
    .join("");
  const valueCells = (values: string[]) =>
    values
      .map((value) => `<td class="${valueClass(value)} center">${htmlText(value)}</td>`)
      .join("");

  return `<table>
    <tr><th class="section-cell">${htmlText(rowLabelTitle)}</th>${headerCells}</tr>
    <tr><th class="label center">ימין</th>${valueCells(rightValues)}</tr>
    <tr><th class="label center">שמאל</th>${valueCells(leftValues)}</tr>
  </table>`;
}

function comparisonTable(headers: string[], rightValues: string[], leftValues: string[]) {
  return eyeTable("עין", headers, rightValues, leftValues);
}

function notesRow(
  rightTitle: string,
  rightValue: string,
  leftTitle: string,
  leftValue: string,
) {
  return `<table class="notes">
    <tr>
      <td class="value">
        <div class="note-title">${htmlText(rightTitle)}</div>
        <div class="note-body">${htmlText(rightValue)}</div>
      </td>
      <td class="value">
        <div class="note-title">${htmlText(leftTitle)}</div>
        <div class="note-body">${htmlText(leftValue)}</div>
      </td>
    </tr>
  </table>`;
}

export function renderRegularOrderPdfHtml(data: RegularOrderPrintModel, logoUrl?: string): string {
  const body = [
    '<div class="spacer"></div>',
    metricTable([
      ["מס' הזמנה", data.order_number],
      ["מס' שקית", data.bag_number],
      ["תאריך הזמנה", data.order_date],
      ["תאריך אישור", data.approval_date],
      ["סטטוס", data.order_status],
      ["עדיפות", data.priority],
      ["אספקה", data.delivery_clinic_name],
      ["הובטח", data.promised_date],
    ]),
    sectionTitle("פרטי לקוח"),
    kvTable([
      ["שם לקוח", data.client_name],
      ["ת.ז", data.client_id],
      ["נייד", data.phone_mobile],
      ["טלפון בית", data.phone_home],
      ["טלפון עבודה", data.phone_work],
      ["כתובת", data.client_address],
    ], 3),
    sectionTitle("צוות ותפעול"),
    kvTable([
      ["אופטומטריסט", data.optician_name],
      ["יועץ", data.advisor_name],
      ["נמסר על ידי", data.delivered_by],
      ["תאריך מסירה", data.delivered_date],
      ["מעבדה", data.manufacturing_lab],
      ["סוג טאב", data.lens_tab_type],
    ], 3),
    sectionTitle("מרשם"),
    eyeTable(
      "עין",
      ["SPH", "CYL", "AX", "PRISM", "BASE", "ADD", "PD"],
      [data.r_sph, data.r_cyl, data.r_ax, data.r_pris, data.r_base, data.r_add, data.r_pd],
      [data.l_sph, data.l_cyl, data.l_ax, data.l_pris, data.l_base, data.l_add, data.l_pd],
    ),
    '<div class="spacer"></div>',
    kvTable([["PD משולב", data.comb_pd], ["רב מוקדי", data.multifocal_block]], 2),
    sectionTitle("פרטי עדשות"),
    comparisonTable(
      ["דגם", "ספק", "חומר", "ציפוי", "צבע", "קוטר"],
      [data.r_lens_model, data.r_lens_supplier, data.r_lens_material, data.r_lens_coating, data.r_lens_color, data.r_lens_diameter],
      [data.l_lens_model, data.l_lens_supplier, data.l_lens_material, data.l_lens_coating, data.l_lens_color, data.l_lens_diameter],
    ),
    sectionTitle("מסגרת"),
    kvTable([
      ["ספק", data.frame_supplier],
      ["מותג", data.frame_brand],
      ["דגם", data.frame_model],
      ["צבע", data.frame_color],
      ["רוחב", data.frame_width],
      ["גשר", data.frame_bridge],
      ["גובה", data.frame_height],
      ["אורך זרוע", data.frame_length],
      ["סופק על ידי", data.frame_supplied_by],
    ], 3),
    sectionTitle("סיכום כספי"),
    metricTable([
      ['סה"כ', data.total_price],
      ["שולם", data.amount_paid],
      ["יתרה", data.balance_due],
    ], 3),
    sectionTitle("הערות"),
    notesRow("הערות קליניות", data.clinic_notes, "הערות לספק", data.supplier_notes),
  ].join("");

  return documentHtml("הזמנה רגילה", data.clinic_info || data.clinic_name, body, logoUrl);
}

export function renderContactOrderPdfHtml(data: ContactOrderPrintModel, logoUrl?: string): string {
  const body = [
    '<div class="spacer"></div>',
    metricTable([
      ["מס' הזמנה", data.order_number],
      ["תאריך הזמנה", data.order_date],
      ["סטטוס", data.order_status],
      ["עדיפות", data.priority],
      ["אספקה", data.supply_clinic_name],
      ["הובטח", data.guaranteed_date],
      ["אושר", data.approval_date],
      ["נמסר", data.delivery_date],
    ]),
    sectionTitle("פרטי לקוח"),
    kvTable([
      ["שם לקוח", data.client_name],
      ["ת.ז", data.client_id],
      ["נייד", data.phone_mobile],
      ["טלפון בית", data.phone_home],
      ["טלפון עבודה", data.phone_work],
      ["כתובת", data.client_address],
    ], 3),
    sectionTitle("צוות ותפעול"),
    kvTable([
      ["אופטומטריסט", data.optician_name],
      ["יועץ", data.advisor_name],
      ["מוסר עבודה", data.deliverer_name],
    ], 3),
    sectionTitle("פרטי עדשות"),
    comparisonTable(
      ["סוג", "דגם", "ספק", "חומר", "צבע", "כמות"],
      [data.r_lens_type, data.r_model, data.r_supplier, data.r_material, data.r_color, data.r_quantity],
      [data.l_lens_type, data.l_model, data.l_supplier, data.l_material, data.l_color, data.l_quantity],
    ),
    sectionTitle("מרשם עדשות מגע"),
    eyeTable(
      "עין",
      ["BC", "OZ", "DIAM", "SPH", "CYL", "AX", "READ/ADD"],
      [data.r_bc, data.r_oz, data.r_diam, data.r_sph, data.r_cyl, data.r_ax, data.r_read_add],
      [data.l_bc, data.l_oz, data.l_diam, data.l_sph, data.l_cyl, data.l_ax, data.l_read_add],
    ),
    sectionTitle("תמיסות"),
    kvTable([
      ["ניקוי", data.cleaning_solution],
      ["חיטוי", data.disinfection_solution],
      ["שטיפה", data.rinsing_solution],
    ], 3),
    sectionTitle("סיכום כספי"),
    metricTable([
      ['סה"כ', data.total_price],
      ["שולם", data.amount_paid],
      ["יתרה", data.balance_due],
    ], 3),
    sectionTitle("הערות"),
    notesRow("הערות קליניות", data.clinic_notes, "הערות לספק", data.supplier_notes),
  ].join("");

  return documentHtml("הזמנת עדשות מגע", data.clinic_info || data.clinic_name, body, logoUrl);
}

export function renderOrderPdfHtml({
  kind,
  data,
  logoUrl,
}: {
  kind: OrderExportKind;
  data: RegularOrderPrintModel | ContactOrderPrintModel;
  logoUrl?: string;
}) {
  return kind === "contact"
    ? renderContactOrderPdfHtml(data as ContactOrderPrintModel, logoUrl)
    : renderRegularOrderPdfHtml(data as RegularOrderPrintModel, logoUrl);
}

export async function renderOrderPdf({
  kind,
  data,
}: {
  kind: OrderExportKind;
  data: RegularOrderPrintModel | ContactOrderPrintModel;
}) {
  const logoUrl = await getLogoDataUrl();
  return exportHtmlToPdf(renderOrderPdfHtml({ kind, data, logoUrl }), buildPdfFileName(kind, data));
}

export async function printOrderPdf({
  kind,
  data,
}: {
  kind: OrderExportKind;
  data: RegularOrderPrintModel | ContactOrderPrintModel;
}) {
  const logoUrl = await getLogoDataUrl();
  return printHtml(renderOrderPdfHtml({ kind, data, logoUrl }), buildPdfFileName(kind, data));
}
