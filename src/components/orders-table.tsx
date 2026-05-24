import React, { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, Trash2, FileText, Loader2, FileDown, Printer } from "lucide-react"
import { BillingPayment, ClientOrdersContext, Order, User } from "@/lib/db/schema-interface"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { exportOrderToDocx, exportOrderToPdf, printOrderPdf } from "@/lib/order-docx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { OrderPreviewModal } from "./orders/OrderPreviewModal"
import { ExamCardPreviewModal } from "./exam/ExamCardPreviewModal"
import { ORDER_STATUS_OPTIONS } from "@/lib/order-status"
import { Badge } from "@/components/ui/badge"

import { CustomModal } from "@/components/ui/custom-modal"
import { deleteOrder, deleteContactLensOrder } from "@/lib/db/orders-db"
import { createBilling, createBillingPayment, getBillingPayments } from "@/lib/db/billing-db"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { DateSearchHelper } from "@/lib/date-search-helper"
import { TableFiltersBar } from "@/components/table-filters-bar"
import { ORDER_KIND_OPTIONS, ORDER_STATUS_FILTER_OPTIONS, type OrderKindFilter } from "@/lib/table-filters"
import { SortableTableHead } from "@/components/sortable-table-head"
import { SortColumns, SortState, sortRows } from "@/lib/table-sorting"
import {
  ADDITION_ADD_TYPE_LABELS,
  getAdditionAddTypeOptions,
  type AdditionAddSourceMap,
  type AdditionAddType,
} from "@/lib/addition-add-sources"
import { formatBillingAmount, getBillingPaymentStatus } from "@/lib/billing-payment-status"

function getLocalDateInputValue() {
  const now = new Date();
  const offsetMs = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10);
}

interface OrdersTableProps {
  data: Order[]
  clientId: number
  users: User[]
  ordersContext?: ClientOrdersContext
  ordersContextLoading?: boolean
  onOrderDeleted: (orderId: number) => void
  onOrderDeleteFailed: () => void
  onOrderStatusChange: (order: Order, nextStatus: string) => Promise<void>
  loading: boolean
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void }
  searchQuery?: string
  onSearchChange?: (q: string) => void
  kindFilter?: OrderKindFilter
  onKindFilterChange?: (value: OrderKindFilter) => void
  statusFilter?: string
  onStatusFilterChange?: (value: string) => void
  sort?: SortState
  onSortChange?: (sort: SortState) => void
}

