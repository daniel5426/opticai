import React from "react";
import { useTranslation } from "react-i18next";
import { Check, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import type { OrderLineItem } from "@/lib/db/schema-interface";
import { isDiscountLine as discountLine } from "@/lib/discounts";
import { cn } from "@/utils/tailwind";

export type BillingLineField =
  | "description"
  | "sku"
  | "line_total"
  | "price"
  | "quantity"
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
  const id = item.id!;
  const discountRow = React.useRef(discountLine(item));
  if (discountLine(item)) discountRow.current = true;
  const isDiscountLine = discountRow.current;
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
    field: "price" | "quantity" | "discount",
    label: string,
    step: string,
    width: string,
  ) => (
    <Input
      type="number"
      min="0"
      step={step}
      dir="ltr"
      aria-label={label}
      title={label}
      placeholder={label}
      value={formatNumber(item[field])}
      onChange={(event) => onChange(id, field, event.target.value)}
      className={cn(quietInput, "text-center")}
      wrapperClassName={width}
    />
  );

  if (editable && open) {
    return (
      <li
        data-quiet-fields
        onKeyDown={handleEditorKeyDown}
        className="bg-muted/25 -mx-4 flex items-start gap-3 px-4 py-3"
      >
        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            autoFocus
            aria-label={t("orderGroupDescription")}
            placeholder={t("orderGroupDescription")}
            value={item.description || ""}
            onChange={(event) => onChange(id, "description", event.target.value)}
            className={quietInput}
          />
          {isDiscountLine && <p className="text-muted-foreground text-xs">{t("discounts.rowLabel")}</p>}
          {!isDiscountLine && <div className="text-muted-foreground flex items-center gap-1 text-xs">
            {numberField("quantity", t("orderGroupQuantity"), "1", "w-11 shrink-0")}
            <span aria-hidden="true">×</span>
            {numberField("price", t("orderGroupPrice"), "0.01", "w-20 shrink-0")}
            <span aria-hidden="true" className="px-0.5">·</span>
            <Input
              dir="ltr"
              aria-label={t("orderGroupSku")}
              placeholder={t("orderGroupSku")}
              value={item.sku || ""}
              onChange={(event) => onChange(id, "sku", event.target.value)}
              className={cn(quietInput, "text-xs")}
              wrapperClassName="min-w-0 flex-1"
            />
          </div>}
          <div className="text-muted-foreground flex items-center gap-4 text-xs">
            <label className="flex items-center gap-1.5">
              {t("orderGroupDiscount")}
              {numberField("discount", t("orderGroupDiscount"), "0.01", "w-16")}
            </label>
            {!isDiscountLine && <label className="flex cursor-pointer items-center gap-1.5">
              <Checkbox
                checked={Boolean(item.supplied)}
                onCheckedChange={(checked) =>
                  onChange(id, "supplied", String(checked === true))
                }
              />
              {t("orderGroupSupplied")}
            </label>}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <div className="flex h-7 items-center">{isDiscountLine ? total : <Input
            type="number" min="0" step="0.01" dir="ltr"
            aria-label={t("orderWorkspace.editValue", { value: t("orderGroupTotal") })}
            value={formatNumber(item.line_total)}
            onChange={event => onChange(id, "line_total", event.target.value)}
            className={cn(quietInput, "text-center font-medium tabular-nums")}
            wrapperClassName="w-24"
          />}</div>
          <div className="flex items-center">
            {iconButton(
              t("orderGroupRemoveItem"),
              <Trash2 className="size-3.5" />,
              () => onDelete(id),
              "hover:text-destructive",
            )}
            {iconButton(t("orderWorkspace.doneEditing"), <Check className="size-3.5" />, () => onOpenChange(false))}
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
        {total}
        {editable &&
          iconButton(t("orderWorkspace.editItem"), <Pencil className="size-3.5" />, () => onOpenChange(true))}
      </div>
    </li>
  );
}
