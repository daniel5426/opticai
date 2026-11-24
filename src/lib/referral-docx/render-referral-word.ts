import PizZip from "pizzip";
import type { ReferralPrintModel } from "./types";

// A4 with 2cm sides, in twentieths of a point.
const WIDTH = 11906 - 2 * 1134;
const INK = "1F2937";
const MUTED = "6B7280";
const ACCENT = "2256AA";
const LINE = "D9DEE7";

const xml = (value: string) =>
  value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
const hasHebrew = (text: string) => /[֐-׿]/.test(text);

interface RunStyle { bold?: boolean; size?: number; color?: string }

function run(text: string, { bold = false, size = 21, color = INK }: RunStyle = {}) {
  const props = `<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>${bold ? "<w:b/><w:bCs/>" : ""}<w:color w:val="${color}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/>${hasHebrew(text) ? "<w:rtl/>" : ""}`;
  return text.split("\n").map((line, index) =>
    `<w:r><w:rPr>${props}</w:rPr>${index ? "<w:br/>" : ""}<w:t xml:space="preserve">${xml(line)}</w:t></w:r>`).join("");
}

// In a right-to-left paragraph Word reads "left" as the start, right, edge.
function paragraph(runs: string, { center = false, before = 0, after = 0, rule = false, keep = false } = {}) {
  return `<w:p><w:pPr>${keep ? "<w:keepNext/>" : ""}${rule ? `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="6" w:color="${ACCENT}"/></w:pBdr>` : ""}<w:bidi/><w:spacing w:before="${before}" w:after="${after}"/><w:jc w:val="${center ? "center" : "left"}"/></w:pPr>${runs}</w:p>`;
}

function cell(content: string, width: number, fill = "") {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>${content}</w:tc>`;
}

function table(rows: string[], widths: number[], rtl: boolean) {
  const border = (side: string) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${LINE}"/>`;
  return `<w:tbl><w:tblPr>${rtl ? "<w:bidiVisual/>" : ""}<w:tblW w:w="${WIDTH}" w:type="dxa"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="70" w:type="dxa"/><w:left w:w="110" w:type="dxa"/><w:bottom w:w="70" w:type="dxa"/><w:right w:w="110" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths.map((width) => `<w:gridCol w:w="${width}"/>`).join("")}</w:tblGrid>${rows.map((cells) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells}</w:tr>`).join("")}</w:tbl>`;
}

const heading = (text: string) => paragraph(run(text, { bold: true, size: 24, color: ACCENT }), { before: 260, after: 90, keep: true });
const block = (title: string, text: string) => heading(title) + table([cell(paragraph(run(text)), WIDTH)], [WIDTH], true);

/** An eye table as it reads on a prescription: left to right, R above L. */
function eyeTable(title: string, labels: string[], right: string[], left: string[], combined: Array<[string, string]>) {
  const eye = 640;
  const column = Math.floor((WIDTH - eye) / labels.length);
  const widths = [eye, ...labels.map(() => column)];
  const row = (head: string, values: string[], style: RunStyle, fill = "") =>
    cell(paragraph(run(head, { bold: true }), { center: true }), eye, "F3F5F9") +
    values.map((value) => cell(paragraph(run(value, style), { center: true }), column, fill)).join("");
  const extra = combined.filter(([, value]) => value).map(([label, value]) => `${label}: ${value}`).join("   |   ");
  return heading(title) + table([
    row("", labels, { bold: true, size: 18, color: MUTED }, "F3F5F9"),
    row("R", right, {}),
    row("L", left, {}),
  ], widths, false) + (extra ? paragraph(run(extra, { size: 20, color: MUTED }), { before: 70 }) : "");
}

const FILES: Record<string, string> = {
  "[Content_Types].xml": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
  "_rels/.rels": '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
};

/** The referral letter as a Word document. */
export function buildReferralWord(data: ReferralPrintModel): PizZip {
  const eye = (prefix: string, fields: string[]) => fields.map((field) => String((data as unknown as Record<string, string>)[`${prefix}_${field}`] || ""));
  const old = ["sph", "cyl", "ax", "pris", "base", "va", "add", "j"];
  const now = ["sph", "cyl", "ax", "pris", "base", "va", "add", "pd"];
  const labels = ["SPH", "CYL", "AX", "PRISM", "BASE", "VA", "ADD"];
  const details = [
    data.has_client_details ? data.client_details : "",
    data.has_client_contact ? data.client_contact : "",
    data.has_referral_details ? data.referral_details : "",
  ].filter(Boolean);
  const body = [
    paragraph(run("מכתב הפניה", { bold: true, size: 40, color: ACCENT }), { after: data.has_clinic_info ? 30 : 160, rule: !data.has_clinic_info }),
    data.has_clinic_info ? paragraph(run(data.clinic_info, { size: 19, color: MUTED }), { after: 160, rule: true }) : "",
    data.has_recipient ? paragraph(run(data.recipient_line, { bold: true, size: 24 }), { before: 80, after: 120 }) : "",
    details.length ? table(details.map((line) => cell(paragraph(run(line)), WIDTH, "F8FAFC")), [WIDTH], true) : "",
    data.has_referral_notes ? block("הערות", data.referral_notes) : "",
    data.has_clinical_findings ? block("ממצאים קליניים", data.clinical_findings_text) : "",
    data.has_old_prescription ? eyeTable(data.old_title, [...labels, "J"], eye("old_r", old), eye("old_l", old), [["VA משולב", data.old_comb_va], ["J משולב", data.old_comb_j]]) : "",
    data.has_compact_prescription ? eyeTable(data.compact_title, [...labels, "PD"], eye("r", now), eye("l", now), [["VA משולב", data.comb_va], ["PD משולב", data.comb_pd]]) : "",
    data.has_signature ? paragraph(run(data.signature_text, { size: 20 }), { before: 520 }) : "",
  ].join("");
  const zip = new PizZip();
  Object.entries(FILES).forEach(([name, content]) => zip.file(name, content));
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:p/><w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="900" w:right="1134" w:bottom="900" w:left="1134" w:header="0" w:footer="0" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`);
  return zip;
}
