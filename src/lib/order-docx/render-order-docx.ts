import { saveAs } from "file-saver";
import { buildOrderForm } from "./order-form";
import { orderFormDocx } from "./render-order-word";
import type {
  ContactOrderPrintModel,
  OrderExportKind,
  RegularOrderPrintModel,
} from "./types";

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
  // The same paper-form layout as the printed order.
  saveAs(orderFormDocx(buildOrderForm(kind, data)), buildFileName(kind, data));
}
