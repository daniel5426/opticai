import PizZip from "pizzip";
import type { FormBlock, FormValue, OrderForm } from "./order-form";

// A4 with the print's margins, in twentieths of a point.
const PAGE = { width: 11906, height: 16838, top: 567, side: 680 };
const TEXT_WIDTH = PAGE.width - 2 * PAGE.side;
const EYE_WIDTH = 380;
const GREY = "D9D9D9";
const LINE = '<w:LINE w:val="single" w:sz="6" w:space="0" w:color="000000"/>';
const NO_LINE = '<w:LINE w:val="nil"/>';

type Align = "start" | "center" | "end";

const xmlText = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Hebrew, or a right-to-left mark, makes a run right-to-left.
const hasHebrew = (text: string) => /[֐-׿‏]/.test(text);

/** A run of text; sizes are in half-points, as Word counts them. */
function run(text: string, { bold = false, size = 20, underline = false, color = "" } = {}) {
  if (!text) return "";
  const props = [
    '<w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>',
    bold ? "<w:b/><w:bCs/>" : "",
    color ? `<w:color w:val="${color}"/>` : "",
    `<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`,
    underline ? '<w:u w:val="single"/>' : "",
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
  if (Array.isArray(value)) return `‏${value.map((item) => `‎${item}‎`).join("‏    ‏")}`;
  const text = String(value ?? "");
  // English, numbers and codes keep their own order inside the right-to-left form ("1.6 DEFENDER", "-4.75").
  return !/[֐-׿]/.test(text) && /[A-Za-z0-9]/.test(text) ? `‎${text}‎` : text;
}

interface CellOptions {
  width: number;
  span?: number;
  shade?: boolean;
  align?: Align;
  bottomLine?: boolean;
  top?: boolean;
}

function tableCell(content: string, { width, span, shade, bottomLine, top }: CellOptions) {
  return `<w:tc><w:tcPr><w:tcW w:w="${Math.round(width)}" w:type="dxa"/>${span && span > 1 ? `<w:gridSpan w:val="${span}"/>` : ""}${
    bottomLine ? `<w:tcBorders>${LINE.replace("LINE", "bottom")}</w:tcBorders>` : ""
  }${shade ? `<w:shd w:val="clear" w:color="auto" w:fill="${GREY}"/>` : ""}<w:vAlign w:val="${top ? "top" : "center"}"/></w:tcPr>${content || paragraph("")}</w:tc>`;
}

const textCell = (text: string, options: CellOptions & { bold?: boolean; size?: number }) =>
  tableCell(paragraph(run(text, { bold: options.bold, size: options.size }), options.align), options);

function tableRow(cells: string[], height = 0) {
  return `<w:tr><w:trPr><w:cantSplit/>${height ? `<w:trHeight w:val="${height}" w:hRule="atLeast"/>` : ""}</w:trPr>${cells.join("")}</w:tr>`;
}

type Lines = "box" | "grid" | "none" | "order";

function table(widths: number[], rows: string[], lines: Lines, width = TEXT_WIDTH) {
  const outer = lines === "none" ? NO_LINE : LINE;
  const insideV = lines === "grid" || lines === "order" ? LINE : NO_LINE;
  const insideH = lines === "grid" ? LINE : NO_LINE;
  const borders = ["top", "left", "bottom", "right"].map((side) => outer.replace("LINE", side)).join("") +
    insideH.replace("LINE", "insideH") + insideV.replace("LINE", "insideV");
  return `<w:tbl><w:tblPr><w:bidiVisual/><w:tblW w:w="${Math.round(width)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders>${borders}</w:tblBorders><w:tblCellMar><w:top w:w="30" w:type="dxa"/><w:left w:w="100" w:type="dxa"/><w:bottom w:w="30" w:type="dxa"/><w:right w:w="100" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${widths
    .map((value) => `<w:gridCol w:w="${Math.round(value)}"/>`)
    .join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;
}

// A small gap after each block, as the print leaves between its boxes.
const GAP = '<w:p><w:pPr><w:bidi/><w:spacing w:before="0" w:after="0" w:line="120" w:lineRule="exact"/></w:pPr></w:p>';

function topLine(form: OrderForm) {
  const widths = [TEXT_WIDTH * 0.3, TEXT_WIDTH * 0.4, TEXT_WIDTH * 0.3];
  return table(widths, [tableRow([
    tableCell(paragraph(run(form.title, { bold: true, size: 26, underline: true })), { width: widths[0] }),
    tableCell(paragraph(run(`סניף: ${form.clinic}`, { size: 16, color: "333333" }), "center"), { width: widths[1] }),
    tableCell(paragraph(run(`תאריך הדפסה - ${form.printDate}`, { bold: true, size: 22, underline: true }), "end"), { width: widths[2] }),
  ])], "none");
}

function blockXml(block: FormBlock): string {
  if (block.type === "order") {
    const half = TEXT_WIDTH / 2;
    return table([half, half], [tableRow([
      textCell(`הזמנה : ${block.number}`, { width: half, bold: true, size: 36 }),
      textCell(`*${block.number}*`, { width: half, size: 28, align: "center" }),
    ], 620)], "order");
  }

  if (block.type === "info") {
    const label = TEXT_WIDTH * 0.19;
    const value = TEXT_WIDTH * 0.31;
    const rows: string[] = [];
    if (block.name !== undefined) {
      rows.push(tableRow([
        textCell("שם", { width: label, bold: true, size: 28, bottomLine: true }),
        textCell(block.name, { width: value * 2 + label, span: 3, bold: true, size: 28, bottomLine: true }),
      ], 420));
    }
    for (let index = 0; index < block.pairs.length; index += 2) {
      const cells = [block.pairs[index], block.pairs[index + 1]].flatMap((pair) => [
        textCell(pair?.[0] ?? "", { width: label, bold: true }),
        textCell(valueText(pair?.[1]), { width: value }),
      ]);
      rows.push(tableRow(cells, 300));
    }
    return table([label, value, label, value], rows, "box");
  }

  if (block.type === "grid") {
    const available = TEXT_WIDTH - (block.eyes ? EYE_WIDTH : 0);
    const widths = block.labels.map((_, index) =>
      block.widths ? (available * block.widths[index]) / 100 : available / block.labels.length);
    const eye = (text = "") => (block.eyes ? [textCell(text, { width: EYE_WIDTH, bold: true, align: "center" })] : []);
    const rows = [
      [...eye(), textCell(block.title, { width: available, span: block.labels.length, shade: true, bold: true, align: "center" })],
      [...eye(), ...block.labels.map((text, index) => textCell(text, { width: widths[index], shade: true, bold: true, align: "center" }))],
      ...block.rows.map((values, rowIndex) => [
        ...eye(rowIndex ? "L" : "R"),
        ...values.map((value, index) => textCell(valueText(value), {
          width: widths[index],
          align: !block.eyes && block.widths && index === 0 ? "start" : "center",
        })),
      ]),
    ];
    const columns = [...(block.eyes ? [EYE_WIDTH] : []), ...widths];
    // Eye tables read left to right, R/L first, as prescriptions are written. The table stays right-to-left
    // like the rest of the document, so its columns are given in reverse: Word and LibreOffice both show them in order.
    const ordered = <T,>(items: T[]) => (block.eyes ? [...items].reverse() : items);
    return table(ordered(columns), rows.map((cells, index) => tableRow(ordered(cells), index < 2 ? 300 : 340)), "grid");
  }

  const half = TEXT_WIDTH / 2;
  const notes = block.notes
    .filter(([, value]) => value)
    .map(([title, value]) => paragraph(run(`${title}: `, { bold: true }) + run(valueText(value))))
    .join("");
  if (!block.charges) {
    return table([half, half], [
      tableRow([textCell("הערות", { width: TEXT_WIDTH, span: 2, shade: true, bold: true, align: "center" })]),
      tableRow([tableCell(notes, { width: TEXT_WIDTH, span: 2, top: true })], 1100),
    ], "grid");
  }
  const chargeWidths = [half * 0.45, half * 0.55 - 220];
  const charges = table(
    chargeWidths,
    block.charges.map(([label, value]) => tableRow([
      textCell(label, { width: chargeWidths[0], bold: true }),
      textCell(valueText(value), { width: chargeWidths[1] }),
    ], 300)),
    "none",
    half - 220,
  ).replace(/<w:insideH w:val="nil"\/>/, LINE.replace("LINE", "insideH").replace("000000", "999999"));
  return table([half, half], [
    tableRow([
      textCell("הערות", { width: half, shade: true, bold: true, align: "center" }),
      textCell("חיובים", { width: half, shade: true, bold: true, align: "center" }),
    ]),
    tableRow([tableCell(notes, { width: half, top: true }), tableCell(`${charges}${paragraph("")}`, { width: half, top: true })], 1100),
  ], "grid");
}

/** The body of the Word document: the same boxes and tables as the printed order. */
export function orderFormDocumentXml(form: OrderForm): string {
  const body = [topLine(form), ...form.blocks.map(blockXml)].join(GAP);
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
