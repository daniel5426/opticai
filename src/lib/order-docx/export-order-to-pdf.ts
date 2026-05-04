import { buildContactOrderPrintModel, buildRegularOrderPrintModel } from "./build-print-models";
import { loadOrderExportContext } from "./load-order-export-context";
import { printOrderPdf as printRenderedOrderPdf, renderOrderPdf } from "./render-order-pdf";
import type { OrderExportKind } from "./types";

export async function exportOrderToPdf({
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

  return renderOrderPdf({ kind, data });
}

export async function printOrderPdf({
  orderId,
  kind,
}: {
  orderId: number;
  kind: OrderExportKind;
}) {
  if (!orderId) {
    throw new Error("חסר מזהה הזמנה להדפסה");
  }

  const context = await loadOrderExportContext({ orderId, kind });
  const data =
    kind === "contact"
      ? buildContactOrderPrintModel(context)
      : buildRegularOrderPrintModel(context);

  return printRenderedOrderPdf({ kind, data });
}
