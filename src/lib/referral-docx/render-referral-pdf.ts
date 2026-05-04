import { exportHtmlToPdf, printHtml } from "@/lib/pdf-exporter";
import type { ReferralPrintModel } from "./types";

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

function buildPdfFileName(data: ReferralPrintModel) {
  const parts = ["הפניה", data.client_name, data.referral_number].filter(Boolean);
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
    line-height: 1.45;
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
    margin-bottom: 18px;
  }
  .logo-wrap { text-align: left; }
  .logo {
    width: 128px;
    height: 128px;
    object-fit: contain;
  }
  h1 {
    margin: 0 0 8px;
    font-size: 26px;
    line-height: 1.1;
    font-weight: 700;
    text-align: right;
  }
  .header-line {
    color: #71717a;
    font-size: 12px;
    font-weight: 700;
    text-align: right;
    margin-top: 2px;
  }
  .text-line {
    margin: 0 0 10px;
    font-size: 13px;
    text-align: right;
  }
  h2 {
    margin: 14px 0 6px;
    font-size: 14px;
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
  .block td {
    vertical-align: top;
    min-height: 76px;
    padding: 8px 10px;
  }
  .block-title {
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 6px;
  }
  .block-body {
    white-space: pre-wrap;
    font-size: 12px;
  }
  .signature {
    margin-top: 22px;
    color: #52525b;
    font-size: 12px;
    white-space: pre-wrap;
  }
`;

function valueClass(value?: string | null) {
  return /[\u200e+-]\d/.test(value || "") ? "value ltr" : "value";
}

function documentHtml(data: ReferralPrintModel, body: string, logoUrl = getLogoUrl()) {
  const clinicLine = data.has_clinic_info
    ? `<div class="header-line">סניף: ${htmlText(data.clinic_info)}</div>`
    : "";

  return `<!doctype html>
    <html dir="rtl" lang="he">
      <head>
        <meta charset="utf-8" />
        <title>מכתב הפניה</title>
        <style>${PDF_CSS}</style>
      </head>
      <body>
        <header class="header">
          <div>
            <h1>מכתב הפניה</h1>
            ${clinicLine}
          </div>
          <div class="logo-wrap"><img class="logo" src="${htmlText(logoUrl)}" /></div>
        </header>
        ${body}
      </body>
    </html>`;
}

function textLine(value: string, visible = true) {
  return visible && value ? `<p class="text-line">${htmlText(value)}</p>` : "";
}

function sectionTitle(title: string) {
  return `<h2>${htmlText(title)}</h2>`;
}

function blockTable(title: string, value: string) {
  return `<table class="block">
    <tr>
      <td class="value">
        <div class="block-title">${htmlText(title)}</div>
        <div class="block-body">${htmlText(value)}</div>
      </td>
    </tr>
  </table>`;
}

function kvTable(pairs: FieldPair[], pairsPerRow = 2) {
  const rows: string[] = [];
  for (let i = 0; i < pairs.length; i += pairsPerRow) {
    const rowPairs = pairs.slice(i, i + pairsPerRow);
    const cells = rowPairs.map(([label, value]) => `
      <th class="label">${htmlText(label)}</th>
      <td class="${valueClass(value)}">${htmlText(value)}</td>
    `);
    while (cells.length < pairsPerRow) {
      cells.push('<th class="label"></th><td class="value"></td>');
    }
    rows.push(`<tr>${cells.join("")}</tr>`);
  }
  return `<table>${rows.join("")}</table>`;
}

function eyeTable(
  rowLabelTitle: string,
  labels: string[],
  rightValues: string[],
  leftValues: string[],
) {
  const headerCells = labels
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

export function renderReferralPdfHtml(data: ReferralPrintModel, logoUrl?: string): string {
  const body = [
    textLine(data.referral_details, data.has_referral_details),
    textLine(data.recipient_line, data.has_recipient),
    textLine(data.client_details, data.has_client_details),
    textLine(data.client_contact, data.has_client_contact),
    data.has_referral_notes ? blockTable("הערות:", data.referral_notes) : "",
    data.has_clinical_findings ? blockTable("ממצאים קליניים:", data.clinical_findings_text) : "",
    data.has_compact_prescription ? sectionTitle("מרשם / כרטיס בדיקה") : "",
    data.has_compact_prescription
      ? eyeTable(
          "עין",
          ["SPH", "CYL", "AX", "PRISM", "BASE", "VA", "ADD", "PD"],
          [data.r_sph, data.r_cyl, data.r_ax, data.r_pris, data.r_base, data.r_va, data.r_add, data.r_pd],
          [data.l_sph, data.l_cyl, data.l_ax, data.l_pris, data.l_base, data.l_va, data.l_add, data.l_pd],
        )
      : "",
    data.has_compact_prescription
      ? kvTable([["VA משולב", data.comb_va], ["PD משולב", data.comb_pd]], 2)
      : "",
    data.has_signature ? `<div class="signature">${htmlText(data.signature_text)}</div>` : "",
  ].join("");

  return documentHtml(data, body, logoUrl);
}

export async function renderReferralPdf(data: ReferralPrintModel) {
  const logoUrl = await getLogoDataUrl();
  return exportHtmlToPdf(renderReferralPdfHtml(data, logoUrl), buildPdfFileName(data));
}

export async function printReferralPdf(data: ReferralPrintModel) {
  const logoUrl = await getLogoDataUrl();
  return printHtml(renderReferralPdfHtml(data, logoUrl), buildPdfFileName(data));
}
