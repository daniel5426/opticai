import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { OrderLineItem } from "@/lib/db/schema-interface";
import { isDiscountLine as discountLine } from "@/lib/discounts";
import { OrderSegmented } from "@/components/orders/layout/OrderSheet";
import { useAppLocale } from "@/localization/use-app-locale";
import { cn } from "@/utils/tailwind";

export type BillingLineField =
  | "description"
  | "sku"
  | "line_total"
  | "price"
  | "quantity"
  | "discount_percent"
  | "discount"
  | "supplied";

interface BillingLineItemProps {
  item: OrderLineItem;
  editable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (id: number, field: BillingLineField, value: string) => void;
  onDelete: (id: number) => void;
  formatCurrency: (value?: number | null, currency?: string) => string;
  formatNumber: (value?: number | null) => string;
}

const quietInput = "h-7 px-2 text-sm";

export function BillingLineItem({
  item,
  editable,
  open,
  onOpenChange,
  onChange,
  onDelete,
  formatCurrency,
  formatNumber,
}: BillingLineItemProps) {
  const { t } = useTranslation();
  const { direction } = useAppLocale();
  const [discountMode, setDiscountMode] = React.useState<"amount" | "percent">(
    item.discount_percent != null ? "percent" : "amount",
  );
  const id = item.id!;
  const discountRow = React.useRef(discountLine(item));
  if (!open) discountRow.current = discountLine(item);
  const isDiscountLine = discountRow.current;
  const changeDiscountMode = (value: string) => {
    const mode = value as "amount" | "percent";
    setDiscountMode(mode);
    if (mode === "amount") onChange(id, "discount", String(item.discount || 0));
    else {
      const before = Number(item.price || 0) * Number(item.quantity || 0);
      const percent = item.discount_percent ?? (before > 0 ? Number(item.discount || 0) / before * 100 : 0);
      onChange(id, "discount_percent", String(Math.min(100, Math.max(0, percent))));
    }
  };
  const showPriceSummary = item.price != null && item.quantity != null && !isDiscountLine;
  const total = (
    <span className="text-sm font-medium tabular-nums">
      {formatCurrency(item.line_total, item.currency)}
    </span>
  );

  const iconButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    className?: string,
  ) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn("text-muted-foreground hover:text-foreground size-7", className)}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </Button>
  );

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLLIElement>) => {
    if (event.key !== "Enter" && event.key !== "Escape") return;
    if (!(event.target instanceof HTMLInputElement)) return;
    event.preventDefault();
    onOpenChange(false);
  };

  const numberField = (
    field: "price" | "quantity" | "discount" | "discount_percent",
    label: string,
    step: string,
    width: string,
  ) => (
    <Input
      type="number"
      min="0"
      step={step}
      max={field === "discount_percent" ? 100 : undefined}
      dir="ltr"
      aria-label={label}
      title={label}
      placeholder=""
      value={formatNumber(item[field] ?? (field === "discount_percent" && Number(item.price) * Number(item.quantity) > 0 ? Math.round(Number(item.discount || 0) / (Number(item.price) * Number(item.quantity)) * 10000) / 100 : undefined))}
      onChange={(event) => onChange(id, field, event.target.value)}
      className={cn(quietInput, "text-center")}
      wrapperClassName={width}
    />
  );

  if (editable && open && isDiscountLine) {
    return (
      <li data-quiet-fields onKeyDown={handleEditorKeyDown} className="bg-muted/25 -mx-4 space-y-2 px-4 py-3">
        <div className="flex items-center gap-2">
          <Input autoFocus aria-label={t("orderGroupDescription")} placeholder={t("orderGroupDescription")}
            value={item.description || ""} onChange={event => onChange(id, "description", event.target.value)}
            className={quietInput} wrapperClassName="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center">
            {iconButton(t("orderGroupRemoveItem"), <Trash2 className="size-3.5" />, () => onDelete(id), "hover:text-destructive")}
            {iconButton(t("orderWorkspace.doneEditing"), <Check className="size-3.5" />, () => onOpenChange(false))}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          {numberField("discount", t("orderGroupDiscount"), "0.01", "w-28")}
          {total}
        </div>
      </li>
    );
  }

  if (editable && open) {
    return (
      <li
        data-quiet-fields
        onKeyDown={handleEditorKeyDown}
        className="bg-muted/25 -mx-4 flex items-start gap-3 px-4 py-3"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              aria-label={t("orderGroupDescription")}
              placeholder={t("orderGroupDescription")}
              value={item.description || ""}
              onChange={event => onChange(id, "description", event.target.value)}
              className={quietInput}
              wrapperClassName="min-w-0 flex-1"
            />
            <div className="flex shrink-0 items-center">
              {iconButton(t("orderGroupRemoveItem"), <Trash2 className="size-3.5" />, () => onDelete(id), "hover:text-destructive")}
              {iconButton(t("orderWorkspace.doneEditing"), <Check className="size-3.5" />, () => onOpenChange(false))}
            </div>
          </div>
          {isDiscountLine && <p className="text-muted-foreground text-xs">{t("discounts.rowLabel")}</p>}
          {!isDiscountLine && <>
            <div className="grid grid-cols-[4rem_minmax(0,1fr)_minmax(0,1fr)] items-end gap-2">
              <label className="min-w-0 space-y-1">
                <span className="text-muted-foreground text-xs">{t("orderGroupQuantity")}</span>
                {numberField("quantity", t("orderGroupQuantity"), "1", "w-full")}
              </label>
              <label className="min-w-0 space-y-1">
                <span className="text-muted-foreground text-xs">{t("orderGroupPrice")}</span>
                {numberField("price", t("orderGroupPrice"), "0.01", "w-full")}
              </label>
              <label className="min-w-0 space-y-1">
                <span className="text-muted-foreground text-xs">{t("orderGroupTotal")}</span>
                <Input type="number" min="0" step="0.01" dir="ltr"
                  aria-label={t("orderWorkspace.editValue", { value: t("orderGroupTotal") })}
                  value={formatNumber(item.line_total)}
                  onChange={event => { setDiscountMode("amount"); onChange(id, "line_total", event.target.value); }}
                  className={cn(quietInput, "text-center font-medium tabular-nums")} wrapperClassName="w-full" />
              </label>
            </div>
          </>}
          <div className="flex flex-wrap items-end gap-2">
            {!isDiscountLine && <Input dir="ltr" aria-label={t("orderGroupSku")} placeholder={t("orderGroupSku")}
              value={item.sku || ""} onChange={event => onChange(id, "sku", event.target.value)}
              className={cn(quietInput, "text-xs")} wrapperClassName="min-w-16 flex-1" />}
            <div className="flex shrink-0 items-end gap-1">
              <label className="space-y-1">
                <span className="text-muted-foreground text-xs">{t(!isDiscountLine && discountMode === "percent" ? "orderWorkspace.discountPercent" : "orderGroupDiscount")}</span>
                {!isDiscountLine && discountMode === "percent"
                  ? numberField("discount_percent", t("orderWorkspace.discountPercent"), "0.01", "w-28")
                  : numberField("discount", t("orderGroupDiscount"), "0.01", "w-28")}
              </label>
              {!isDiscountLine && <OrderSegmented dir={direction} value={discountMode}
                ariaLabel={t("orderWorkspace.discountMode")}
                onValueChange={changeDiscountMode}
                options={[{value: "amount", label: item.currency || "ILS"}, {value: "percent", label: "%"}]} />}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            {!isDiscountLine ? <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
              <Checkbox checked={Boolean(item.supplied)} onCheckedChange={checked => onChange(id, "supplied", String(checked === true))} />
              {t("orderGroupSupplied")}
            </label> : total}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="group flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1 space-y-0.5">
        {item.description?.trim() ? (
          <p className="text-sm break-words">{item.description}</p>
        ) : null}
        {isDiscountLine && <p className="text-muted-foreground text-xs">{t("discounts.rowLabel")}</p>}
        {(showPriceSummary || item.sku) ? <p className="text-muted-foreground text-xs">
          {showPriceSummary ? (
          <span className="tabular-nums">
            {item.quantity} × {formatCurrency(item.price, item.currency)}
          </span>
          ) : null}
          {item.sku ? (
            <>
              {showPriceSummary ? <span className="px-1">·</span> : null}
              <span dir="ltr" className="break-all">{item.sku}</span>
            </>
          ) : null}
        </p> : null}
        {item.supplied ? (
          <p className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <Check className="size-3" />
            {t("orderGroupSupplied")}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <div className="flex flex-col items-end gap-0.5">
          {!isDiscountLine && Number(item.discount) > 0 && <span
            aria-label={t("orderWorkspace.beforeDiscount")}
            className="text-muted-foreground text-xs line-through tabular-nums"
          >{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0), item.currency)}</span>}
          <span aria-label={t("orderWorkspace.afterDiscount")}>{total}</span>
        </div>
        {editable &&
          iconButton(t("orderWorkspace.editItem"), <Pencil className="size-3.5" />, () => onOpenChange(true))}
      </div>
    </li>
  );
}
