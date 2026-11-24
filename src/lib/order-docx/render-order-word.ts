import PizZip from "pizzip";
import type { FormBlock, FormPair, FormValue, OrderForm } from "./order-form";

// A4 with the print's margins, in twentieths of a point.
const PAGE = { width: 11906, height: 16838, top: 680, side: 794 };
const TEXT_WIDTH = PAGE.width - 2 * PAGE.side;
const EYE_WIDTH = 420;
const GREY = "F3F3F3";
const MUTED = "666666";
const HAIRLINE = '<w:LINE w:val="single" w:sz="4" w:space="0" w:color="DDDDDD"/>';
const RULE = '<w:LINE w:val="single" w:sz="12" w:space="0" w:color="111111"/>';

type Align = "start" | "center" | "end";

const xmlText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Hebrew, or a right-to-left mark, makes a run right-to-left.
const hasHebrew = (text: string) => /[֐-׿‏]/.test(text);

/** A run of text; sizes are in half-points, as Word counts them. */
function run(text: string, { bold = false, size = 18, color = "" } = {}) {
  if (!text) return "";
  const props = [
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>',
    bold ? "<w:b/><w:bCs/>" : "",
    color ? `<w:color w:val="${color}"/>` : "",
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
    hasHebrew(text) ? "<w:rtl/>" : "",
  ].join("");
  return text
    .split("\n")
    .map((line, index) => `${index ? "<w:r><w:br/></w:r>" : ""}<w:r><w:rPr>${props}</w:rPr><w:t xml:space="preserve">${xmlText(line)}</w:t></w:r>`)
    .join("");
}

// In a right-to-left paragraph Word reads "left" as the start (right) edge, as the app's other Word exports do.
const JUSTIFY: Record<Align, string> = { start: "left", center: "center", end: "right" };

function paragraph(runs: string, align: Align = "start") {
  return `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/><w:jc w:val="${JUSTIFY[align]}"/></w:pPr>${runs}</w:p>`;
}

/** A value as text: several values (phones) side by side, each kept left-to-right. */
function valueText(value: FormValue) {
  if (Array.isArray(value)) return `‏${value.map((item) => `‎${item}‎`).join("‏ · ‏")}`;
  const text = String(value ?? "");
  // English, numbers and codes keep their own order inside the right-to-left form ("1.6 DEFENDER", "-4.75").
  return !/[֐-׿]/.test(text) && /[A-Za-z0-9]/.test(text) ? `‎${text}‎` : text;
}

interface CellOptions {
  width: number;
  shade?: boolean;
  align?: Align;
  /** The line under the cell. */
  line?: string;
}

