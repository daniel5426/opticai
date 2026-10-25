import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BillingPayment } from "@/lib/db/schema-interface";
import { cn } from "@/utils/tailwind";

interface BillingPaymentMenuProps {
  direction: "rtl" | "ltr";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  disabled: boolean;
  amount: string;
  onAmountChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  onSubmit: () => void;
  paidSummary: string;
  balance: string;
  recentPayments: BillingPayment[];
  formatCurrency: (value?: number | null, currency?: string) => string;
  formatDate: (value?: string | null) => string;
  triggerClassName?: string;
  trigger?: React.ReactElement;
  status?: React.ReactNode;
}

export function BillingPaymentMenu({
  direction,
  open,
  onOpenChange,
  saving,
  disabled,
  amount,
  onAmountChange,
  date,
  onDateChange,
  onSubmit,
  paidSummary,
  balance,
  recentPayments,
  formatCurrency,
  formatDate,
  triggerClassName,
  trigger,
  status,
}: BillingPaymentMenuProps) {
  const { t } = useTranslation();

  return (
    <DropdownMenu dir={direction} open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        {trigger || <Button type="button" className={cn("h-10 w-full", triggerClassName)} disabled={saving || disabled}>
          <span>{t("orderGroupAddPayment")}</span>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        </Button>}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 p-3">
        <div className="bg-muted/30 mb-3 rounded-md border px-3 py-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">{t("orderGroupPaidTotal")}</span>
            <span className="font-medium tabular-nums">{paidSummary}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 border-t pt-1">
            <span className="text-muted-foreground">{t("orderGroupBalance")}</span>
            <span className="font-medium tabular-nums">{balance}</span>
          </div>
        </div>

        {status}
        <div className="border-t pt-3">
          <div className="text-muted-foreground mb-2 text-xs font-medium">{t("orderGroupNewPayment")}</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-muted-foreground mb-1 text-xs">{t("orderGroupAmount")}</div>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                dir="ltr"
                aria-label={t("orderGroupAmount")}
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
                className="h-9"
              />
            </div>
            <div>
              <div className="text-muted-foreground mb-1 text-xs">{t("orderGroupDate")}</div>
              <DateInput
                name="new_payment_date"
                dir={direction}
                aria-label={t("orderGroupDate")}
                value={date}
                onChange={(event) => onDateChange(event.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <div className="mt-3 flex justify-start">
            <Button size="sm" onClick={onSubmit} disabled={saving || disabled}>
              {saving ? t("orderGroupSaving") : t("orderGroupAddPayment")}
            </Button>
          </div>
        </div>

        {recentPayments.length > 0 && (
          <div className="mt-4 border-t pt-3">
            <div className="text-muted-foreground mb-2 text-xs font-medium">{t("orderGroupRecentPayments")}</div>
            <div className="space-y-1.5 text-xs">
              {recentPayments.slice(0, 3).map((payment) => (
                <div key={payment.id} className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {formatDate(payment.paid_at)}
                    {payment.kind === "adjustment" ? ` · ${t("orderGroupAdjustment")}` : ""}
                  </span>
                  <span className="tabular-nums">{formatCurrency(payment.amount, payment.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
