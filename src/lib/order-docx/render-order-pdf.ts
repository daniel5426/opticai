import i18n from "@/localization/i18n";
import { exportHtmlToPdf, printHtml } from "@/lib/pdf-exporter";
import type {
  ContactOrderPrintModel,
  OrderExportKind,
  RegularOrderPrintModel,
} from "./types";

type FieldPair = [string, string | string[] | undefined | null];

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
  .k { font-weight: 700; white-space: nowrap; width: 15%; }
  .v { width: 35%; }
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

function documentHtml(title: string, clinicInfo: string, body: string) {
  return `<!doctype html>
    <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>${htmlText(title)}</title>
        <style>${PDF_CSS}</style>
      </head>
      <body>
        <div class="topline">
          <span>${htmlText(title)}</span>
          <span class="clinic">סניף: ${htmlText(clinicInfo)}</span>
          <span>תאריך הדפסה - ${htmlText(printDate())}</span>
        </div>
        ${body}
      </body>
    </html>`;
}

function printDate() {
  const today = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(today.getDate())}/${pad(today.getMonth() + 1)}/${today.getFullYear()}`;
}

function valueClass(value?: string | null) {
  return /[‎+-]\d/.test(value || "") ? "ltr" : "";
}

function cell(value?: string | string[] | null, className = "") {
  if (Array.isArray(value)) {
    return `<td${className ? ` class="${className}"` : ""}>${value.map((item) => `<span class="ltr">${htmlText(item)}</span>`).join("&emsp;")}</td>`;
  }
  const classes = [className, valueClass(value)].filter(Boolean).join(" ");
  return `<td${classes ? ` class="${classes}"` : ""}>${htmlText(value)}</td>`;
}

/** The order number, large, beside it as the earlier form printed it. */
function orderBox(orderNumber: string) {
  return `<table class="box order-box"><tr>
    <td class="order-no">הזמנה : ${htmlText(orderNumber)}</td>
    <td class="order-code ltr">*${htmlText(orderNumber)}*</td>
  </tr></table>`;
}

/** A bordered block of label/value pairs, two pairs to a row. */
function infoBox(pairs: FieldPair[], header?: string) {
  const rows: string[] = [];
  for (let index = 0; index < pairs.length; index += 2) {
    const [first, second] = [pairs[index], pairs[index + 1]];
    rows.push(`<tr>
      <td class="k">${htmlText(first[0])}</td>${cell(first[1], "v")}
      ${second ? `<td class="k">${htmlText(second[0])}</td>${cell(second[1], "v")}` : '<td class="k"></td><td class="v"></td>'}
    </tr>`);
  }
  const headRow = header ? `<tr class="name-row"><td class="k">שם</td><td colspan="3">${htmlText(header)}</td></tr>` : "";
  return `<table class="box">${headRow}${rows.join("")}</table>`;
}

function phones(data: { phone_home: string; phone_work: string; phone_mobile: string }) {
  return [data.phone_home, data.phone_work, data.phone_mobile].filter(Boolean);
}

/** A grey-headed table with a row per eye, R and L at the side. */
function eyeGrid(title: string, labels: string[], right: string[], left: string[]) {
  const row = (eye: string, values: string[]) => `<tr><td class="eye">${eye}</td>${values.map((value) => cell(value)).join("")}</tr>`;
  return `<table class="grid">
    <tr class="title"><th class="eye"></th><th colspan="${labels.length}">${htmlText(title)}</th></tr>
    <tr><th class="eye"></th>${labels.map((label) => `<th>${htmlText(label)}</th>`).join("")}</tr>
    ${row("R", right)}${row("L", left)}
  </table>`;
}

function itemsTable(data: RegularOrderPrintModel | ContactOrderPrintModel) {
  const rows = data.line_items_rows?.filter((row) => row.line_index);
  if (!rows?.length) return "";
  return `<table class="grid">
    <tr class="title"><th colspan="4">${htmlText(i18n.t("orderGroupBillingItems"))}</th></tr>
    <tr><th style="width:55%">${htmlText(i18n.t("orderGroupDescription"))}</th><th>כמות</th><th>מחיר</th><th>${htmlText(i18n.t("orderGroupAmount"))}</th></tr>
    ${rows.map((row) => `<tr>${cell(row.line_description, "start")}${cell(row.line_quantity)}${cell(row.line_price)}${cell(row.line_total)}</tr>`).join("")}
  </table>`;
}

/** Notes beside the charges, as the bottom of the earlier form. */
function bottom(data: RegularOrderPrintModel | ContactOrderPrintModel, includeBilling: boolean) {
  const notes = [["הערות קליניות", data.clinic_notes], ["הערות לספק", data.supplier_notes]]
    .filter(([, value]) => value)
    .map(([title, value]) => `<div><span class="note-title">${htmlText(title)}:</span> ${htmlText(value)}</div>`)
    .join("");
  const charges = includeBilling
    ? `<td class="col"><div class="head">חיובים</div><table class="charges">
        <tr><td>סה"כ</td>${cell(data.total_price)}</tr>
        <tr><td>התקבל</td>${cell(data.amount_paid)}</tr>
        <tr><td>יתרה</td>${cell(data.balance_due)}</tr>
        <tr><td>סטטוס תשלום</td>${cell(data.payment_status)}</tr>
      </table></td>`
    : "";
  return `<table class="bottom"><tr>
    <td class="col"${includeBilling ? "" : ' colspan="2"'}><div class="head">הערות</div><div class="notes">${notes}</div></td>
    ${charges}
  </tr></table>`;
}

export function renderRegularOrderPdfHtml(data: RegularOrderPrintModel, _logoUrl?: string, includeBilling = true): string {
  const frameSize = [data.frame_width, data.frame_bridge, data.frame_length].filter(Boolean).join("-");
  const body = [
    orderBox(data.order_number),
    infoBox([
      ["ת.ז", data.client_id],
      ["טלפונים", phones(data)],
      ["כתובת", data.client_address],
    ], data.client_name),
    infoBox([
      ["תאריך", data.order_date],
      ["שם הבודק", data.optician_name],
      ["סוג", data.lens_tab_type],
      ["יועץ", data.advisor_name],
      ["מעבדה", data.manufacturing_lab],
      ["מס' שקית", data.bag_number],
      ["סטטוס", data.order_status],
      ["עדיפות", data.priority],
      ["אספקה בסניף", data.delivery_clinic_name],
      ["הובטח לתאריך", data.promised_date],
    ]),
    eyeGrid(
      "מרשם",
      ["SPH", "CYL", "AX", "PRISM", "BASE", "ADD", "PD", "גובה"],
      [data.r_sph, data.r_cyl, data.r_ax, data.r_pris, data.r_base, data.r_add, data.r_pd, data.r_high],
      [data.l_sph, data.l_cyl, data.l_ax, data.l_pris, data.l_base, data.l_add, data.l_pd, data.l_high],
    ),
    infoBox([["PD משולב", data.comb_pd], ["רב מוקדי", data.multifocal_block]]),
    eyeGrid(
      "עדשות",
      ["דגם", "ספק", "חומר", "ציפוי", "צבע", "קוטר"],
      [data.r_lens_model, data.r_lens_supplier, data.r_lens_material, data.r_lens_coating, data.r_lens_color, data.r_lens_diameter],
      [data.l_lens_model, data.l_lens_supplier, data.l_lens_material, data.l_lens_coating, data.l_lens_color, data.l_lens_diameter],
    ),
    `<table class="grid">
      <tr class="title"><th colspan="7">מסגרת</th></tr>
      <tr><th>ספק</th><th>מותג</th><th>דגם</th><th>צבע</th><th>גודל</th><th>גובה</th><th>סופק ע"י</th></tr>
      <tr>${[data.frame_supplier, data.frame_brand, data.frame_model, data.frame_color, frameSize, data.frame_height, data.frame_supplied_by].map((value) => cell(value)).join("")}</tr>
    </table>`,
    infoBox([["נמסר ע\"י", data.delivered_by], ["תאריך מסירה", data.delivered_date], ["תאריך אישור", data.approval_date]]),
    includeBilling ? itemsTable(data) : "",
    bottom(data, includeBilling),
  ].join("");

  return documentHtml("הזמנת משקפיים", data.clinic_info || data.clinic_name, body);
}

export function renderContactOrderPdfHtml(data: ContactOrderPrintModel, _logoUrl?: string, includeBilling = true): string {
  const body = [
    orderBox(data.order_number),
    infoBox([
      ["ת.ז", data.client_id],
      ["טלפונים", phones(data)],
      ["כתובת", data.client_address],
    ], data.client_name),
    infoBox([
      ["תאריך", data.order_date],
      ["שם הבודק", data.optician_name],
      ["יועץ", data.advisor_name],
      ["סטטוס", data.order_status],
      ["אספקה בסניף", data.supply_clinic_name],
      ["מוסר עבודה", data.deliverer_name],
      ["תאריך אישור", data.approval_date],
      ["תאריך מסירה", data.delivery_date],
    ]),
    eyeGrid(
      "עדשות",
      ["סוג", "דגם", "ספק", "חומר", "צבע", "כמות"],
      [data.r_lens_type, data.r_model, data.r_supplier, data.r_material, data.r_color, data.r_quantity],
      [data.l_lens_type, data.l_model, data.l_supplier, data.l_material, data.l_color, data.l_quantity],
    ),
    eyeGrid(
      "מרשם",
      ["BC", "OZ", "DIAM", "SPH", "CYL", "AX", "READ", "VA", "J"],
      [data.r_bc, data.r_oz, data.r_diam, data.r_sph, data.r_cyl, data.r_ax, data.r_read_add, data.r_va || "", data.r_j || ""],
      [data.l_bc, data.l_oz, data.l_diam, data.l_sph, data.l_cyl, data.l_ax, data.l_read_add, data.l_va || "", data.l_j || ""],
    ),
    infoBox([
      ["תמיסת ניקוי", data.cleaning_solution],
      ["עדיפות", data.priority],
      ["תמיסת חיטוי", data.disinfection_solution],
      ["הובטח לתאריך", data.guaranteed_date],
      ["תמיסת שטיפה", data.rinsing_solution],
    ]),
    includeBilling ? itemsTable(data) : "",
    bottom(data, includeBilling),
  ].join("");

  return documentHtml("הזמנת עדשות מגע", data.clinic_info || data.clinic_name, body);
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