function tableCell(content: string, { width, shade, line }: CellOptions) {
  return `<w:tc><w:tcPr><w:tcW w:w="${Math.round(width)}" w:type="dxa"/>${
    line ? `<w:tcBorders>${line.replace("LINE", "bottom")}</w:tcBorders>` : ""
  }${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${GREY}"/>` : ""}<w:vAlign w:val="center"/></w:tcPr>${content || paragraph("")}</w:tc>`;
}

const textCell = (text: string, options: CellOptions & { bold?: boolean; size?: number; color?: string }) =>
  tableCell(paragraph(run(text, options), options.align), options);

const tableRow = (cells: string[]) => `<w:tr><w:trPr><w:cantSplit/></w:trPr>${cells.join("")}</w:tr>`;

/** A table without borders of its own; its rows' lines come from their cells. */
function table(widths: number[], rows: string[], side = 100, vertical = 50) {
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${TEXT_WIDTH}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblCellMar><w:top w:w="${vertical}" w:type="dxa"/><w:left w:w="${side}" w:type="dxa"/><w:bottom w:w="${vertical}" w:type="dxa"/><w:right w:w="${side}" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths
    .map((value) => `<w:gridCol w:w="${Math.round(value)}"/>`)
    .join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;
}

// Space between blocks; Word also needs a paragraph between two tables.
const gap = (height: number) =>
  `<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="${height}" w:lineRule="exact"/></w:pPr></w:p>`;

function header(form: OrderForm) {
  const widths = [TEXT_WIDTH * 0.45, TEXT_WIDTH * 0.55];
  const meta = [form.clinic, `הודפס ${form.printDate}`].filter(Boolean).join(" · ");
  return table(widths, [tableRow([
    textCell(`${form.title} ${form.number}`, { width: widths[0], bold: true, size: 29, line: RULE }),
    textCell(meta, { width: widths[1], size: 16, color: MUTED, align: "end", line: RULE }),
  ])], 0) + gap(160);
}

const pairRuns = ([label, value]: FormPair, bold = false) =>
  run(`${label}  `, { size: 16, color: MUTED }) + run(valueText(value), { bold });

const heading = (title: string) => gap(200) + paragraph(run(title, { bold: true, size: 19 })) + gap(50);

function blockXml(block: FormBlock): string {
  if (block.type === "info") {
    const width = TEXT_WIDTH / 3;
    const rows: string[] = [];
    for (let index = 0; index < block.pairs.length; index += 3) {
      rows.push(tableRow([0, 1, 2].map((offset) => {
        const pair = block.pairs[index + offset];
        return tableCell(paragraph(pair ? pairRuns(pair) : ""), { width });
      })));
    }
    const name = block.name ? paragraph(run(block.name, { bold: true, size: 26 })) : gap(60);
    return name + (rows.length ? table([width, width, width], rows, 0, 25) + gap(100) : "");
  }

  if (block.type === "charges") {
    const width = TEXT_WIDTH / block.pairs.length;
    return gap(150) + table(
      block.pairs.map(() => width),
      [tableRow(block.pairs.map((pair) => tableCell(paragraph(pairRuns(pair, true)), { width, shade: true })))],
      100,
      90,
    ) + gap(20);
  }

  if (block.type === "notes") return heading("הערות") + block.notes.map((pair) => paragraph(pairRuns(pair))).join("");

  const available = TEXT_WIDTH - (block.eyes ? EYE_WIDTH : 0);
  const widths = block.labels.map((_, index) =>
    block.widths ? (available * block.widths[index]) / 100 : available / block.labels.length);
  const align = (index: number): Align => (block.widths && index === 0 ? "start" : "center");
  const rows = [
    [
      ...(block.eyes ? [textCell("", { width: EYE_WIDTH, shade: true })] : []),
      ...block.labels.map((text, index) => textCell(text, { width: widths[index], shade: true, bold: true, size: 16, color: "555555", align: align(index) })),
    ],
    ...block.rows.map((values, rowIndex) => [
      ...(block.eyes ? [textCell(rowIndex ? "L" : "R", { width: EYE_WIDTH, bold: true, align: "center", line: HAIRLINE })] : []),
      ...values.map((value, index) => textCell(valueText(value), { width: widths[index], align: align(index), line: HAIRLINE })),
    ]),
  ];
  // Eye tables read left to right, R/L first, as prescriptions are written. The table stays right-to-left
  // like the rest of the document, so its columns are given in reverse: Word and LibreOffice both show them in order.
  const ordered = <T,>(items: T[]) => (block.eyes ? [...items].reverse() : items);
  return heading(block.title) +
    table(ordered([...(block.eyes ? [EYE_WIDTH] : []), ...widths]), rows.map((cells) => tableRow(ordered(cells)))) + gap(20);
}

/** The body of the Word document: the same layout as the printed order. */
export function orderFormDocumentXml(form: OrderForm): string {
  const body = [header(form), ...form.blocks.map(blockXml)].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>${body}<w:sectPr><w:pgSz w:w="${PAGE.width}" w:h="${PAGE.height}"/><w:pgMar w:top="${PAGE.top}" w:right="${PAGE.side}" w:bottom="${PAGE.top}" w:left="${PAGE.side}" w:header="0" w:footer="0" w:gutter="0"/><w:bidi/></w:sectPr></w:body></w:document>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:eastAsia="Arial"/><w:sz w:val="20"/><w:szCs w:val="20"/><w:lang w:val="he-IL" w:bidi="he-IL"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults></w:styles>`;

const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** The order as the bytes of a Word document (.docx). */
export function orderFormDocxBytes(form: OrderForm): Uint8Array {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  zip.file("word/styles.xml", STYLES);
  zip.file("word/document.xml", orderFormDocumentXml(form));
  return zip.generate({ type: "uint8array", compression: "DEFLATE" });
}

/** The order as a Word document, ready to save. */
export function orderFormDocx(form: OrderForm): Blob {
  return new Blob([orderFormDocxBytes(form) as Uint8Array<ArrayBuffer>], { type: DOCX_TYPE });
}
