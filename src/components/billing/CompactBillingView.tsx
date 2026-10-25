import React from "react";
import { useTranslation } from "react-i18next";
import { Check, History, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BillingLineItem, type BillingLineField } from "./BillingLineItem";
import type { Billing, OrderLineItem } from "@/lib/db/schema-interface";
import { cn } from "@/utils/tailwind";


interface CompactBillingViewProps {
  items: OrderLineItem[];
  billing: Billing;
  isEditing: boolean;
  balanceDue: number;
  formatCurrency: (value?: number | null, currency?: string) => string;
  formatNumber: (value?: number | null) => string;
  onAddItem: () => void;
  onItemChange: (id: number, field: BillingLineField, value: string) => void;
  onDeleteItem: (id: number) => void;
  onBillingInput: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onOpenHistory: () => void;
  paymentMenu: React.ReactNode;
}

const SummaryRow = ({
  label,
  children,
  className,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) => (
  <div className={cn("flex min-h-8 items-center justify-between gap-3 text-sm", className)}>
    <span className="text-muted-foreground flex min-w-0 items-center gap-1">{label}</span>
    <span className="flex shrink-0 items-center gap-1.5 tabular-nums">{children}</span>
  </div>
);

export function CompactBillingView({
  items,
  billing,
  isEditing,
  balanceDue,
  formatCurrency,
  formatNumber,
  onAddItem,
  onItemChange,
  onDeleteItem,
  onBillingInput,
  onOpenHistory,
  paymentMenu,
}: CompactBillingViewProps) {
  const { t } = useTranslation();
  const discount = Number(billing.discount_amount) || 0;
  const total = Number(billing.total_after_discount) || 0;
  const settled = total > 0 && balanceDue <= 0;

  const [openItemId, setOpenItemId] = React.useState<number | null>(null);
  const knownIds = React.useRef<Set<number> | null>(null);

  React.useEffect(() => {
    const ids = new Set(items.map((item) => item.id!));
    const added = knownIds.current
      ? items.find((item) => !knownIds.current!.has(item.id!))
      : undefined;
    knownIds.current = ids;
    if (isEditing && added) setOpenItemId(added.id!);
  }, [items, isEditing]);

  React.useEffect(() => {
    if (!isEditing) setOpenItemId(null);
  }, [isEditing]);

  const summaryInput = (name: string, value?: number | null, step = "0.01", width = "w-24") => (
    <Input
      name={name}
      type="number"
      min="0"
      step={step}
      dir="ltr"
      value={formatNumber(value)}
      onChange={onBillingInput}
      placeholder="0"
      className={cn("h-7 px-2 text-end text-sm tabular-nums", width)}
      wrapperClassName={width}
    />
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto border-t px-4" style={{ scrollbarWidth: "none" }}>
        <div className="flex h-12 items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t("orderGroupBillingItems")}</h3>
          {isEditing && (
            <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onAddItem}>
              <span>{t("orderGroupAddItem")}</span>
              <Plus className="size-4" />
            </Button>
          )}
        </div>
        {items.length ? (
          <ul className="divide-y pb-2">
            {items.map((item) => (
              <BillingLineItem
                key={item.id}
                item={item}
                editable={isEditing}
                open={openItemId === item.id}
                onOpenChange={(open) => setOpenItemId(open ? item.id! : null)}
                onChange={onItemChange}
                onDelete={onDeleteItem}
                formatCurrency={formatCurrency}
                formatNumber={formatNumber}
              />
            ))}
          </ul>
        ) : (
          <div className="text-muted-foreground mb-4 rounded-lg border border-dashed py-8 text-center text-sm">
            {t("orderWorkspace.noItems")}
          </div>
        )}
      </div>

      <div data-quiet-fields className="bg-muted/30 shrink-0 space-y-1 border-t px-4 pt-3 pb-4">
        <SummaryRow label={t("orderWorkspace.subtotal")}>
          {formatCurrency(billing.total_before_discount)}
        </SummaryRow>
        {isEditing ? (
          <SummaryRow label={t("orderGroupDiscount")}>
            {summaryInput("discount_amount", billing.discount_amount)}
            {summaryInput("discount_percent", billing.discount_percent, "0.01", "w-16")}
            <span className="text-muted-foreground text-xs">%</span>
          </SummaryRow>
        ) : discount > 0 ? (
          <SummaryRow label={t("orderGroupDiscount")}>
            <span className="text-muted-foreground text-xs">({formatNumber(billing.discount_percent)}%)</span>
            <span>−{formatCurrency(discount)}</span>
          </SummaryRow>
        ) : null}
        <SummaryRow label={t("orderWorkspace.total")} className="font-medium">
          <span className="text-foreground">{formatCurrency(total)}</span>
        </SummaryRow>
        <SummaryRow
          label={
            <>
              {t("orderGroupPaid")}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={onOpenHistory}
                aria-label={t("orderGroupPaymentHistory")}
                title={t("orderGroupPaymentHistory")}
              >
                <History className="size-3.5" />
              </Button>
            </>
          }
        >
          {isEditing
            ? summaryInput("prepayment_amount", billing.prepayment_amount)
            : formatCurrency(billing.prepayment_amount)}
        </SummaryRow>
        <SummaryRow label={t("orderGroupInstallments")}>
          {isEditing
            ? summaryInput("installment_count", billing.installment_count, "1")
            : billing.installment_count || 1}
        </SummaryRow>

        <div className="mt-2 flex items-end justify-between gap-3 border-t pt-3">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs">{t("orderGroupBalance")}</div>
            {settled && (
              <div className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="size-3" />
                {t("orderWorkspace.paidInFull")}
              </div>
            )}
          </div>
          <div className="text-xl font-semibold tabular-nums">{formatCurrency(balanceDue)}</div>
        </div>
        <div className="pt-3">{paymentMenu}</div>
      </div>
    </div>
  );
}
