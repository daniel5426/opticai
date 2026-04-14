import React, { useState, useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, FileText } from "lucide-react"
import { Order } from "@/lib/db/schema-interface"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { exportOrderToDocx } from "@/lib/order-docx"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Eye } from "lucide-react"
import { OrderPreviewModal } from "./orders/OrderPreviewModal"
import { ExamCardPreviewModal } from "./exam/ExamCardPreviewModal"
import { getLatestExamByClientId } from "@/lib/db/exams-db"
import {
  getLatestOrderByClientId,
  getOrdersByClientId,
  saveOrderData,
  updateContactLensOrder,
} from "@/lib/db/orders-db"
import { ORDER_STATUS_OPTIONS } from "@/lib/order-status"
import { Badge } from "@/components/ui/badge"

import { CustomModal } from "@/components/ui/custom-modal"
import { deleteOrder, deleteContactLensOrder } from "@/lib/db/orders-db"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@/contexts/UserContext"
import { DateSearchHelper } from "@/lib/date-search-helper"
import { TableFiltersBar } from "@/components/table-filters-bar"
import { ORDER_KIND_OPTIONS, ORDER_STATUS_FILTER_OPTIONS, type OrderKindFilter } from "@/lib/table-filters"

interface OrdersTableProps {
  data: Order[]
  clientId: number
  onOrderDeleted: (orderId: number) => void
  onOrderDeleteFailed: () => void
  loading: boolean
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void }
  searchQuery?: string
  onSearchChange?: (q: string) => void
  kindFilter?: OrderKindFilter
  onKindFilterChange?: (value: OrderKindFilter) => void
  statusFilter?: string
  onStatusFilterChange?: (value: string) => void
}

