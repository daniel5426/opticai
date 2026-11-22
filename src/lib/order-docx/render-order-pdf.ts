import { exportHtmlToPdf, printHtml } from "@/lib/pdf-exporter";
import type {
  ContactOrderPrintModel,
  OrderExportKind,
  RegularOrderPrintModel,
} from "./types";
import { buildOrderForm, type FormBlock, type FormValue, type OrderForm } from "./order-form";


function getLogoUrl(): string {
  if (typeof window === "undefined") return "";
  return new URL("logo-name.png", window.location.href).toString();
}

export async function getLogoDataUrl(): Promise<string> {
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

// The printed order follows the paper order form of the clinic's earlier software:
// boxed label/value blocks, grey-headed eye tables, and notes beside the charges at the bottom.
const PDF_CSS = `
  @page { size: A4; margin: 10mm 12mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    direction: rtl;
    color: #000;
    font-family: Arial, Assistant, sans-serif;
    font-size: 12px;
    line-height: 1.3;
  }
  body {
    background: #fff;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .topline {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-bottom: 6px;
    font-weight: 700;
    font-size: 13px;
  }
  .topline span { text-decoration: underline; }
  .topline .clinic {
    text-decoration: none;
    font-weight: 400;
    font-size: 10.5px;
    color: #333;
    text-align: center;
    flex: 1;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
    break-inside: avoid;
    margin: 0 0 6px;
  }
  .box { border: 1px solid #000; border-collapse: separate; border-spacing: 0; }
  .box td { padding: 3px 8px; vertical-align: top; }
  .order-box td { padding: 6px 10px; vertical-align: middle; }
  .order-no { font-size: 24px; font-weight: 700; border-left: 1px solid #000; }
  .order-code { font-size: 18px; text-align: center; letter-spacing: 1px; }
  .k { font-weight: 700; white-space: nowrap; width: 19%; }
  .v { width: 31%; }
  .name-row td { font-size: 18px; font-weight: 700; border-bottom: 1px solid #000; padding: 4px 8px 5px; }
  .grid { border: 1px solid #000; }
  .grid th, .grid td {
    border: 1px solid #000;
    padding: 3px 5px;
    height: 23px;
    text-align: center;
    vertical-align: middle;
    overflow-wrap: anywhere;
  }
  .grid th { background: #d9d9d9; font-weight: 700; }
  .grid .title th { font-size: 12.5px; }
  .grid .eye { width: 24px; font-weight: 700; background: #fff; }
  .grid .start { text-align: start; }
  .bottom td.col { width: 50%; padding: 0; vertical-align: top; border: 1px solid #000; }
  .bottom .head { background: #d9d9d9; font-weight: 700; text-align: center; padding: 2px; border-bottom: 1px solid #000; }
  .bottom .notes { padding: 4px 8px; min-height: 62px; white-space: pre-wrap; }
  .bottom .note-title { font-weight: 700; }
  .charges { margin: 0; }
  .charges td { padding: 3px 10px; border-bottom: 1px solid #999; }
  .charges td:first-child { font-weight: 700; width: 45%; }
  .ltr { direction: ltr; unicode-bidi: isolate; }
`;

// English, numbers and codes keep their own order inside the right-to-left form ("1.6 DEFENDER", "-4.75").
const isLtrText = (value: string) => !/[֐-׿]/.test(value) && /[A-Za-z0-9]/.test(value);

function cell(value?: FormValue, className = "") {
  const open = `<td${className ? ` class="${className}"` : ""}>`;
  if (Array.isArray(value)) {
    return `${open}${value.map((item) => `<span class="ltr">${htmlText(item)}</span>`).join("&emsp;")}</td>`;
  }
  const text = htmlText(value);
  return `${open}${value && isLtrText(value) ? `<span class="ltr">${text}</span>` : text}</td>`;
}

function blockHtml(block: FormBlock): string {
  if (block.type === "order") {
    return `<table class="box order-box"><tr>
      <td class="order-no">הזמנה : ${htmlText(block.number)}</td>
      <td class="order-code ltr">*${htmlText(block.number)}*</td>
    </tr></table>`;
  }
  if (block.type === "info") {
    const rows: string[] = [];
    for (let index = 0; index < block.pairs.length; index += 2) {
      const [first, second] = [block.pairs[index], block.pairs[index + 1]];
      rows.push(`<tr>
        <td class="k">${htmlText(first[0])}</td>${cell(first[1], "v")}
        ${second ? `<td class="k">${htmlText(second[0])}</td>${cell(second[1], "v")}` : '<td class="k"></td><td class="v"></td>'}
      </tr>`);
    }
    const nameRow = block.name !== undefined ? `<tr class="name-row"><td class="k">שם</td><td colspan="3">${htmlText(block.name)}</td></tr>` : "";
    return `<table class="box">${nameRow}${rows.join("")}</table>`;
  }
  if (block.type === "grid") {
    const eye = block.eyes ? '<th class="eye"></th>' : "";
    const labels = block.labels
      .map((label, index) => `<th${block.widths ? ` style="width:${block.widths[index]}%"` : ""}>${htmlText(label)}</th>`)
      .join("");
    const rows = block.rows
      .map((values, index) => `<tr>${block.eyes ? `<td class="eye">${index ? "L" : "R"}</td>` : ""}${values
        .map((value, column) => cell(value, !block.eyes && block.widths && column === 0 ? "start" : ""))
        .join("")}</tr>`)
      .join("");
    return `<table class="grid"${block.eyes ? ' dir="ltr"' : ""}>
      <tr class="title">${eye}<th colspan="${block.labels.length}">${htmlText(block.title)}</th></tr>
      <tr>${eye}${labels}</tr>
      ${rows}
    </table>`;
  }
  const notes = block.notes
    .filter(([, value]) => value)
    .map(([title, value]) => `<div><span class="note-title">${htmlText(title)}:</span> ${htmlText(value as string)}</div>`)
    .join("");
  const charges = block.charges
    ? `<td class="col"><div class="head">חיובים</div><table class="charges">${block.charges
        .map(([label, value]) => `<tr><td>${htmlText(label)}</td>${cell(value)}</tr>`)
        .join("")}</table></td>`
    : "";
  return `<table class="bottom"><tr>
    <td class="col"${block.charges ? "" : ' colspan="2"'}><div class="head">הערות</div><div class="notes">${notes}</div></td>
    ${charges}
  </tr></table>`;
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
        <div class="topline">
          <span>${htmlText(form.title)}</span>
          <span class="clinic">סניף: ${htmlText(form.clinic)}</span>
          <span>תאריך הדפסה - ${htmlText(form.printDate)}</span>
        </div>
        ${form.blocks.map(blockHtml).join("")}
      </body>
    </html>`;
}

export function renderRegularOrderPdfHtml(data: RegularOrderPrintModel, _logoUrl?: string, includeBilling = true): string {
  return formHtml(buildOrderForm("regular", data, includeBilling));
}

export function renderContactOrderPdfHtml(data: ContactOrderPrintModel, _logoUrl?: string, includeBilling = true): string {
  return formHtml(buildOrderForm("contact", data, includeBilling));
}

export function renderOrderPdfHtml({
  kind,
  data,
  logoUrl,
  includeBilling = true,
}: {
  kind: OrderExportKind;
  data: RegularOrderPrintModel | ContactOrderPrintModel;
  logoUrl?: string;
  includeBilling?: boolean;
}) {
  return kind === "contact"
    ? renderContactOrderPdfHtml(data as ContactOrderPrintModel, logoUrl, includeBilling)
    : renderRegularOrderPdfHtml(data as RegularOrderPrintModel, logoUrl, includeBilling);
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
  return printHtml(renderOrderPdfHtml({ kind, data, logoUrl }), buildPdfFileName(kind, data), { direct: true });
}
