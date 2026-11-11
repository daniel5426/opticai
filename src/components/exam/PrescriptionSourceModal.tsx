import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Info, Loader2, Search } from "lucide-react";
import { CustomModal } from "@/components/ui/custom-modal";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Order } from "@/lib/db/schema-interface";
import { formatIsoDate } from "@/lib/iso-date";
import { contactOrderLenses } from "@/lib/old-contact-lenses-source";
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
  /** What the card would be filled from, in an order's shape. */
  source: Order;
}

const formatPower = (value: unknown) => {
  const number = Number(value);
  if (value === undefined || value === null || value === "") return "";
  if (Number.isNaN(number)) return String(value);
  return `${number > 0 ? "+" : number < 0 ? "−" : ""}${Math.abs(number).toFixed(2)}`;
};
const plain = (value: unknown) => (value === undefined || value === null ? "" : String(value));

// The columns the card fills, as its own headings name them.
const PREVIEW_COLUMNS: Record<PrescriptionKind, Array<[string, string, (value: unknown) => string]>> = {
  glasses: [["SPH", "sph", formatPower], ["CYL", "cyl", formatPower], ["AX", "ax", plain], ["PRISM", "pris", plain], ["BASE", "base", plain], ["ADD", "ad", formatPower]],
  contact: [["BC", "bc", plain], ["DIAM", "diam", plain], ["SPH", "sph", formatPower], ["CYL", "cyl", formatPower], ["AX", "ax", plain], ["VA", "va", plain]],
};

/** The prescription a row would fill the card with. */
function PrescriptionPreview({ kind, source }: { kind: PrescriptionKind; source: Order }) {
  const values: Record<string, any> = kind === "contact" ? contactOrderLenses(source) : orderPrescription(source, "glasses");
  const columns = PREVIEW_COLUMNS[kind].filter(([, field]) => ["r", "l"].some((eye) => plain(values[`${eye}_${field}`])));
  const models = kind === "contact" ? (["r", "l"] as const).map((eye) => [values[`${eye}_model`], values[`${eye}_lens_type`]].filter(Boolean).join(" · ")) : [];
  if (!columns.length && !models.some(Boolean)) return <p className="text-muted-foreground text-xs">—</p>;
  return (
    <table className="w-full text-xs tabular-nums" dir="ltr">
      <thead>
        <tr className="text-muted-foreground">
          <th className="pe-2 text-start font-medium" />
          {columns.map(([label]) => <th key={label} className="px-1.5 pb-1 text-center font-medium">{label}</th>)}
        </tr>
      </thead>
      <tbody>
        {(["r", "l"] as const).map((eye, index) => (
          <React.Fragment key={eye}>
            <tr>
              <td className="pe-2 font-semibold">{eye.toUpperCase()}</td>
              {columns.map(([label, field, format]) => <td key={label} className="px-1.5 py-0.5 text-center">{format(values[`${eye}_${field}`]) || "—"}</td>)}
            </tr>
            {models[index] && (
              <tr>
                <td />
                <td colSpan={columns.length} className="text-muted-foreground px-1.5 pb-1 text-start" dir="auto">{models[index]}</td>
              </tr>
            )}
          </React.Fragment>
        ))}
      </tbody>
    </table>
  );
}

// The sliding highlight draws the selected tab, so the tab itself stays clear.
const SLIDING_TAB = "relative z-10 data-[state=active]:bg-transparent data-[state=active]:shadow-none text-muted-foreground data-[state=active]:text-foreground transition-colors duration-300";

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
        source: order,
      })) ?? null;
    }
    return exams?.map(({ exam, prescription }) => ({
      key: `exam-${exam.id}`,
      date: exam.exam_date || "",
      title: exam.test_name || examTabLabel,
      summary: prescriptionSummary(prescription),
      source: prescriptionAsOrder(prescription, kind),
    })) ?? null;
  }, [source, orders, exams, kind, t, examTabLabel]);
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
          <TabsList className="relative grid w-full grid-cols-2">
            {/* The selection slides between the tabs. */}
            <span
              aria-hidden="true"
              className="bg-background absolute inset-y-[3px] rounded-md shadow-sm transition-[inset-inline-start] duration-300 ease-out motion-reduce:transition-none"
              style={{ width: "calc(50% - 3px)", insetInlineStart: source === "orders" ? "3px" : "50%" }}
            />
            <TabsTrigger value="orders" className={SLIDING_TAB}>{t("prescriptionSourceOrdersTab")}</TabsTrigger>
            <Tooltip>
              {/* On a wrapper: as the trigger itself, the tooltip's state would replace the tab's selected state. */}
              <TooltipTrigger asChild>
                <span className="relative flex">
                  <TabsTrigger value="exams" className={`${SLIDING_TAB} gap-1.5`}>
                    {t("prescriptionSourceExamsTab")}
                    <Info className="text-muted-foreground size-3.5 shrink-0" aria-hidden="true" />
                  </TabsTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent dir={direction} className="max-w-80 text-center" sideOffset={6}>
                {t(kind === "glasses" ? "prescriptionSourceExamsHintGlasses" : "prescriptionSourceExamsHintContact")}
              </TooltipContent>
            </Tooltip>
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
              <div key={row.key} className="hover:bg-muted/60 hover:border-border flex items-center gap-1 rounded-lg border border-transparent pe-1.5 transition-colors">
              <button
                type="button"
                onClick={() => onSelect(row.source)}
                className="focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-start focus-visible:ring-2 focus-visible:outline-none"
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
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={t("prescriptionSourcePreview")}
                    title={t("prescriptionSourcePreview")}
                    className="text-muted-foreground hover:text-foreground hover:bg-background focus-visible:ring-ring inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <Eye className="size-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="bottom" align="end" className="w-auto min-w-56 p-3" dir={direction}>
                  <div className="text-muted-foreground mb-2 text-xs">{t("prescriptionSourcePreviewTitle")}</div>
                  <PrescriptionPreview kind={kind} source={row.source} />
                </PopoverContent>
              </Popover>
              </div>
            ))
          )}
        </div>
      </div>
    </CustomModal>
  );
}
