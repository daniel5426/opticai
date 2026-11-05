import React from "react";
import { useTranslation } from "react-i18next";
import { Check, History, Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BillingLineItem, type BillingLineField } from "./BillingLineItem";
import type { Billing, OrderLineItem } from "@/lib/db/schema-interface";
import { useAppLocale } from "@/localization/use-app-locale";
import { cn } from "@/utils/tailwind";


interface CompactBillingViewProps {
  items: OrderLineItem[];
  billing: Billing;
  isEditing: boolean;
  disabled?: boolean;
  onSave?: () => Promise<boolean>;
  onSummarySave?: (field: string, value: number) => Promise<boolean>;
  balanceDue: number;
  formatCurrency: (value?: number | null, currency?: string) => string;
  formatNumber: (value?: number | null) => string;
  onAddItem: () => void;
  onAddDiscount?: () => void;
  onItemChange: (id: number, field: BillingLineField, value: string) => void;
  onDeleteItem: (id: number) => void | Promise<boolean>;
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
  <div className={cn("group/summary flex min-h-8 items-center justify-between gap-3 text-sm", className)}>
    <span className="text-muted-foreground flex min-w-0 items-center gap-1">{label}</span>
    <span dir="ltr" className="flex shrink-0 items-center gap-1.5 tabular-nums">{children}</span>
  </div>
);

export function CompactBillingView({
  items,
  billing,
  isEditing,
  disabled = false,
  onSave,
  onSummarySave,
  balanceDue,
  formatCurrency,
  formatNumber,
  onAddItem,
  onAddDiscount,
  onItemChange,
  onDeleteItem,
  onOpenHistory,
  paymentMenu,
}: CompactBillingViewProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const discount = Number(billing.discount_amount) || 0;
  const total = Number(billing.total_after_discount) || 0;
  const settled = total > 0 && balanceDue <= 0;

  const [openItemId, setOpenItemId] = React.useState<number | null>(null);
  const [summaryField, setSummaryField] = React.useState<string | null>(null);
  const [summaryValue, setSummaryValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const addingItem = React.useRef(false);
  const knownIds = React.useRef<Set<number> | null>(null);

  React.useEffect(() => {
    const ids = new Set(items.map((item) => item.id!));
    const added = knownIds.current
      ? items.find((item) => !knownIds.current!.has(item.id!))
      : undefined;
    knownIds.current = ids;
    if (isEditing && added && addingItem.current) setOpenItemId(added.id!);
    addingItem.current = false;
  }, [items, isEditing]);

  React.useEffect(() => {
    if (!isEditing) setOpenItemId(null);
  }, [isEditing]);

  const closeItem = async () => {
    setSaving(true);
    try { if (!onSave || await onSave()) setOpenItemId(null); }
    finally { setSaving(false); }
  };
  const summaryValueView = (name: string, label: string, value?: number | null, step = "0.01", currency = true) => {
    const editingValue = summaryField === name;
    const saveValue = async () => {
      const next = Number(summaryValue);
      if (!Number.isFinite(next) || next < 0 || (step === "1" && !Number.isInteger(next))) return;
      setSaving(true);
      try { if (await onSummarySave?.(name, next)) setSummaryField(null); }
      finally { setSaving(false); }
    };
    return editingValue ? <>
      <Input autoFocus aria-label={label} name={name} type="number" min="0" step={step} dir="ltr"
        value={summaryValue} onChange={event => setSummaryValue(event.target.value)}
        onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); void saveValue(); } if (event.key === "Escape") { event.stopPropagation(); setSummaryField(null); } }}
        className="h-7 px-2 text-end text-sm tabular-nums" wrapperClassName="w-24" />
      <Button type="button" size="icon" variant="ghost" className="size-7" disabled={saving} aria-label={t("orderGroupSave")} onClick={() => void saveValue()}><Check className="size-3.5" /></Button>
      <Button type="button" size="icon" variant="ghost" className="size-7" disabled={saving} aria-label={t("cancel")} onClick={() => setSummaryField(null)}><X className="size-3.5" /></Button>
    </> : <>
      <span dir={direction}>{currency ? formatCurrency(value) : value || 1}</span>
      {isEditing && onSummarySave && <Button type="button" size="icon" variant="ghost"
        className="size-7 opacity-0 group-hover/summary:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100"
        aria-label={t("orderWorkspace.editValue", { value: label })}
        onClick={() => { setSummaryField(name); setSummaryValue(String(value || 0)); }}><Pencil className="size-3.5" /></Button>}
    </>;
  };

  return (
    <fieldset disabled={saving || disabled} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto border-t px-4" style={{ scrollbarWidth: "none" }}>
        <div className="flex min-h-12 items-center justify-between gap-2 py-2">
          <h3 className="min-w-0 truncate text-sm font-medium">{t("orderGroupBillingItems")}</h3>
          {isEditing && (
            <div className="flex shrink-0 items-center gap-1">
            {onAddDiscount && <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 bg-primary/10 px-2 text-xs text-primary hover:bg-primary/20 hover:text-primary" onClick={() => { addingItem.current = true; onAddDiscount(); }}><span>{t("discounts.newDiscount")}</span><Plus className="size-3.5" /></Button>}
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 bg-primary/10 px-2 text-xs text-primary hover:bg-primary/20 hover:text-primary" onClick={() => { addingItem.current = true; onAddItem(); }}>
              <span>{t("orderGroupAddItem")}</span>
              <Plus className="size-3.5" />
            </Button>
            </div>
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
                onOpenChange={(open) => { if (open) setOpenItemId(item.id!); else void closeItem(); }}
                onChange={onItemChange}
                onDelete={async id => { setSaving(true); try { if (await onDeleteItem(id) !== false) setOpenItemId(null); } finally { setSaving(false); } }}
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
          {summaryValueView("total_before_discount", t("orderWorkspace.subtotal"), billing.total_before_discount)}
        </SummaryRow>
        {discount > 0 && <SummaryRow label={t("orderGroupDiscount")}>
          {summaryValueView("discount_amount", t("orderGroupDiscount"), discount)}
        </SummaryRow>}
        <SummaryRow label={t("orderWorkspace.total")} className="font-medium">
          {summaryValueView("total_after_discount", t("orderWorkspace.total"), total)}
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
          {summaryValueView("prepayment_amount", t("orderGroupPaid"), billing.prepayment_amount)}
        </SummaryRow>
        <SummaryRow label={t("orderGroupInstallments")}>
          {summaryValueView("installment_count", t("orderGroupInstallments"), billing.installment_count || 1, "1", false)}
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
    </fieldset>
  );
}
