import { exportHtmlToPdf, printHtml } from "@/lib/pdf-exporter";
import type {
  ContactOrderPrintModel,
  OrderExportKind,
  RegularOrderPrintModel,
} from "./types";
import { buildOrderForm, type FormBlock, type FormPair, type FormValue, type OrderForm } from "./order-form";


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

// Light and compact: hairlines between rows, muted labels, no boxes.
const PDF_CSS = `
  @page { size: A4; margin: 12mm 14mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    direction: rtl;
    color: #111;
    font-family: Arial, Assistant, sans-serif;
    font-size: 12px;
    line-height: 1.3;
  }
  body {
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 16px;
    padding-bottom: 6px;
    margin-bottom: 10px;
    border-bottom: 1.5px solid #111;
  }
  .head .title { font-size: 19px; font-weight: 700; white-space: nowrap; }
  .head .meta { font-size: 10.5px; color: #666; text-align: end; }
  .name { font-size: 17px; font-weight: 700; margin-bottom: 2px; }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    break-inside: avoid;
  }
  .info { margin-bottom: 8px; }
  .info td { padding: 2px 0; vertical-align: top; }
  .k { color: #666; font-size: 11px; margin-inline-end: 5px; }
  .section { margin-top: 14px; break-inside: avoid; }
  h2 { font-size: 12.5px; font-weight: 700; margin: 0 0 3px; }
  .grid th, .grid td {
    padding: 4px 5px;
    text-align: center;
    vertical-align: middle;
    overflow-wrap: anywhere;
    border-bottom: 1px solid #ddd;
  }
  .grid th { background: #f3f3f3; color: #555; font-size: 10.5px; font-weight: 700; border-bottom: 0; }
  .grid .eye { width: 28px; font-weight: 700; }
  .grid[dir=ltr] td { direction: rtl; }
  .section + .info { margin-top: 8px; }
  .grid .start { text-align: start; }
  .charges { margin-top: 10px; background: #f3f3f3; }
  .charges td { padding: 6px 8px; font-weight: 700; }
  .charges .k { font-weight: 400; }
  .notes { white-space: pre-wrap; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
`;

// English, numbers and codes keep their own order inside the right-to-left form ("1.6 DEFENDER", "-4.75").
const isLtrText = (value: string) => !/[֐-׿]/.test(value) && /[A-Za-z0-9]/.test(value);

function valueHtml(value?: FormValue): string {
  if (Array.isArray(value)) return value.map((item) => `<span class="ltr">${htmlText(item)}</span>`).join(" · ");
  const text = htmlText(value);
  return value && isLtrText(value) ? `<span class="ltr">${text}</span>` : text;
}

const pairHtml = ([label, value]: FormPair) => `<td><span class="k">${htmlText(label)}</span>${valueHtml(value)}</td>`;

function pairRows(pairs: FormPair[], perRow: number) {
  const rows: string[] = [];
  for (let index = 0; index < pairs.length; index += perRow) {
    const cells = pairs.slice(index, index + perRow).map(pairHtml);
    while (cells.length < perRow) cells.push("<td></td>");
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return rows.join("");
}

function blockHtml(block: FormBlock): string {
  if (block.type === "info") {
    const name = block.name ? `<div class="name">${htmlText(block.name)}</div>` : "";
    return `${name}${block.pairs.length ? `<table class="info">${pairRows(block.pairs, 3)}</table>` : ""}`;
  }
  if (block.type === "charges") return `<table class="charges">${pairRows(block.pairs, block.pairs.length)}</table>`;
  if (block.type === "notes") {
    return `<div class="section"><h2>הערות</h2>${block.notes
      .map(([label, value]) => `<div class="notes"><span class="k">${htmlText(label)}</span>${htmlText(value as string)}</div>`)
      .join("")}</div>`;
  }
  const eye = block.eyes ? '<th class="eye"></th>' : "";
  const labels = block.labels
    .map((label, index) => `<th${block.widths ? ` style="width:${block.widths[index]}%"` : ""}${block.widths && index === 0 ? ' class="start"' : ""}>${htmlText(label)}</th>`)
    .join("");
  const rows = block.rows
    .map((values, index) => `<tr>${block.eyes ? `<td class="eye">${index ? "L" : "R"}</td>` : ""}${values
      .map((value, column) => `<td${block.widths && column === 0 ? ' class="start"' : ""}>${valueHtml(value)}</td>`)
      .join("")}</tr>`)
    .join("");
  return `<div class="section"><h2>${htmlText(block.title)}</h2><table class="grid"${block.eyes ? ' dir="ltr"' : ""}>
    <tr>${eye}${labels}</tr>
    ${rows}
  </table></div>`;
}

function formHtml(form: OrderForm) {
  return `<!doctype html>
    <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>${htmlText(form.title)}</title>
        <style>${PDF_CSS}</style>
      </head>
      <body>
        <div class="head">
          <span class="title">${htmlText(form.title)} ${htmlText(form.number)}</span>
          <span class="meta">${htmlText(form.clinic)}${form.clinic ? " · " : ""}הודפס ${htmlText(form.printDate)}</span>
        </div>
        ${form.blocks.map(blockHtml).join("")}
      </body>
    </html>`;
}

export function renderRegularOrderPdfHtml(data: RegularOrderPrintModel, includeBilling = true): string {
  return formHtml(buildOrderForm("regular", data, includeBilling));
}

export function renderContactOrderPdfHtml(data: ContactOrderPrintModel, includeBilling = true): string {
  return formHtml(buildOrderForm("contact", data, includeBilling));
}

export function renderOrderPdfHtml({
  kind,
  data,
  includeBilling = true,
}: {
  kind: OrderExportKind;
  data: RegularOrderPrintModel | ContactOrderPrintModel;
  includeBilling?: boolean;
}) {
  return kind === "contact"
    ? renderContactOrderPdfHtml(data as ContactOrderPrintModel, includeBilling)
    : renderRegularOrderPdfHtml(data as RegularOrderPrintModel, includeBilling);
}

export async function renderOrderPdf({
  kind,
  data,
}: {
  kind: OrderExportKind;
  data: RegularOrderPrintModel | ContactOrderPrintModel;
}) {
  return exportHtmlToPdf(renderOrderPdfHtml({ kind, data }), buildPdfFileName(kind, data));
}

export async function printOrderPdf({
  kind,
  data,
}: {
  kind: OrderExportKind;
  data: RegularOrderPrintModel | ContactOrderPrintModel;
}) {
  return printHtml(renderOrderPdfHtml({ kind, data }));
}
