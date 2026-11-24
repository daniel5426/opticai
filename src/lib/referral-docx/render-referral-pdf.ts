import { exportHtmlToPdf, printHtml } from "@/lib/pdf-exporter";
import type { ReferralPrintModel } from "./types";

type FieldPair = [string, string | undefined | null];

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

// The same letter as the Word export (render-referral-word.ts).
const PDF_CSS = `
  @page { size: A4; margin: 15mm 20mm; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; direction: rtl; color: #1f2937; background: #fff; font: 10.5pt/1.4 Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  header { border-bottom: 2px solid #2256aa; padding-bottom: 6px; margin-bottom: 14px; }
  h1 { margin: 0; font-size: 20pt; color: #2256aa; }
  .clinic { color: #6b7280; font-size: 9.5pt; margin-top: 2px; }
  .recipient { font-size: 12pt; font-weight: 700; margin: 0 0 8px; }
  h2 { margin: 16px 0 5px; font-size: 12pt; color: #2256aa; break-after: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; break-inside: avoid; }
  td, th { border: 1px solid #d9dee7; padding: 5px 8px; vertical-align: middle; }
  .text td { white-space: pre-wrap; }
  .details td { background: #f8fafc; }
  .eyes { direction: ltr; text-align: center; }
  .eyes th { background: #f3f5f9; color: #6b7280; font-size: 9pt; }
  .eyes th.eye { width: 32px; color: #1f2937; font-size: 10.5pt; }
  .combined { color: #6b7280; font-size: 10pt; margin-top: 5px; }
  .signature { margin-top: 32px; white-space: pre-wrap; }
`;

function textTable(lines: string[], className: string) {
  return `<table class="${className}">${lines.map((line) => `<tr><td>${htmlText(line)}</td></tr>`).join("")}</table>`;
}

function block(title: string, text: string) {
  return `<h2>${htmlText(title)}</h2>${textTable([text], "text")}`;
}

/** An eye table as it reads on a prescription: left to right, R above L. */
function eyeTable(title: string, labels: string[], right: string[], left: string[], combined: FieldPair[]) {
  const row = (eye: string, values: string[]) => `<tr><th class="eye">${eye}</th>${values.map((value) => `<td>${htmlText(value)}</td>`).join("")}</tr>`;
  const extra = combined.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join(" | ");
  return `<h2>${htmlText(title)}</h2><table class="eyes"><tr><th class="eye"></th>${labels.map((label) => `<th>${label}</th>`).join("")}</tr>${row("R", right)}${row("L", left)}</table>${extra ? `<div class="combined">${htmlText(extra)}</div>` : ""}`;
}

export function renderReferralPdfHtml(data: ReferralPrintModel): string {
  const values = (prefix: string, fields: string[]) => fields.map((field) => String((data as unknown as Record<string, string>)[`${prefix}_${field}`] || ""));
  const fields = ["sph", "cyl", "ax", "pris", "base", "va", "add"];
  const labels = ["SPH", "CYL", "AX", "PRISM", "BASE", "VA", "ADD"];
  const details = [
    data.has_client_details ? data.client_details : "",
    data.has_client_contact ? data.client_contact : "",
    data.has_referral_details ? data.referral_details : "",
  ].filter(Boolean);
  const body = [
    `<header><h1>מכתב הפניה</h1>${data.has_clinic_info ? `<div class="clinic">${htmlText(data.clinic_info)}</div>` : ""}</header>`,
    data.has_recipient ? `<p class="recipient">${htmlText(data.recipient_line)}</p>` : "",
    details.length ? textTable(details, "details") : "",
    data.has_referral_notes ? block("הערות", data.referral_notes) : "",
    data.has_clinical_findings ? block("ממצאים קליניים", data.clinical_findings_text) : "",
    data.has_old_prescription
      ? eyeTable(data.old_title, [...labels, "J"], values("old_r", [...fields, "j"]), values("old_l", [...fields, "j"]), [["VA משולב", data.old_comb_va], ["J משולב", data.old_comb_j]])
      : "",
    data.has_compact_prescription
      ? eyeTable(data.compact_title, [...labels, "PD"], values("r", [...fields, "pd"]), values("l", [...fields, "pd"]), [["VA משולב", data.comb_va], ["PD משולב", data.comb_pd]])
      : "",
    data.has_signature ? `<div class="signature">${htmlText(data.signature_text)}</div>` : "",
  ].join("");
  return `<!doctype html><html dir="rtl" lang="he"><head><meta charset="utf-8" /><title>מכתב הפניה</title><style>${PDF_CSS}</style></head><body>${body}</body></html>`;
}

export async function renderReferralPdf(data: ReferralPrintModel) {
  return exportHtmlToPdf(renderReferralPdfHtml(data), buildPdfFileName(data));
}

export async function printReferralPdf(data: ReferralPrintModel) {
  return printHtml(renderReferralPdfHtml(data), buildPdfFileName(data));
}
