import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { NotesCard } from "@/components/ui/notes-card";
import { CustomModal } from "@/components/ui/custom-modal";
import { History, Loader2, Plus, Trash2 } from "lucide-react";
import { Billing, BillingPayment, OrderLineItem } from "@/lib/db/schema-interface";
import { deleteBillingPayment, getBillingPayments } from "@/lib/db/billing-db";
import { toast } from "sonner";
import {
  formatBillingAmount,
  getBillingBalance,
  getBillingPaymentStatus,
} from "@/lib/billing-payment-status";

const roundToTwoDecimals = (value: number) => Math.round(value * 100) / 100;

const isFiniteNumber = (value: number | undefined | null): value is number =>
  typeof value === "number" && Number.isFinite(value);

const toSafeNumber = (value: number | undefined | null) =>
  isFiniteNumber(value) ? value : 0;

const MONEY_STEP = "0.01";
const PERCENT_STEP = "0.01";
const WHOLE_NUMBER_STEP = "1";

const parseNumberInput = (value: string) => {
  const numValue = parseFloat(value);
  return value === "" || !Number.isFinite(numValue)
    ? undefined
    : roundToTwoDecimals(numValue);
};

const formatNumberInputValue = (
  value: number | undefined | null,
  blankZero = false,
) =>
  !isFiniteNumber(value) || (blankZero && value === 0)
    ? ""
    : String(roundToTwoDecimals(value));

const formatPaymentDate = (value?: string | null) => {
  if (!value) return "";
  const [year, month, day] = value.split("T")[0].split("-");
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
};

interface BillingTabProps {
  billingFormData: Billing;
  setBillingFormData: React.Dispatch<React.SetStateAction<Billing>>;
  orderLineItems: OrderLineItem[];
  setOrderLineItems: React.Dispatch<React.SetStateAction<OrderLineItem[]>>;
  isEditing: boolean;
  handleDeleteOrderLineItem: (id: number) => void;
}