export function OrdersTable({
  data,
  clientId,
  users,
  ordersContext,
  ordersContextLoading = false,
  onOrderDeleted,
  onOrderDeleteFailed,
  onOrderStatusChange,
  loading,
  pagination,
  searchQuery: externalSearch,
  onSearchChange,
  kindFilter: externalKindFilter,
  onKindFilterChange,
  statusFilter: externalStatusFilter,
  onStatusFilterChange,
  sort,
  onSortChange,
}: OrdersTableProps) {
  const navigate = useNavigate()
  const [internalSearch, setInternalSearch] = useState("")
  const [localSort, setLocalSort] = useState<SortState | undefined>()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [internalKindFilter, setInternalKindFilter] = useState<OrderKindFilter>("all")
  const [internalStatusFilter, setInternalStatusFilter] = useState("all")
  const [isPreviewOrderOpen, setIsPreviewOrderOpen] = useState(false)
  const [previewOrderId, setPreviewOrderId] = useState<number | null>(null)
  const [previewOrderIsContact, setPreviewOrderIsContact] = useState(false)
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<{ type: 'contact' | 'regular' } | null>(null)
  const [isCardPreviewOpen, setIsCardPreviewOpen] = useState(false)
  const [cardPreviewType, setCardPreviewType] = useState<'final-prescription' | 'contact-lens-exam'>('final-prescription')
  const [savingStatusIds, setSavingStatusIds] = useState<Record<number, boolean>>({})
  const [savingPaymentStatusIds, setSavingPaymentStatusIds] = useState<Record<number, boolean>>({})
  const [paymentDropdownOrderId, setPaymentDropdownOrderId] = useState<number | null>(null)
  const [paidDrafts, setPaidDrafts] = useState<Record<number, string>>({})
  const [newPaymentDrafts, setNewPaymentDrafts] = useState<Record<number, string>>({})
  const [paymentDateDrafts, setPaymentDateDrafts] = useState<Record<number, string>>({})
  const [editingPaidIds, setEditingPaidIds] = useState<Record<number, boolean>>({})
  const [paymentHistory, setPaymentHistory] = useState<Record<number, BillingPayment[]>>({})
  const [billingOverrides, setBillingOverrides] = useState<Record<number, { billing_id?: number; total_after_discount?: number; prepayment_amount?: number }>>({})
  const [exportingDocxIds, setExportingDocxIds] = useState<Record<string, boolean>>({})
  const [exportingPdfIds, setExportingPdfIds] = useState<Record<string, boolean>>({})
  const [printingPdfIds, setPrintingPdfIds] = useState<Record<string, boolean>>({})
  const searchValue = externalSearch !== undefined ? externalSearch : internalSearch
  const kindFilter = externalKindFilter ?? internalKindFilter
  const statusFilter = externalStatusFilter ?? internalStatusFilter
  const activeSort = sort ?? localSort
  const handleSortChange = onSortChange ?? setLocalSort
  const latestExamId = ordersContext?.latest_exam_id ?? null
  const latestOrderId = ordersContext?.latest_regular_order_id ?? null
  const latestContactOrderId = ordersContext?.latest_contact_order_id ?? null
  const latestExamAddSources = (ordersContext?.latest_exam_add_sources || {}) as AdditionAddSourceMap
  const isLatestContextLoading = clientId > 0 && ordersContextLoading
  const latestExamAddTypeOptions = getAdditionAddTypeOptions(latestExamAddSources)

  const usersById = React.useMemo(() => {
    return new Map(users.map((user) => [user.id, user]))
  }, [users])

  const getExaminerName = React.useCallback((order: Order) => {
    const orderUser = order.user_id ? usersById.get(order.user_id) : undefined
    return (
      orderUser?.full_name ||
      orderUser?.username ||
      (order as any).examiner_name ||
      (order as any).full_name ||
      (order as any).username ||
      ""
    )
  }, [usersById])

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value)
      return
    }
    setInternalSearch(value)
  }

  const handleKindFilterChange = (value: string) => {
    const nextValue = value as OrderKindFilter
    if (onKindFilterChange) {
      onKindFilterChange(nextValue)
      return
    }
    setInternalKindFilter(nextValue)
  }

  const handleStatusFilterUpdate = (value: string) => {
    if (onStatusFilterChange) {
      onStatusFilterChange(value)
      return
    }
    setInternalStatusFilter(value)
  }
  const openRegularOrderFromLatestExam = (addType?: AdditionAddType) => {
    if (!latestExamId) return;
    navigate({
      to: "/clients/$clientId/orders/new",
      params: { clientId: String(clientId) },
      search: {
        importSourceId: String(latestExamId),
        importSourceType: "exam",
        ...(addType ? { addType } : {}),
      },
    });
  };

  const handleCreateOrder = (type: 'contact' | 'regular') => {
    if (clientId > 0) {
      navigate({
        to: "/clients/$clientId/orders/new",
        params: { clientId: String(clientId) },
        search: type === 'contact' ? { type: 'contact' } : {}
      });
    } else {
      setPendingSelection({ type });
      setIsClientModalOpen(true);
    }
  };

  const handleClientSelect = (selectedClientId: number) => {
    if (pendingSelection) {
      navigate({
        to: "/clients/$clientId/orders/new",
        params: { clientId: String(selectedClientId) },
        search: pendingSelection.type === 'contact' ? { type: 'contact' } : {}
      });
      setPendingSelection(null);
    }
    setIsClientModalOpen(false);
  };

  const handleDeleteConfirm = async () => {
    const selected = orderToDelete;
    if (!selected || selected.id === undefined) {
      setIsDeleteModalOpen(false);
      return;
    }

    // Close modal immediately
    setIsDeleteModalOpen(false);
    setOrderToDelete(null);

    try {
      const deletedOrderId = selected.id;
      onOrderDeleted(deletedOrderId);
      toast.success("הזמנה נמחקה בהצלחה");

      const isContact = Boolean((selected as any).__contact);
      const success = await (isContact
        ? deleteContactLensOrder(deletedOrderId)
        : deleteOrder(deletedOrderId));
      if (!success) {
        toast.error("אירעה שגיאה בעת מחיקת ההזמנה. מרענן נתונים...");
        onOrderDeleteFailed();
      }
    } catch (error) {
      toast.error("אירעה שגיאה בעת מחיקת ההזמנה");
      onOrderDeleteFailed();
    }
  };

  const handleExportDocx = async (order: Order) => {
    const isContact = Boolean((order as any).__contact);
    const exportKey = order.id ? `${isContact ? "contact" : "regular"}:${order.id}` : "";

    try {
      if (!order.id) {
        toast.error("לא ניתן לייצא הזמנה ללא מזהה");
        return;
      }
      if (exportingDocxIds[exportKey]) return;

      setExportingDocxIds((prev) => ({ ...prev, [exportKey]: true }));
      await exportOrderToDocx({
        orderId: order.id,
        kind: isContact ? "contact" : "regular",
      });
      toast.success("הדוח יוצא בהצלחה");
    } catch (error) {
      console.error("Error exporting DOCX:", error);
      toast.error("שגיאה ביצירת הדוח");
    } finally {
      if (exportKey) {
        setExportingDocxIds((prev) => ({ ...prev, [exportKey]: false }));
      }
    }
  };

  const handleExportPdf = async (order: Order) => {
    const isContact = Boolean((order as any).__contact);
    const exportKey = order.id ? `${isContact ? "contact" : "regular"}:${order.id}` : "";

    try {
      if (!order.id) {
        toast.error("לא ניתן לייצא הזמנה ללא מזהה");
        return;
      }
      if (exportingPdfIds[exportKey]) return;

      setExportingPdfIds((prev) => ({ ...prev, [exportKey]: true }));
      const result = await exportOrderToPdf({
        orderId: order.id,
        kind: isContact ? "contact" : "regular",
      });
      if (result.success) {
        toast.success("PDF נוצר בהצלחה");
      } else if (!result.canceled) {
        throw new Error(result.error || "PDF export failed");
      }
    } catch (error) {
      console.error("Error exporting PDF:", error);
      toast.error("שגיאה ביצירת PDF");
    } finally {
      if (exportKey) {
        setExportingPdfIds((prev) => ({ ...prev, [exportKey]: false }));
      }
    }
  };

  const handlePrintPdf = async (order: Order) => {
    try {
      if (!order.id) {
        toast.error("לא ניתן להדפיס הזמנה ללא מזהה");
        return;
      }
      const kind = (order as any).__contact ? "contact" : "regular";
      const exportKey = `${kind}:${order.id}`;
      if (printingPdfIds[exportKey]) return;

      setPrintingPdfIds((prev) => ({ ...prev, [exportKey]: true }));
      const result = await printOrderPdf({
        orderId: order.id,
        kind,
      });
      if (result.success) {
        toast.success("PDF נפתח להדפסה");
      } else {
        throw new Error(result.error || "Print failed");
      }
    } catch (error) {
      console.error("Error printing PDF:", error);
      toast.error("שגיאה בהדפסה");
    } finally {
      if (order.id) {
        const kind = (order as any).__contact ? "contact" : "regular";
        setPrintingPdfIds((prev) => ({ ...prev, [`${kind}:${order.id}`]: false }));
      }
    }
  };

  const filteredData = React.useMemo(() => {
    let result = data

    if (kindFilter !== "all") {
      result = result.filter((order) => {
        const isContact = Boolean((order as any).__contact)
        if (kindFilter === "contact") return isContact
        if (kindFilter === "regular") return !isContact
        return true
      })
    }

    if (statusFilter !== "all") {
      result = result.filter((order) => {
        if (!order.id) return false
        const effectiveStatus =
          (order as any).order_status ??
          (order as any)?.order_data?.details?.order_status ??
          ""
        return effectiveStatus === statusFilter
      })
    }

    const searchLower = searchValue.toLowerCase().trim()
    if (!searchLower) {
      return result
    }

    return result.filter((order) => {
      const clientName = ((order as any).clientName || '').toLowerCase()
      const username = getExaminerName(order).toLowerCase()
      const orderType = (order.type || '').toLowerCase()

      if (clientName.includes(searchLower) || username.includes(searchLower) || orderType.includes(searchLower)) {
        return true
      }

      return DateSearchHelper.matchesDate(searchLower, order.order_date)
    })
  }, [data, getExaminerName, kindFilter, searchValue, statusFilter])

  const getOrderStatus = React.useCallback((order: Order) => {
    if (!order.id) return "";
    return (
      (order as any).order_status ||
      (order as any)?.order_data?.details?.order_status ||
      ""
    );
  }, []);

  const getPaymentStatus = React.useCallback((order: Order) => {
    if (!order.id) return "";
    const override = billingOverrides[order.id];
    const total = Number(override?.total_after_discount ?? (order as any).billing_total_after_discount) || 0;
    if (total <= 0) return "ללא מחיר";
    return getBillingPaymentStatus(total, override?.prepayment_amount ?? (order as any).billing_prepayment_amount);
  }, [billingOverrides]);

  const getBillingId = React.useCallback((order: Order) => {
    if (!order.id) return undefined;
    return billingOverrides[order.id]?.billing_id || (order as any).billing_id;
  }, [billingOverrides]);

  const getBillingTotal = React.useCallback((order: Order) => {
    if (!order.id) return 0;
    return Number(billingOverrides[order.id]?.total_after_discount ?? (order as any).billing_total_after_discount) || 0;
  }, [billingOverrides]);

  const getBillingPaid = React.useCallback((order: Order) => {
    if (!order.id) return 0;
    return Number(billingOverrides[order.id]?.prepayment_amount ?? (order as any).billing_prepayment_amount) || 0;
  }, [billingOverrides]);

  const sortColumns = React.useMemo<SortColumns<Order>>(() => ({
    order_date: { getValue: (order) => order.order_date, type: "date" },
    type: { getValue: (order) => order.type },
    kind: { getValue: (order) => ((order as any).__contact ? "עדשות מגע" : "הזמנה רגילה") },
    client: { getValue: (order) => (order as any).clientName },
    payment_status: { getValue: getPaymentStatus },
    status: { getValue: getOrderStatus },
  }), [getOrderStatus, getPaymentStatus])

  const displayData = React.useMemo(() => {
    return onSortChange ? filteredData : sortRows(filteredData, activeSort, sortColumns)
  }, [activeSort, filteredData, onSortChange, sortColumns])

  const tableColumnCount = clientId === 0 ? 7 : 6;

  const handleStatusChange = async (order: Order, nextStatus: string) => {
    if (!order.id) return;
    const orderId = order.id;

    setSavingStatusIds((prev) => ({ ...prev, [orderId]: true }));

    try {
      await onOrderStatusChange(order, nextStatus);
      toast.success("סטטוס הזמנה עודכן");
    } catch (error) {
      toast.error("שגיאה בעדכון סטטוס הזמנה");
    } finally {
      setSavingStatusIds((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const loadPaymentHistory = async (order: Order) => {
    if (!order.id) return;
    const orderId = order.id;
    const billingId = getBillingId(order);
    if (!billingId) return;
    const payments = await getBillingPayments(billingId);
    setPaymentHistory((prev) => ({ ...prev, [orderId]: payments }));
  };

  const ensureBillingForPayment = async (order: Order) => {
    if (!order.id) return null;
    const billingId = getBillingId(order);
    if (billingId) return billingId;

    const total = getBillingTotal(order);
    const saved = await createBilling(
      (order as any).__contact
        ? { contact_lens_id: order.id, total_after_discount: total }
        : { order_id: order.id, total_after_discount: total },
    );
    if (!saved?.id) return null;
    setBillingOverrides((prev) => ({
      ...prev,
      [order.id!]: {
        billing_id: saved.id,
        total_after_discount: saved.total_after_discount ?? total,
        prepayment_amount: saved.prepayment_amount ?? getBillingPaid(order),
      },
    }));
    return saved.id;
  };

  const applyPaymentChange = async (
    order: Order,
    amount: number,
    paidAt: string,
    kind: "payment" | "adjustment",
    successMessage: string,
  ) => {
    if (!order.id) return null;
    const orderId = order.id;
    const previous = billingOverrides[orderId];
    const total = getBillingTotal(order);
    const currentPaid = getBillingPaid(order);
    const nextPaid = currentPaid + amount;

    setSavingPaymentStatusIds((prev) => ({ ...prev, [orderId]: true }));
    setBillingOverrides((prev) => ({
      ...prev,
      [orderId]: { billing_id: getBillingId(order), total_after_discount: total, prepayment_amount: nextPaid },
    }));

    try {
      const billingId = await ensureBillingForPayment(order);
      if (!billingId) throw new Error("billing creation failed");
      const savedPayment = await createBillingPayment(billingId, {
        amount,
        paid_at: paidAt,
        kind,
      });
      if (!savedPayment) throw new Error("payment save failed");
      setBillingOverrides((prev) => ({
        ...prev,
        [orderId]: {
          billing_id: billingId,
          total_after_discount: total,
          prepayment_amount: nextPaid,
        },
      }));
      setPaidDrafts((prev) => ({ ...prev, [orderId]: String(nextPaid || "") }));
      setPaymentHistory((prev) => ({
        ...prev,
        [orderId]: [savedPayment, ...(prev[orderId] || [])],
      }));
      toast.success(successMessage);
      return savedPayment;
    } catch (error) {
      setBillingOverrides((prev) => {
        const next = { ...prev };
        if (previous) next[orderId] = previous;
        else delete next[orderId];
        return next;
      });
      toast.error("שגיאה בעדכון תשלום");
      return null;
    } finally {
      setSavingPaymentStatusIds((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  const handleNewPaymentSave = async (order: Order) => {
    if (!order.id) return;
    const orderId = order.id;
    const amount = Number.parseFloat(newPaymentDrafts[orderId] ?? "");
    const paidAt = paymentDateDrafts[orderId] || getLocalDateInputValue();
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("יש להזין סכום תשלום חיובי");
      return;
    }
    const saved = await applyPaymentChange(order, amount, paidAt, "payment", "תשלום נוסף נשמר");
    if (saved) {
      setNewPaymentDrafts((prev) => ({ ...prev, [orderId]: "" }));
      setPaymentDateDrafts((prev) => ({ ...prev, [orderId]: getLocalDateInputValue() }));
    }
  };

  const handlePaidTotalAdjustmentSave = async (order: Order) => {
    if (!order.id) return;
    const orderId = order.id;
    const draft = paidDrafts[orderId] ?? String(getBillingPaid(order));
    const nextPaid = Number.parseFloat(draft);
    if (!Number.isFinite(nextPaid) || nextPaid < 0) {
      toast.error("יש להזין סכום שולם תקין");
      return;
    }
    const delta = nextPaid - getBillingPaid(order);
    if (Math.abs(delta) < 0.01) {
      setEditingPaidIds((prev) => ({ ...prev, [orderId]: false }));
      return;
    }
    const saved = await applyPaymentChange(
      order,
      delta,
      getLocalDateInputValue(),
      "adjustment",
      "סכום שולם עודכן",
    );
    if (saved) {
      setEditingPaidIds((prev) => ({ ...prev, [orderId]: false }));
    }
  };

  return (
    <div className="space-y-2.5 mb-10" style={{ scrollbarWidth: 'none' }}>
      <TableFiltersBar
        searchValue={searchValue}
        onSearchChange={handleSearchChange}
        searchPlaceholder="חיפוש הזמנות…"
        filters={[
          {
            key: "kind",
            value: kindFilter,
            onChange: handleKindFilterChange,
            placeholder: "סוג הזמנה",
            options: ORDER_KIND_OPTIONS,
            widthClassName: "w-[170px]",
          },
          {
            key: "status",
            value: statusFilter,
            onChange: handleStatusFilterUpdate,
            placeholder: "סטטוס",
            options: ORDER_STATUS_FILTER_OPTIONS,
            widthClassName: "w-[190px]",
          },
        ]}
        hasActiveFilters={Boolean(searchValue.trim()) || kindFilter !== "all" || statusFilter !== "all"}
        onReset={() => {
          handleSearchChange("")
          handleKindFilterChange("all")
          handleStatusFilterUpdate("all")
        }}
        actions={
          <>
            {clientId === 0 ? (
              <>
                <Button onClick={() => handleCreateOrder('regular')}>משקפיים</Button>
                <Button variant="secondary" onClick={() => handleCreateOrder('contact')}>
                  עדשות מגע
                </Button>
              </>
            ) : (
              <>
	                <DropdownMenu dir="ltr">
	                  <DropdownMenuTrigger asChild>
	                    <Button>משקפיים</Button>
	                  </DropdownMenuTrigger>
	                  <DropdownMenuContent align="end">
	                    {isLatestContextLoading && (
	                      <DropdownMenuItem disabled>
	                        טוען אפשרויות ייבוא...
	                      </DropdownMenuItem>
	                    )}
	                    {latestExamId && (
                      latestExamAddTypeOptions.length > 0 ? (
                        <DropdownMenuSub>
                          <DropdownMenuSubTrigger
                            hideIcon
                            className="flex items-center justify-between gap-4"
                          >
                            <span>מבדיקה אחרונה</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              aria-label="תצוגה מקדימה של בדיקה אחרונה"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setCardPreviewType('final-prescription');
                                setIsCardPreviewOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DropdownMenuSubTrigger>
	                          <DropdownMenuSubContent alignOffset={-4}>
                            {latestExamAddTypeOptions.map((type) => (
                              <DropdownMenuItem
                                key={type}
                                onClick={() => openRegularOrderFromLatestExam(type)}
                              >
                                {ADDITION_ADD_TYPE_LABELS[type]}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuSubContent>
                        </DropdownMenuSub>
                      ) : (
                        <DropdownMenuItem
                          className="flex items-center justify-between gap-4"
                          onClick={() => openRegularOrderFromLatestExam()}
                        >
                          <span>מבדיקה אחרונה</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            aria-label="תצוגה מקדימה של בדיקה אחרונה"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCardPreviewType('final-prescription');
                              setIsCardPreviewOpen(true);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DropdownMenuItem>
                      )
                    )}
                    {latestOrderId && (
                      <DropdownMenuItem
                        className="flex items-center justify-between gap-4"
                        onClick={() => navigate({
                          to: "/clients/$clientId/orders/new",
                          params: { clientId: String(clientId) },
                          search: { importSourceId: String(latestOrderId), importSourceType: 'order' }
                        })}
                      >
                        <span>מהזמנה אחרונה</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label="תצוגה מקדימה של הזמנה אחרונה"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewOrderId(latestOrderId);
                            setPreviewOrderIsContact(false);
                            setIsPreviewOrderOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleCreateOrder('regular')}>
                      משקפיים
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

	                <DropdownMenu dir="rtl">
	                  <DropdownMenuTrigger asChild>
	                    <Button variant="secondary">
	                      עדשות מגע
	                    </Button>
	                  </DropdownMenuTrigger>
	                  <DropdownMenuContent align="end">
	                    {isLatestContextLoading && (
	                      <DropdownMenuItem disabled>
	                        טוען אפשרויות ייבוא...
	                      </DropdownMenuItem>
	                    )}
	                    {latestExamId && (
                      <DropdownMenuItem
                        className="flex items-center justify-between gap-4"
                        onClick={() => navigate({
                          to: "/clients/$clientId/orders/new",
                          params: { clientId: String(clientId) },
                          search: { type: 'contact', importSourceId: String(latestExamId), importSourceType: 'exam' }
                        })}
                      >
                        <span>מבדיקה אחרונה</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label="תצוגה מקדימה של בדיקת עדשות מגע"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCardPreviewType('contact-lens-exam');
                            setIsCardPreviewOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DropdownMenuItem>
                    )}
                    {latestContactOrderId && (
                      <DropdownMenuItem
                        className="flex items-center justify-between gap-4"
                        onClick={() => navigate({
                          to: "/clients/$clientId/orders/new",
                          params: { clientId: String(clientId) },
                          search: { type: 'contact', importSourceId: String(latestContactOrderId), importSourceType: 'order' }
                        })}
                      >
                        <span>מהזמנה אחרונה</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          aria-label="תצוגה מקדימה של הזמנת עדשות מגע אחרונה"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewOrderId(latestContactOrderId);
                            setPreviewOrderIsContact(true);
                            setIsPreviewOrderOpen(true);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => handleCreateOrder('contact')}>
                      עדשות מגע
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </>
        }
      />

      <ClientSelectModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onClientSelect={handleClientSelect}
      />

      <ExamCardPreviewModal
        isOpen={isCardPreviewOpen}
        onClose={() => setIsCardPreviewOpen(false)}
        examId={latestExamId}
        cardType={cardPreviewType}
      />

      <OrderPreviewModal
        isOpen={isPreviewOrderOpen}
        onClose={() => setIsPreviewOrderOpen(false)}
        orderId={previewOrderId}
        isContact={previewOrderIsContact}
        onNext={() => {
          const index = displayData.findIndex((o) => o.id === previewOrderId);
          if (index !== -1 && index < displayData.length - 1) {
            const nextOrder = displayData[index + 1];
            setPreviewOrderId(nextOrder.id || null);
            setPreviewOrderIsContact(Boolean((nextOrder as any).__contact));
          }
        }}
        onPrev={() => {
          const index = displayData.findIndex((o) => o.id === previewOrderId);
          if (index > 0) {
            const prevOrder = displayData[index - 1];
            setPreviewOrderId(prevOrder.id || null);
            setPreviewOrderIsContact(Boolean((prevOrder as any).__contact));
          }
        }}
        hasNext={(() => {
          const index = displayData.findIndex((o) => o.id === previewOrderId);
          return index !== -1 && index < displayData.length - 1;
        })()}
        hasPrev={(() => {
          const index = displayData.findIndex((o) => o.id === previewOrderId);
          return index > 0;
        })()}
      />

      <div className="rounded-md bg-card">
        <Table dir="rtl" containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain" containerStyle={{ scrollbarWidth: 'none' }}>
          <TableHeader className="sticky top-0  bg-card">
            <TableRow>
              <SortableTableHead sortKey="order_date" sort={activeSort} onSortChange={handleSortChange} className="text-right">תאריך הזמנה</SortableTableHead>
              <SortableTableHead sortKey="type" sort={activeSort} onSortChange={handleSortChange} className="text-right">סוג הזמנה</SortableTableHead>
              <SortableTableHead sortKey="kind" sort={activeSort} onSortChange={handleSortChange} className="text-right">סוג</SortableTableHead>
              {clientId === 0 && <SortableTableHead sortKey="client" sort={activeSort} onSortChange={handleSortChange} className="text-right">לקוח</SortableTableHead>}
              <SortableTableHead sortKey="payment_status" sort={activeSort} onSortChange={handleSortChange} className="text-right">תשלום</SortableTableHead>
              <SortableTableHead sortKey="status" sort={activeSort} onSortChange={handleSortChange} className="text-right">סטטוס</SortableTableHead>
              <TableHead className="w-[80px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: tableColumnCount }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : displayData.length > 0 ? (
              displayData.map((order) => {
                const isExportingDocx = order.id
                  ? Boolean(exportingDocxIds[`${(order as any).__contact ? "contact" : "regular"}:${order.id}`])
                  : false;
                const isExportingPdf = order.id
                  ? Boolean(exportingPdfIds[`${(order as any).__contact ? "contact" : "regular"}:${order.id}`])
                  : false;
                const isPrintingPdf = order.id
                  ? Boolean(printingPdfIds[`${(order as any).__contact ? "contact" : "regular"}:${order.id}`])
                  : false;
                const hasBillingPrice = getBillingTotal(order) > 0;
                return (
                  <TableRow
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => {
                      if (order.id !== undefined) {
                        const orderClientId = clientId > 0 ? clientId : order.client_id;
                        navigate({
                          to: "/clients/$clientId/orders/$orderId",
                          params: {
                            clientId: String(orderClientId),
                            orderId: String(order.id)
                          },
                          search: (order as any).__contact ? { type: 'contact' } : undefined
                        });
                      }
                    }}
                  >
                    <TableCell>
                      {order.order_date ? new Date(order.order_date).toLocaleDateString('he-IL') : ''}
                    </TableCell>
                    <TableCell>{order.type}</TableCell>
                    <TableCell>{(order as any).__contact ? 'עדשות מגע' : 'הזמנה רגילה'}</TableCell>
                    {clientId === 0 && (
                      <TableCell className="cursor-pointer text-blue-600 hover:underline"
                        onClick={e => {
                          e.stopPropagation();
                          navigate({ to: "/clients/$clientId", params: { clientId: String(order.client_id) }, search: { tab: 'orders' } })
                        }}
                      >{(order as any).clientName || ''}</TableCell>
                    )}
                    <TableCell>
                      {hasBillingPrice ? (
                        <DropdownMenu
                          dir="rtl"
                          open={paymentDropdownOrderId === order.id}
                          onOpenChange={(open) => {
                            if (!order.id) return;
                            if (open) {
                              setPaymentDropdownOrderId(order.id);
                              setPaidDrafts((prev) => ({
                                ...prev,
                                [order.id!]: String(getBillingPaid(order) || ""),
                              }));
                              setNewPaymentDrafts((prev) => ({ ...prev, [order.id!]: "" }));
                              setPaymentDateDrafts((prev) => ({
                                ...prev,
                                [order.id!]: prev[order.id!] || getLocalDateInputValue(),
                              }));
                              setEditingPaidIds((prev) => ({ ...prev, [order.id!]: false }));
                              void loadPaymentHistory(order);
                            } else {
                              setPaymentDropdownOrderId(null);
                              setEditingPaidIds((prev) => ({ ...prev, [order.id!]: false }));
                            }
                          }}
                        >
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              className="cursor-pointer"
                              onClick={(e) => e.stopPropagation()}
                              disabled={!!savingPaymentStatusIds[order.id || -1]}
                            >
                              <Badge variant="outline" className="hover:bg-accent/70">
                                {savingPaymentStatusIds[order.id || -1]
                                  ? "שומר..."
                                  : getPaymentStatus(order) || "ללא סטטוס"}
                              </Badge>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="w-80 p-3"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="mb-3 flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm">
                              <span className="text-muted-foreground">שולם / סה"כ</span>
                              <span className="font-medium tabular-nums">
                                {formatBillingAmount(getBillingPaid(order))} / {formatBillingAmount(getBillingTotal(order))}
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <div className="mb-1 text-xs text-muted-foreground">שולם</div>
                                {order.id && editingPaidIds[order.id] ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={paidDrafts[order.id] ?? ""}
                                    onChange={(e) => {
                                      if (!order.id) return;
                                      setPaidDrafts((prev) => ({ ...prev, [order.id!]: e.target.value }));
                                    }}
                                    className="h-9"
                                    autoFocus
                                  />
                                ) : (
                                  <button
                                    type="button"
                                    className="flex h-9 w-full items-center rounded-md border bg-muted/30 px-3 text-right text-sm tabular-nums"
                                    onDoubleClick={(e) => {
                                      e.stopPropagation();
                                      if (!order.id) return;
                                      setEditingPaidIds((prev) => ({ ...prev, [order.id!]: true }));
                                      setPaidDrafts((prev) => ({
                                        ...prev,
                                        [order.id!]: String(getBillingPaid(order) || ""),
                                      }));
                                    }}
                                  >
                                    {formatBillingAmount(getBillingPaid(order))}
                                  </button>
                                )}
                              </div>
                              <div>
                                <div className="mb-1 text-xs text-muted-foreground">סה"כ</div>
                                <div className="flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm tabular-nums">
                                  {formatBillingAmount(getBillingTotal(order))}
                                </div>
                              </div>
                            </div>

                            {order.id && editingPaidIds[order.id] && (
                              <div className="mt-3 flex justify-start gap-2">
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handlePaidTotalAdjustmentSave(order);
                                  }}
                                  disabled={!!savingPaymentStatusIds[order.id || -1]}
                                >
                                  {savingPaymentStatusIds[order.id || -1] ? "שומר..." : "שמור שינוי"}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (!order.id) return;
                                    setEditingPaidIds((prev) => ({ ...prev, [order.id!]: false }));
                                    setPaidDrafts((prev) => ({
                                      ...prev,
                                      [order.id!]: String(getBillingPaid(order) || ""),
                                    }));
                                  }}
                                >
                                  ביטול
                                </Button>
                              </div>
                            )}

                            <div className="mt-4 border-t pt-3">
                              <div className="mb-2 text-xs font-medium text-muted-foreground">תשלום חדש</div>
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <div className="mb-1 text-xs text-muted-foreground">סכום</div>
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={order.id ? newPaymentDrafts[order.id] ?? "" : ""}
                                    onChange={(e) => {
                                      if (!order.id) return;
                                      setNewPaymentDrafts((prev) => ({ ...prev, [order.id!]: e.target.value }));
                                    }}
                                    className="h-9"
                                  />
                                </div>
                                <div>
                                  <div className="mb-1 text-xs text-muted-foreground">תאריך</div>
                                  <Input
                                    type="date"
                                    value={order.id ? paymentDateDrafts[order.id] ?? getLocalDateInputValue() : ""}
                                    onChange={(e) => {
                                      if (!order.id) return;
                                      setPaymentDateDrafts((prev) => ({ ...prev, [order.id!]: e.target.value }));
                                    }}
                                    className="h-9"
                                  />
                                </div>
                              </div>
                              <div className="mt-3 flex justify-start">
                                <Button
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNewPaymentSave(order);
                                  }}
                                  disabled={!!savingPaymentStatusIds[order.id || -1]}
                                >
                                  {savingPaymentStatusIds[order.id || -1] ? "שומר..." : "הוסף תשלום"}
                                </Button>
                              </div>
                            </div>

                            {order.id && (paymentHistory[order.id] || []).length > 0 && (
                              <div className="mt-4 border-t pt-3">
                                <div className="mb-2 text-xs font-medium text-muted-foreground">תשלומים אחרונים</div>
                                <div className="space-y-1.5 text-xs">
                                  {(paymentHistory[order.id] || []).slice(0, 3).map((payment) => (
                                    <div key={payment.id} className="flex items-center justify-between">
                                      <span className="text-muted-foreground">
                                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString("he-IL") : ""}
                                        {payment.kind === "adjustment" ? " · תיקון" : ""}
                                      </span>
                                      <span className="tabular-nums">{formatBillingAmount(payment.amount)}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <Badge variant="outline" className="cursor-default text-muted-foreground">
                          ללא מחיר
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu dir="rtl">
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                            disabled={!!savingStatusIds[order.id || -1]}
                          >
                            <Badge variant="outline" className="hover:bg-accent/70">
                              {savingStatusIds[order.id || -1]
                                ? "שומר..."
                                : getOrderStatus(order) || "ללא סטטוס"}
                            </Badge>
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ORDER_STATUS_OPTIONS.filter((status) => status !== getOrderStatus(order)).map((status) => (
                            <DropdownMenuItem
                              key={status}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(order, status);
                              }}
                            >
                              {status}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewOrderId(order.id || null);
                            setPreviewOrderIsContact(Boolean((order as any).__contact));
                            setIsPreviewOrderOpen(true);
                          }}
                          title="צפייה מהירה"
                        >
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          disabled={isPrintingPdf}
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePrintPdf(order);
                          }}
                          title="הדפסה"
                        >
                          {isPrintingPdf ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                        <DropdownMenu dir="rtl">
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              disabled={isExportingDocx || isExportingPdf}
                              onClick={(e) => e.stopPropagation()}
                              title="הורדה"
                            >
                              {isExportingDocx || isExportingPdf ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <FileDown className="h-4 w-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportPdf(order);
                              }}
                            >
                              <FileDown className="ml-2 h-4 w-4" />
                              PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleExportDocx(order);
                              }}
                            >
                              <FileText className="ml-2 h-4 w-4" />
                              DOCX
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOrderToDelete(order);
                            setIsDeleteModalOpen(true);
                          }}
                          title="מחיקה"
                        >
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={tableColumnCount}
                  className="h-24 text-center text-muted-foreground"
                >
                  לא נמצאו הזמנות לתצוגה
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            עמוד {pagination.page} מתוך {Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 1)))} · סה"כ {pagination.total || 0}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page <= 1}
              onClick={() => pagination.setPage(Math.max(1, pagination.page - 1))}
            >הקודם</Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page >= Math.ceil((pagination.total || 0) / (pagination.pageSize || 1))}
              onClick={() => pagination.setPage(pagination.page + 1)}
            >הבא</Button>
          </div>
        </div>
      )}

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת הזמנה"
        description={orderToDelete ? `האם אתה בטוח שברצונך למחוק את הזמנה מס' ${orderToDelete.id} מיום ${orderToDelete.order_date ? new Date(orderToDelete.order_date).toLocaleDateString('he-IL') : ''}?` : "האם אתה בטוח שברצונך למחוק את ההזמנה?"}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        cancelText="בטל"
      />
    </div>
  )
} 
