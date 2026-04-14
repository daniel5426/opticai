import { buildContactOrderPrintModel, buildRegularOrderPrintModel } from "./build-print-models";
import { loadOrderExportContext } from "./load-order-export-context";
import { renderOrderDocx } from "./render-order-docx";
import type { OrderExportKind } from "./types";

export async function exportOrderToDocx({
  orderId,
  kind,
}: {
  orderId: number;
  kind: OrderExportKind;
}) {
  if (!orderId) {
    throw new Error("חסר מזהה הזמנה לייצוא");
  }

  const context = await loadOrderExportContext({ orderId, kind });
  const data =
    kind === "contact"
      ? buildContactOrderPrintModel(context)
      : buildRegularOrderPrintModel(context);

  await renderOrderDocx({ kind, data });
}