export function BillingTab({
  billingFormData,
  setBillingFormData,
  orderLineItems,
  setOrderLineItems,
  isEditing,
  handleDeleteOrderLineItem,
}: BillingTabProps) {
  const paymentStatus = getBillingPaymentStatus(
    billingFormData.total_after_discount,
    billingFormData.prepayment_amount,
  );
  const balanceDue = getBillingBalance(
    billingFormData.total_after_discount,
    billingFormData.prepayment_amount,
  );
  const [isPaymentHistoryOpen, setIsPaymentHistoryOpen] = React.useState(false);
  const [paymentHistory, setPaymentHistory] = React.useState<BillingPayment[]>([]);
  const [paymentHistoryLoading, setPaymentHistoryLoading] = React.useState(false);
  const [deletingPaymentIds, setDeletingPaymentIds] = React.useState<Record<number, boolean>>({});

  const loadPaymentHistory = React.useCallback(async () => {
    if (!billingFormData.id) {
      setPaymentHistory([]);
      return;
    }
    setPaymentHistoryLoading(true);
    try {
      const payments = await getBillingPayments(billingFormData.id);
      setPaymentHistory(payments);
    } finally {
      setPaymentHistoryLoading(false);
    }
  }, [billingFormData.id]);

  const openPaymentHistory = () => {
    setIsPaymentHistoryOpen(true);
    void loadPaymentHistory();
  };

  const handleDeletePayment = async (payment: BillingPayment) => {
    if (!billingFormData.id || !payment.id) return;
    setDeletingPaymentIds((prev) => ({ ...prev, [payment.id!]: true }));
    const success = await deleteBillingPayment(billingFormData.id, payment.id);
    if (success) {
      setPaymentHistory((prev) => prev.filter((item) => item.id !== payment.id));
      setBillingFormData((prev) => ({
        ...prev,
        prepayment_amount: roundToTwoDecimals(toSafeNumber(prev.prepayment_amount) - payment.amount),
      }));
      toast.success("התשלום נמחק");
    } else {
      toast.error("שגיאה במחיקת תשלום");
    }
    setDeletingPaymentIds((prev) => ({ ...prev, [payment.id!]: false }));
  };

  // Auto-calculate total from line items
  React.useEffect(() => {
    if (!isEditing) return;

    const sum = orderLineItems.reduce(
      (acc, item) => acc + toSafeNumber(item.line_total),
      0,
    );
    if (
      Math.abs(sum - toSafeNumber(billingFormData.total_before_discount)) > 0.01
    ) {
      setBillingFormData((prev) => {
        const next = { ...prev, total_before_discount: sum };
        // Recalculate after discount
        if (sum <= 0) {
          next.discount_amount = 0;
          next.discount_percent = 0;
          next.total_after_discount = 0;
        } else if (toSafeNumber(next.discount_percent) > 0) {
          const discountAmount = roundToTwoDecimals(
            (sum * toSafeNumber(next.discount_percent)) / 100,
          );
          next.discount_amount = discountAmount;
          next.total_after_discount = roundToTwoDecimals(sum - discountAmount);
        } else if (toSafeNumber(next.discount_amount) > 0) {
          next.total_after_discount = roundToTwoDecimals(
            sum - toSafeNumber(next.discount_amount),
          );
          const discountPercent =
            sum > 0 ? (toSafeNumber(next.discount_amount) / sum) * 100 : 0;
          next.discount_percent = roundToTwoDecimals(discountPercent);
        } else {
          next.discount_amount = 0;
          next.discount_percent = 0;
          next.total_after_discount = roundToTwoDecimals(sum);
        }
        return next;
      });
    }
  }, [orderLineItems, isEditing]);

  const handleBillingInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = e.target;

    const numericFields = [
      "total_before_discount",
      "discount_amount",
      "discount_percent",
      "total_after_discount",
      "prepayment_amount",
      "installment_count",
    ];
    if (numericFields.includes(name)) {
      const parsedValue = parseNumberInput(value);
      setBillingFormData((prev) => {
        const inputValue =
          name === "discount_amount" || name === "discount_percent"
            ? (parsedValue ?? 0)
            : parsedValue;
        const newData = {
          ...prev,
          [name]: inputValue,
        };
        const totalBefore = toSafeNumber(newData.total_before_discount);
        const discountAmount = toSafeNumber(newData.discount_amount);
        const discountPercent = toSafeNumber(newData.discount_percent);

        if (name === "discount_amount") {
          if (discountAmount > 0 && totalBefore > 0) {
            const nextDiscountPercent = (discountAmount / totalBefore) * 100;
            newData.discount_percent = roundToTwoDecimals(nextDiscountPercent);
            newData.total_after_discount = roundToTwoDecimals(
              totalBefore - discountAmount,
            );
          } else {
            newData.discount_amount = 0;
            newData.discount_percent = 0;
            newData.total_after_discount = roundToTwoDecimals(totalBefore);
          }
        } else if (name === "discount_percent") {
          if (discountPercent > 0 && totalBefore > 0) {
            const nextDiscountAmount = roundToTwoDecimals(
              (totalBefore * discountPercent) / 100,
            );
            newData.discount_amount = nextDiscountAmount;
            newData.total_after_discount = roundToTwoDecimals(
              totalBefore - nextDiscountAmount,
            );
          } else {
            newData.discount_amount = 0;
            newData.discount_percent = 0;
            newData.total_after_discount = roundToTwoDecimals(totalBefore);
          }
        } else if (name === "total_before_discount") {
          const roundedTotalBefore = roundToTwoDecimals(totalBefore);
          if (discountPercent > 0) {
            const discountAmount = roundToTwoDecimals(
              (roundedTotalBefore * discountPercent) / 100,
            );
            newData.discount_amount = discountAmount;
            newData.total_after_discount = roundToTwoDecimals(
              roundedTotalBefore - discountAmount,
            );
          } else if (discountAmount > 0) {
            newData.total_after_discount = roundToTwoDecimals(
              roundedTotalBefore - discountAmount,
            );
            const discountPercent =
              roundedTotalBefore > 0
                ? (discountAmount / roundedTotalBefore) * 100
                : 0;
            newData.discount_percent = roundToTwoDecimals(discountPercent);
          } else {
            newData.discount_amount = 0;
            newData.discount_percent = 0;
            newData.total_after_discount = roundedTotalBefore;
          }
        }

        return newData;
      });
    } else {
      setBillingFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleLineItemChange = (
    id: number,
    field: keyof OrderLineItem,
    value: string,
  ) => {
    setOrderLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item };
          const numericFields = ["price", "quantity", "discount"];
          if (numericFields.includes(field)) {
            (updatedItem as any)[field] = parseNumberInput(value);
          } else if (field === "supplied") {
            (updatedItem as any)[field] = value === "true";
          } else {
            (updatedItem as any)[field] = value;
          }

          if (
            field === "price" ||
            field === "quantity" ||
            field === "discount"
          ) {
            const price = toSafeNumber(updatedItem.price);
            const quantity = toSafeNumber(updatedItem.quantity);
            const discount = toSafeNumber(updatedItem.discount);
            updatedItem.line_total = roundToTwoDecimals(
              price * quantity - discount,
            );
          }

          return updatedItem;
        }
        return item;
      }),
    );
  };

  const addNewLineItem = () => {
    const tempId = -(
      Math.max(0, ...orderLineItems.map((item) => Math.abs(item.id || 0))) + 1
    );
    const itemToAdd: OrderLineItem = {
      id: tempId,
      billings_id: billingFormData.id || 0,
      description: "",
      sku: "",
      price: 0,
      quantity: 1,
      discount: 0,
      supplied_by: "",
      supplied: false,
      line_total: 0,
    };

    setOrderLineItems((prev) => {
      const newItems = [...prev, itemToAdd];
      return newItems;
    });
  };

  const deleteLineItem = (id: number) => {
    handleDeleteOrderLineItem(id);
  };

  return (
    <div
      className="pt-4 pb-10"
      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
    >
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">פריטי חיוב</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              addNewLineItem();
            }}
            disabled={!isEditing}
            className="h-8"
          >
            <Plus className="ml-1 h-4 w-4" />
            הוסף פריט
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border-x border-t">
            <table className="w-full table-fixed rounded-md">
              <colgroup>
                <col style={{ width: "32%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "8%" }} />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead>
                <tr className="border-b">
                  <th className="p-2 text-right text-sm font-medium">תיאור</th>
                  <th className="p-2 text-right text-sm font-medium">SKU</th>
                  <th className="p-2 text-right text-sm font-medium">מחיר</th>
                  <th className="p-2 text-right text-sm font-medium">כמות</th>
                  <th className="p-2 text-right text-sm font-medium">הנחה</th>
                  <th className="p-2 text-right text-sm font-medium">סופק</th>
                  <th className="p-2 text-right text-sm font-medium">סה"כ</th>
                </tr>
              </thead>
              <tbody>
                {orderLineItems.map((item) => (
                  <tr key={item.id} className="rounded-md border-b">
                    <td className="p-2">
                      {isEditing ? (
                        <Input
                          value={item.description || ""}
                          onChange={(e) =>
                            handleLineItemChange(
                              item.id!,
                              "description",
                              e.target.value,
                            )
                          }
                          className="h-8 w-full text-xs"
                        />
                      ) : (
                        <span className="block w-full truncate text-sm">
                          {item.description}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <Input
                          value={item.sku || ""}
                          onChange={(e) =>
                            handleLineItemChange(
                              item.id!,
                              "sku",
                              e.target.value,
                            )
                          }
                          className="h-8 w-full text-xs"
                        />
                      ) : (
                        <span className="block w-full truncate text-sm">
                          {item.sku}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          step={MONEY_STEP}
                          value={formatNumberInputValue(item.price, true)}
                          onChange={(e) =>
                            handleLineItemChange(
                              item.id!,
                              "price",
                              e.target.value,
                            )
                          }
                          className="h-8 w-full text-xs"
                        />
                      ) : (
                        <span className="block w-full truncate text-sm">
                          {item.price}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          step={WHOLE_NUMBER_STEP}
                          value={formatNumberInputValue(item.quantity, true)}
                          onChange={(e) =>
                            handleLineItemChange(
                              item.id!,
                              "quantity",
                              e.target.value,
                            )
                          }
                          className="h-8 w-full text-xs"
                        />
                      ) : (
                        <span className="block w-full truncate text-sm">
                          {item.quantity}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <Input
                          type="number"
                          step={MONEY_STEP}
                          value={formatNumberInputValue(item.discount, true)}
                          onChange={(e) =>
                            handleLineItemChange(
                              item.id!,
                              "discount",
                              e.target.value,
                            )
                          }
                          className="h-8 w-full text-xs"
                        />
                      ) : (
                        <span className="block w-full truncate text-sm">
                          {item.discount}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      {isEditing ? (
                        <Select
                          value={item.supplied ? "true" : "false"}
                          onValueChange={(value) =>
                            handleLineItemChange(item.id!, "supplied", value)
                          }
                        >
                          <SelectTrigger className="h-8 w-full text-xs">
                            <SelectValue placeholder="בחר" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true" className="text-sm">
                              כן
                            </SelectItem>
                            <SelectItem value="false" className="text-sm">
                              לא
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="block w-full truncate text-sm">
                          {item.supplied ? "כן" : "לא"}
                        </span>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="block min-w-0 flex-1 truncate text-sm">
                          {isFiniteNumber(item.line_total)
                            ? item.line_total.toFixed(2)
                            : ""}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteLineItem(item.id!)}
                          disabled={!isEditing}
                          className="h-6 w-6 shrink-0 p-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="mt-4 grid grid-cols-3 gap-4 md:grid-cols-3">
        <Card className="col-span-1 h-full py-5 shadow-md">
          <CardContent>
            <div className="grid grid-cols-2 items-end gap-3 md:grid-cols-3">
              <div>
                <Label className="text-sm">מספר תשלומים</Label>
                <div className="mt-1.5">
                  <Input
                    name="installment_count"
                    type="number"
                    step={WHOLE_NUMBER_STEP}
                    value={formatNumberInputValue(
                      billingFormData.installment_count,
                      true,
                    )}
                    onChange={handleBillingInputChange}
                    disabled={!isEditing}
                    placeholder="1"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-sm">שולם</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={openPaymentHistory}
                    aria-label="היסטוריית תשלומים"
                  >
                    <History className="h-4 w-4" />
                  </Button>
                </div>
                <div className="mt-1.5">
                  <Input
                    name="prepayment_amount"
                    type="number"
                    step={MONEY_STEP}
                    value={formatNumberInputValue(
                      billingFormData.prepayment_amount,
                      true,
                    )}
                    onChange={handleBillingInputChange}
                    disabled={!isEditing}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">סה"כ לפני הנחה</Label>
                <div className="mt-1.5">
                  <Input
                    name="total_before_discount"
                    type="number"
                    step={MONEY_STEP}
                    value={formatNumberInputValue(
                      billingFormData.total_before_discount,
                      true,
                    )}
                    onChange={handleBillingInputChange}
                    disabled
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">הנחה (₪)</Label>
                <Input
                  name="discount_amount"
                  type="number"
                  step={MONEY_STEP}
                  value={formatNumberInputValue(
                    billingFormData.discount_amount ?? 0,
                    true,
                  )}
                  onChange={handleBillingInputChange}
                  disabled={!isEditing}
                  className="flex-1"
                  placeholder="0.00"
                />
              </div>
              <div>
                <Label className="text-sm">הנחה (%)</Label>
                <Input
                  name="discount_percent"
                  type="number"
                  step={PERCENT_STEP}
                  value={formatNumberInputValue(
                    billingFormData.discount_percent ?? 0,
                    true,
                  )}
                  onChange={handleBillingInputChange}
                  disabled={!isEditing}
                  className="flex-1"
                  placeholder="0%"
                />
              </div>

              <div>
                <Label className="text-sm">אחרי הנחה</Label>
                <div className="mt-1.5">
                  <Input
                    name="total_after_discount"
                    type="number"
                    step={MONEY_STEP}
                    value={formatNumberInputValue(
                      billingFormData.total_after_discount,
                      true,
                    )}
                    onChange={handleBillingInputChange}
                    disabled
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">סטטוס תשלום</Label>
                <div className="bg-muted/30 mt-1.5 flex h-10 items-center rounded-md border px-3 text-sm">
                  {paymentStatus}
                </div>
              </div>
              <div>
                <Label className="text-sm">יתרה לתשלום</Label>
                <div className="bg-muted/30 mt-1.5 flex h-10 items-center rounded-md border px-3 text-sm">
                  {formatBillingAmount(balanceDue)}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="col-span-2 h-full">
          <NotesCard
            height="full"
            title="הערות"
            value={billingFormData.notes || ""}
            onChange={(value) =>
              setBillingFormData((prev) => ({ ...prev, notes: value }))
            }
            disabled={!isEditing}
            placeholder="הערות נוספות..."
          />
        </div>
      </div>

      <CustomModal
        isOpen={isPaymentHistoryOpen}
        onClose={() => setIsPaymentHistoryOpen(false)}
        title="היסטוריית תשלומים"
        width="max-w-xl"
      >
        {paymentHistoryLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : paymentHistory.length > 0 ? (
          <div className="overflow-hidden rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="px-3 py-2 text-right font-medium">תאריך</th>
                  <th className="px-3 py-2 text-right font-medium">סכום</th>
                  <th className="px-3 py-2 text-right font-medium">סוג</th>
                  <th className="w-10 px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {paymentHistory.map((payment) => (
                  <tr key={payment.id} className="border-t">
                    <td className="px-3 py-2">{formatPaymentDate(payment.paid_at)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatBillingAmount(payment.amount)}</td>
                    <td className="px-3 py-2">
                      {payment.kind === "adjustment" ? "תיקון" : "תשלום"}
                    </td>
                    <td className="px-2 py-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={() => handleDeletePayment(payment)}
                        disabled={payment.id ? deletingPaymentIds[payment.id] : true}
                        aria-label="מחיקת תשלום"
                      >
                        {payment.id && deletingPaymentIds[payment.id] ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            אין היסטוריית תשלומים
          </div>
        )}
      </CustomModal>
    </div>
  );
}
