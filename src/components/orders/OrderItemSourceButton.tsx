import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { CustomModal } from "@/components/ui/custom-modal";
import { Input } from "@/components/ui/input";
import { OrdersHistoryButton } from "@/components/exam/shared/OrdersHistoryButton";
import { inputSyncManager } from "@/components/exam/shared/OptimizedInputs";
import type { Order } from "@/lib/db/schema-interface";
import { formatIsoDate } from "@/lib/iso-date";
import { loadOrders } from "@/lib/prescription-sources";
import { orderItemFill, orderItemSummary, type OrderItemKind } from "@/lib/order-item-sources";
import { useAppLocale } from "@/localization/use-app-locale";
import type { OrderPrescriptionSource } from "./OrderPrescriptionSourceButton";

const TITLE: Record<OrderItemKind, string> = {
  frame: "orderItemSourceFrame",
  lenses: "orderItemSourceLenses",
  "contact-details": "orderItemSourceContactDetails",
};
const EMPTY: Record<OrderItemKind, string> = {
  frame: "orderItemSourceNoFrame",
  lenses: "orderItemSourceNoLenses",
  "contact-details": "orderItemSourceNoContactDetails",
};

interface Row {
  order: Order;
  values: Record<string, string> | null;
  summary: string[];
}

/** The client's earlier orders, each with what it holds for the card; picking one fills the card from it. */
export function OrderItemSourceModal({
  isOpen,
  onClose,
  source,
  kind,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  source: OrderPrescriptionSource;
  kind: OrderItemKind;
  onSelect: (values: Record<string, string>) => void;
}) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [dateFilter, setDateFilter] = useState("");

  useEffect(() => {
    if (!isOpen || !source.clientId) return;
    let cancelled = false;
    void loadOrders(source.clientId, kind === "contact-details" ? "contact" : "glasses")
      .then((rows) => !cancelled && setOrders(rows.filter((order) => !source.orderId || order.id !== source.orderId)))
      .catch(() => !cancelled && setOrders([]));
    return () => {
      cancelled = true;
    };
  }, [isOpen, source.clientId, source.orderId, kind]);

  const rows: Row[] | null = useMemo(
    () =>
      orders?.map((order) => {
        const values = orderItemFill(order, kind);
        return { order, values, summary: orderItemSummary(values, kind) };
      }) ?? null,
    [orders, kind],
  );
  const shown = rows?.filter((row) => !dateFilter.trim() || formatIsoDate(row.order.order_date || "").includes(dateFilter.trim()));

  return (
    <CustomModal isOpen={isOpen} onClose={onClose} title={t(TITLE[kind])} width="max-w-md" className="h-[min(60vh,32rem)]">
      <div className="flex h-full flex-col gap-3" dir={direction}>
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2" aria-hidden="true" />
          <Input
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            placeholder={t("prescriptionSourceDateSearch")}
            aria-label={t("prescriptionSourceDateSearch")}
            className="h-9 ps-9"
            dir={direction}
          />
        </div>

        <div className="-mx-1 flex-1 space-y-1 overflow-y-auto px-1" style={{ scrollbarWidth: "thin" }}>
          {!shown ? (
            <div className="flex justify-center py-10">
              <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
            </div>
          ) : !shown.length ? (
            <p className="text-muted-foreground py-10 text-center text-sm">{t("prescriptionSourceNoOrders")}</p>
          ) : (
            shown.map(({ order, values, summary }, index) => (
              <button
                key={order.id ?? index}
                type="button"
                disabled={!values}
                onClick={() => values && onSelect(values)}
                className="hover:bg-muted/60 hover:border-border focus-visible:ring-ring flex w-full items-start gap-3 rounded-lg border border-transparent px-3 py-2.5 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent"
              >
                <div className="min-w-0 flex-1">
                  <div className={`truncate text-sm font-medium ${values ? "" : "text-muted-foreground"}`}>
                    {order.type || t("prescriptionSourceOrder")}
                  </div>
                  {values ? (
                    summary.map((line) => (
                      <div key={line} className="text-muted-foreground truncate text-xs" dir="auto" style={{ textAlign: direction === "rtl" ? "right" : "left" }}>
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className="text-muted-foreground/70 text-[11px] italic">{t(EMPTY[kind])}</div>
                  )}
                </div>
                <span className={`shrink-0 pt-0.5 text-xs tabular-nums ${values ? "text-muted-foreground" : "text-muted-foreground/60"}`}>
                  {order.order_date ? formatIsoDate(order.order_date) : "—"}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </CustomModal>
  );
}

/** Beside an order card's title: fills the card (frame, lenses or contact lens details) from one of the client's earlier orders. */
export function OrderItemSourceButton({
  source,
  kind,
  onFill,
}: {
  source: OrderPrescriptionSource;
  kind: OrderItemKind;
  onFill: (values: Record<string, string>) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <>
      <OrdersHistoryButton onClick={() => setIsOpen(true)} />
      {isOpen && (
        <OrderItemSourceModal
          isOpen
          onClose={() => setIsOpen(false)}
          source={source}
          kind={kind}
          onSelect={(values) => {
            setIsOpen(false);
            inputSyncManager.flush();
            onFill(values);
          }}
        />
      )}
    </>
  );
}