export function OrdersTable({
  data,
  clientId,
  onOrderDeleted,
  onOrderDeleteFailed,
  loading,
  pagination,
  searchQuery: externalSearch,
  onSearchChange,
  kindFilter: externalKindFilter,
  onKindFilterChange,
  statusFilter: externalStatusFilter,
  onStatusFilterChange,
}: OrdersTableProps) {
  const { currentClinic } = useUser()

  const navigate = useNavigate()
  const [internalSearch, setInternalSearch] = useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [internalKindFilter, setInternalKindFilter] = useState<OrderKindFilter>("all")
  const [internalStatusFilter, setInternalStatusFilter] = useState("all")

  // Preview and Import logic
  const [latestExamId, setLatestExamId] = useState<number | null>(null)
  const [latestOrderId, setLatestOrderId] = useState<number | null>(null)
  const [latestContactOrderId, setLatestContactOrderId] = useState<number | null>(null)
  const [isPreviewOrderOpen, setIsPreviewOrderOpen] = useState(false)
  const [previewOrderId, setPreviewOrderId] = useState<number | null>(null)
  const [previewOrderIsContact, setPreviewOrderIsContact] = useState(false)
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [pendingSelection, setPendingSelection] = useState<{ type: 'contact' | 'regular' } | null>(null)
  const [isCardPreviewOpen, setIsCardPreviewOpen] = useState(false)
  const [cardPreviewType, setCardPreviewType] = useState<'final-prescription' | 'contact-lens-exam'>('final-prescription')
  const [statusOverrides, setStatusOverrides] = useState<Record<number, string>>({})
  const [savingStatusIds, setSavingStatusIds] = useState<Record<number, boolean>>({})
  const searchValue = externalSearch !== undefined ? externalSearch : internalSearch
  const kindFilter = externalKindFilter ?? internalKindFilter
  const statusFilter = externalStatusFilter ?? internalStatusFilter

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

  useEffect(() => {
    if (clientId > 0) {
      const fetchLatest = async () => {
        const [exam, allOrders] = await Promise.all([
          getLatestExamByClientId(clientId),
          getOrdersByClientId(clientId)
        ]);

        if (exam) {
          setLatestExamId(exam.id || null);
          console.log("Fetched latest exam ID:", exam.id);
        } else {
          setLatestExamId(null);
          console.log("No latest exam found.");
        }

        if (allOrders.length > 0) {
          // Sort all orders by date desc
          const sorted = allOrders.sort((a, b) => {
            const dateA = a.order_date ? new Date(a.order_date).getTime() : 0;
            const dateB = b.order_date ? new Date(b.order_date).getTime() : 0;
            return dateB - dateA;
          });

          const latestReg = sorted.find(o => !(o as any).__contact);
          const latestCL = sorted.find(o => (o as any).__contact);

          if (latestReg) {
            setLatestOrderId(latestReg.id || null);
            console.log("Fetched latest regular order ID:", latestReg.id);
          } else {
            setLatestOrderId(null);
            console.log("No latest regular order found.");
          }
          if (latestCL) {
            setLatestContactOrderId(latestCL.id || null);
            console.log("Fetched latest contact order ID:", latestCL.id);
          } else {
            setLatestContactOrderId(null);
            console.log("No latest contact order found.");
          }
        } else {
          setLatestOrderId(null);
          setLatestContactOrderId(null);
          console.log("No orders found for client.");
        }
      };
      fetchLatest();
    } else {
      setLatestExamId(null);
      setLatestOrderId(null);
      setLatestContactOrderId(null);
      console.log("Client ID is 0, resetting latest order/exam IDs.");
    }
  }, [clientId]);





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
    try {
      const isContact = Boolean((order as any).__contact);
      if (!order.id) {
        toast.error("לא ניתן לייצא הזמנה ללא מזהה");
        return;
      }

      await exportOrderToDocx({
        orderId: order.id,
        kind: isContact ? "contact" : "regular",
      });
      toast.success("הדוח יוצא בהצלחה");
    } catch (error) {
      console.error("Error exporting DOCX:", error);
      toast.error("שגיאה ביצירת הדוח");
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
          statusOverrides[order.id] ??
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
      const username = ((order as any).username || '').toLowerCase()
      const orderType = (order.type || '').toLowerCase()

      if (clientName.includes(searchLower) || username.includes(searchLower) || orderType.includes(searchLower)) {
        return true
      }

      return DateSearchHelper.matchesDate(searchLower, order.order_date)
    })
  }, [data, kindFilter, searchValue, statusFilter, statusOverrides])

  const getOrderStatus = React.useCallback((order: Order) => {
    if (!order.id) return "";
    if (statusOverrides[order.id] !== undefined) return statusOverrides[order.id];
    return (
      (order as any).order_status ||
      (order as any)?.order_data?.details?.order_status ||
      ""
    );
  }, [statusOverrides]);

  const handleStatusChange = async (order: Order, nextStatus: string) => {
    if (!order.id) return;
    const orderId = order.id;
    const previousStatus = getOrderStatus(order);

    setStatusOverrides((prev) => ({ ...prev, [orderId]: nextStatus }));
    setSavingStatusIds((prev) => ({ ...prev, [orderId]: true }));

    try {
      if ((order as any).__contact) {
        const updated = await updateContactLensOrder({
          ...(order as any),
          order_status: nextStatus,
        });
        if (!updated) throw new Error("contact update failed");
      } else {
        const orderData = (order as any).order_data || {};
        const details = orderData.details || {};
        const saved = await saveOrderData(orderId, {
          ...orderData,
          details: {
            ...details,
            order_status: nextStatus,
          },
        });
        if (!saved) throw new Error("order data save failed");
      }
      toast.success("סטטוס הזמנה עודכן");
    } catch (error) {
      setStatusOverrides((prev) => ({ ...prev, [orderId]: previousStatus }));
      toast.error("שגיאה בעדכון סטטוס הזמנה");
    } finally {
      setSavingStatusIds((prev) => ({ ...prev, [orderId]: false }));
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
            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button>הזמנה חדשה</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {clientId > 0 && latestExamId && (
                  <DropdownMenuItem
                    className="flex items-center justify-between gap-4"
                    onClick={() => navigate({
                      to: "/clients/$clientId/orders/new",
                      params: { clientId: String(clientId) },
                      search: { importSourceId: String(latestExamId), importSourceType: 'exam' }
                    })}
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
                )}
                {clientId > 0 && latestOrderId && (
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
                  הזמנה חדשה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu dir="rtl">
              <DropdownMenuTrigger asChild>
                <Button variant="secondary">עדשות מגע</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {clientId > 0 && latestExamId && (
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
                {clientId > 0 && latestContactOrderId && (
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
                  הזמנה חדשה
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
          const index = filteredData.findIndex((o) => o.id === previewOrderId);
          if (index !== -1 && index < filteredData.length - 1) {
            const nextOrder = filteredData[index + 1];
            setPreviewOrderId(nextOrder.id || null);
            setPreviewOrderIsContact(Boolean((nextOrder as any).__contact));
          }
        }}
        onPrev={() => {
          const index = filteredData.findIndex((o) => o.id === previewOrderId);
          if (index > 0) {
            const prevOrder = filteredData[index - 1];
            setPreviewOrderId(prevOrder.id || null);
            setPreviewOrderIsContact(Boolean((prevOrder as any).__contact));
          }
        }}
        hasNext={(() => {
          const index = filteredData.findIndex((o) => o.id === previewOrderId);
          return index !== -1 && index < filteredData.length - 1;
        })()}
        hasPrev={(() => {
          const index = filteredData.findIndex((o) => o.id === previewOrderId);
          return index > 0;
        })()}
      />

      <div className="rounded-md bg-card">
        <Table dir="rtl" containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain" containerStyle={{ scrollbarWidth: 'none' }}>
          <TableHeader className="sticky top-0  bg-card">
            <TableRow>
              <TableHead className="text-right">תאריך הזמנה</TableHead>
              <TableHead className="text-right">סוג הזמנה</TableHead>
              <TableHead className="text-right">סוג</TableHead>
              {clientId === 0 && <TableHead className="text-right">לקוח</TableHead>}
              <TableHead className="text-right">בודק</TableHead>
              <TableHead className="text-right">VA</TableHead>
              <TableHead className="text-right">PD</TableHead>
              <TableHead className="text-right">סטטוס</TableHead>
              <TableHead className="w-[80px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2 " />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  {clientId === 0 && (
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2 " />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredData.length > 0 ? (
              filteredData.map((order) => {
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
                    <TableCell>{(order as any).username || ''}</TableCell>
                    <TableCell>{order.comb_va ? `6/${order.comb_va}` : ''}</TableCell>
                    <TableCell>{order.comb_pd}</TableCell>
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
                          onClick={(e) => {
                            e.stopPropagation();
                            handleExportDocx(order);
                          }}
                          title="ייצוא לדוח Word"
                        >
                          <FileText className="h-4 w-4" />
                        </Button>
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
                  colSpan={clientId === 0 ? 9 : 8}
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
