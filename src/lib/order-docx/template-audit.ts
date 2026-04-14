import fs from "node:fs";
import path from "node:path";
import PizZip from "pizzip";
import type { OrderExportKind } from "./types";

const TEMPLATE_FILES: Record<OrderExportKind, string> = {
  regular: "regular-order.docx",
  contact: "contact-order.docx",
};

export function getOrderTemplatePath(kind: OrderExportKind) {
  return path.resolve(process.cwd(), "public", "templates", TEMPLATE_FILES[kind]);
}

export function extractTemplatePlaceholders(kind: OrderExportKind): string[] {
  const filePath = getOrderTemplatePath(kind);
  const zip = new PizZip(fs.readFileSync(filePath));
  const xml = zip.file("word/document.xml")?.asText() || "";
  return Array.from(new Set(xml.match(/\{([A-Za-z0-9_]+)\}/g)?.map((token) => token.slice(1, -1)) || [])).sort();
}
