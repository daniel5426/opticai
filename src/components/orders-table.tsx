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
import { Input } from "@/components/ui/input"
import { Plus, Trash2, FileText } from "lucide-react"
import { Order, User, Client } from "@/lib/db/schema-interface"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { docxGenerator } from "@/lib/docx-generator"
import { OrderToDocxMapper } from "@/lib/order-to-docx-mapper"

import { CustomModal } from "@/components/ui/custom-modal"
import { deleteOrder, deleteContactLensOrder } from "@/lib/db/orders-db"
import { getBillingByOrderId, getBillingByContactLensId, getOrderLineItemsByBillingId } from "@/lib/db/billing-db"
import { getClientById } from "@/lib/db/clients-db"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@/contexts/UserContext"
import { DateSearchHelper } from "@/lib/date-search-helper"

interface OrdersTableProps {
  data: Order[]
  clientId: number
  onOrderDeleted: (orderId: number) => void
  onOrderDeleteFailed: () => void
  loading: boolean
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void }
}

export function OrdersTable({ data, clientId, onOrderDeleted, onOrderDeleteFailed, loading, pagination, searchQuery: externalSearch, onSearchChange }: OrdersTableProps & { searchQuery?: string; onSearchChange?: (q: string) => void }) {
  const { currentClinic } = useUser()

  const navigate = useNavigate()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string>("all")





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
      // Fetch full client data
      const clientData = order.client_id 
        ? await getClientById(order.client_id)
        : null;

      if (!clientData) {
        toast.error("לא ניתן למצוא את פרטי הלקוח");
        return;
      }

      // Fetch billing data and line items
      const isContact = Boolean((order as any).__contact);
      const billingData = order.id 
        ? await (isContact 
            ? getBillingByContactLensId(order.id)
            : getBillingByOrderId(order.id))
        : null;

      // Fetch line items if billing exists
      const lineItems = billingData?.id 
        ? await getOrderLineItemsByBillingId(billingData.id)
        : [];

      const templateData = OrderToDocxMapper.mapOrderToTemplateData(
        order,
        clientData,
        undefined,
        billingData,
        lineItems
      );

      // Use different templates based on order type
      const templatePath = isContact 
        ? "/templates/template.docx"
        : "/templates/template_regular_order.docx";

      await docxGenerator.generate(templateData, undefined, templatePath);
      toast.success("הדוח יוצא בהצלחה");
    } catch (error) {
      console.error("Error exporting DOCX:", error);
      toast.error("שגיאה ביצירת הדוח");
    }
  };

  const filteredData = React.useMemo(() => {
    if (!externalSearch || clientId === 0) {
      return data
    }
    
    const searchLower = externalSearch.toLowerCase().trim()
    if (!searchLower && selectedCategory === "all") {
      return data
    }

    return data.filter((order) => {
      // Category filter
      if (selectedCategory !== "all") {
        const isContact = Boolean((order as any).__contact);
        if (selectedCategory === "contact" && !isContact) return false;
        if (selectedCategory === "regular" && isContact) return false;
      }
      
      if (!searchLower) return true;

      const clientName = ((order as any).clientName || '').toLowerCase()
      const username = ((order as any).username || '').toLowerCase()
      const orderType = (order.type || '').toLowerCase()
      
      if (clientName.includes(searchLower) || 
          username.includes(searchLower) || 
          orderType.includes(searchLower)) {
        return true
      }
      
      return DateSearchHelper.matchesDate(searchLower, order.order_date)
    })
  }, [data, externalSearch, clientId, selectedCategory])

  return (
    <div className="space-y-4 mb-10" style={{scrollbarWidth: 'none'}}>
      <div className="flex justify-between items-center" dir="rtl">
        <div className="flex gap-2 bg-card">
          <Input
            placeholder="חיפוש הזמנות..."
            value={externalSearch || ""}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-[250px] bg-card dark:bg-card" dir="rtl"
          />
           <Select value={selectedCategory} onValueChange={setSelectedCategory} dir="rtl">
            <SelectTrigger className="w-[150px] bg-card">
              <SelectValue placeholder="סוג" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">הכל</SelectItem>
              <SelectItem value="regular">הזמנה רגילה</SelectItem>
              <SelectItem value="contact">עדשות מגע</SelectItem>
            </SelectContent>
           </Select>
        </div>
        <div className="flex gap-2">
          {clientId > 0 ? (
            <>
              <Link to="/clients/$clientId/orders/new" params={{ clientId: String(clientId) }}>
                <Button>הזמנה חדשה
                </Button>
              </Link>
              <Link to="/clients/$clientId/orders/new" params={{ clientId: String(clientId) }} search={{ type: 'contact' }}>
                <Button variant="secondary">עדשות מגע
                </Button>
              </Link>
            </>
          ) : (
            <>
              <ClientSelectModal
                triggerText="הזמנה חדשה"
                onClientSelect={(selectedClientId) => {
                  navigate({
                    to: "/clients/$clientId/orders/new",
                    params: { clientId: String(selectedClientId) },
                  });
                }}
              />
              <ClientSelectModal
                triggerText="עדשות מגע"
                triggerVariant="secondary"
                onClientSelect={(selectedClientId) => {
                  navigate({
                    to: "/clients/$clientId/orders/new",
                    params: { clientId: String(selectedClientId) },
                    search: { type: 'contact' }
                  });
                }}
              />
            </>
          )}
        </div>
      </div>

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
                      <div className="flex gap-1">
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
                  colSpan={clientId === 0 ? 7 : 6}
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