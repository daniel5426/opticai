import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Search } from "lucide-react";
import { CustomModal } from "@/components/ui/custom-modal";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Order } from "@/lib/db/schema-interface";
import { formatIsoDate } from "@/lib/iso-date";
import {
  loadExamPrescriptions,
  loadOrders,
  orderPrescription,
  prescriptionAsOrder,
  prescriptionSummary,
  type ExamPrescription,
  type PrescriptionKind,
} from "@/lib/prescription-sources";
import { useAppLocale } from "@/localization/use-app-locale";

interface PrescriptionSourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  kind: PrescriptionKind;
  /** Fills the card from an order, or from an exam's prescription given in an order's shape. */
  onSelect: (order: Order) => void;
}

type Source = "orders" | "exams";

interface Row {
  key: string;
  date: string;
  title: string;
  summary: string;
  pick: () => void;
}

/** Where a card's earlier prescription comes from: the client's orders or the prescription of an earlier exam. */
export function PrescriptionSourceModal({ isOpen, onClose, clientId, kind, onSelect }: PrescriptionSourceModalProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [source, setSource] = useState<Source>("orders");
  const [dateFilter, setDateFilter] = useState("");
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [exams, setExams] = useState<ExamPrescription[] | null>(null);

  useEffect(() => {
    if (!isOpen || !clientId) return;
    let cancelled = false;
    void loadOrders(clientId, kind).then((rows) => !cancelled && setOrders(rows)).catch(() => !cancelled && setOrders([]));
    return () => {
      cancelled = true;
    };
  }, [isOpen, clientId, kind]);

  useEffect(() => {
    if (!isOpen || !clientId || source !== "exams" || exams) return;
    let cancelled = false;
    void loadExamPrescriptions(clientId, kind).then((rows) => !cancelled && setExams(rows)).catch(() => !cancelled && setExams([]));
    return () => {
      cancelled = true;
    };
  }, [isOpen, clientId, kind, source, exams]);

  const examTabLabel = t(kind === "glasses" ? "orderPrescriptionFinalTitle" : "orderPrescriptionContactTitle");
  const loaded = source === "orders" ? orders : exams;
  const rows: Row[] | null = useMemo(() => {
    if (source === "orders") {
      return orders?.map((order, index) => ({
        key: `order-${order.id ?? index}`,
        date: order.order_date || "",
        title: order.type || t("prescriptionSourceOrder"),
        summary: prescriptionSummary(orderPrescription(order, kind)),
        pick: () => onSelect(order),
      })) ?? null;
    }
    return exams?.map(({ exam, prescription }) => ({
      key: `exam-${exam.id}`,
      date: exam.exam_date || "",
      title: exam.test_name || examTabLabel,
      summary: prescriptionSummary(prescription),
      pick: () => onSelect(prescriptionAsOrder(prescription, kind)),
    })) ?? null;
  }, [source, orders, exams, kind, onSelect, t, examTabLabel]);
  const shown = rows?.filter((row) => !dateFilter.trim() || formatIsoDate(row.date).includes(dateFilter.trim()));

  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={t(kind === "glasses" ? "prescriptionSourceGlasses" : "prescriptionSourceContact")}
      width="max-w-md"
      className="h-[min(60vh,32rem)]"
    >
      <div className="flex h-full flex-col gap-3" dir={direction}>
        <Tabs value={source} onValueChange={(value) => setSource(value as Source)} dir={direction}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="orders">{t("prescriptionSourceOrdersTab")}</TabsTrigger>
            <TabsTrigger value="exams">{examTabLabel}</TabsTrigger>
          </TabsList>
        </Tabs>

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
          {!loaded ? (
            <div className="flex justify-center py-10">
              <Loader2 className="text-muted-foreground size-6 animate-spin" aria-hidden="true" />
            </div>
          ) : !shown?.length ? (
            <p className="text-muted-foreground py-10 text-center text-sm">
              {t(source === "orders" ? "prescriptionSourceNoOrders" : "prescriptionSourceNoExams")}
            </p>
          ) : (
            shown.map((row) => (
              <button
                key={row.key}
                type="button"
                onClick={row.pick}
                className="hover:bg-muted/60 hover:border-border focus-visible:ring-ring flex w-full items-center gap-3 rounded-lg border border-transparent px-3 py-2.5 text-start transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{row.title}</div>
                  {row.summary && (
                    <div className="text-muted-foreground truncate text-xs tabular-nums" dir="ltr" style={{ textAlign: direction === "rtl" ? "right" : "left" }}>
                      {row.summary}
                    </div>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">{row.date ? formatIsoDate(row.date) : "—"}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </CustomModal>
  );
}
