import { docxGenerator } from "@/lib/docx-generator";
import type {
  ContactOrderPrintModel,
  OrderExportKind,
  RegularOrderPrintModel,
} from "./types";

const TEMPLATE_PATHS: Record<OrderExportKind, string> = {
  regular: "/templates/regular-order.docx",
  contact: "/templates/contact-order.docx",
};

function buildFileName(
  kind: OrderExportKind,
  data: RegularOrderPrintModel | ContactOrderPrintModel,
) {
  const parts = [
    kind === "contact" ? "הזמנת_עדשות_מגע" : "הזמנה_רגילה",
    data.client_name,
    data.order_number,
  ].filter(Boolean);

  return `${parts.join("_")}.docx`;
}

export async function renderOrderDocx({
  kind,
  data,
}: {
  kind: OrderExportKind;
  data: RegularOrderPrintModel | ContactOrderPrintModel;
}) {
  await docxGenerator.generate(
    data,
    buildFileName(kind, data),
    TEMPLATE_PATHS[kind],
  );
}
