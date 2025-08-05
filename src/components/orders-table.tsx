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
import { Plus, Trash2 } from "lucide-react"
import { Order, User, Client } from "@/lib/db/schema-interface"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { getAllUsers } from "@/lib/db/users-db"
import { getAllClients } from "@/lib/db/clients-db"
import { CustomModal } from "@/components/ui/custom-modal"
import { deleteOrder } from "@/lib/db/orders-db"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { useUser } from "@/contexts/UserContext"

interface OrdersTableProps {
  data: Order[]
  clientId: number
  onOrderDeleted: (orderId: number) => void
  onOrderDeleteFailed: () => void
  loading: boolean
}

export function OrdersTable({ data, clientId, onOrderDeleted, onOrderDeleteFailed, loading }: OrdersTableProps) {
  const { currentClinic } = useUser()
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const navigate = useNavigate()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null)

  useEffect(() => {
    const loadData = async () => {
      if (!currentClinic) return
      
      try {
        const [usersData, clientsData] = await Promise.all([
          getAllUsers(currentClinic.id),
          getAllClients(currentClinic.id)
        ])
        setUsers(usersData)
        setClients(clientsData)
      } catch (error) {
        console.error('Error loading data:', error)
      }
    }
    loadData()
  }, [currentClinic])

  const getUserName = (userId?: number): string => {
    if (!userId) return ''
    const user = users.find(u => u.id === userId)
    return user?.username || ''
  }

  const getClientName = (clientId: number): string => {
    const client = clients.find(c => c.id === clientId)
    return client ? `${client.first_name} ${client.last_name}`.trim() : ''
  }

  const handleDeleteConfirm = async () => {
    if (orderToDelete && orderToDelete.id !== undefined) {
      try {
        const deletedOrderId = orderToDelete.id;
        onOrderDeleted(deletedOrderId);
        toast.success("הזמנה נמחקה בהצלחה");

        const success = await deleteOrder(deletedOrderId);
        if (!success) {
          toast.error("אירעה שגיאה בעת מחיקת ההזמנה. מרענן נתונים...");
          onOrderDeleteFailed();
        }
      } catch (error) {
        toast.error("אירעה שגיאה בעת מחיקת ההזמנה");
        onOrderDeleteFailed();
      } finally {
        setOrderToDelete(null);
      }
    }
    setIsDeleteModalOpen(false);
  };

  const filteredData = data.filter((order) => {
    const searchableFields = [
      order.type || '',
      order.order_date || '',
      getUserName(order.user_id),
    ]

    return searchableFields.some(
      (field) => field.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
      <div className="flex justify-between items-center" dir="rtl">
        <div className="flex gap-2 bg-card">
          <Input
            placeholder="חיפוש הזמנות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px] bg-card dark:bg-card" dir="rtl"
          />
        </div>
        {clientId > 0 ? (
          <Link to="/clients/$clientId/orders/new" params={{ clientId: String(clientId) }}>
            <Button>הזמנה חדשה
              <Plus className="h-4 w-4 mr-2" />
              </Button>
          </Link>
        ) : (
          <ClientSelectModal
            triggerText="הזמנה חדשה"
            onClientSelect={(selectedClientId) => {
              navigate({
                to: "/clients/$clientId/orders/new",
                params: { clientId: String(selectedClientId) },
              });
            }}
          />
        )}
      </div>

      <div className="rounded-md border bg-card">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך הזמנה</TableHead>
              <TableHead className="text-right">סוג הזמנה</TableHead>
              {clientId === 0 && <TableHead className="text-right">לקוח</TableHead>}
              <TableHead className="text-right">בודק</TableHead>
              <TableHead className="text-right">VA</TableHead>
              <TableHead className="text-right">PD</TableHead>
              <TableHead className="w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
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
                          }
                        });
                      }
                    }}
                  >
                    <TableCell>
                      {order.order_date ? new Date(order.order_date).toLocaleDateString('he-IL') : ''}
                    </TableCell>
                    <TableCell>{order.type}</TableCell>
                    {clientId === 0 && (
                      <TableCell className="cursor-pointer text-blue-600 hover:underline"
                        onClick={e => {
                          e.stopPropagation();
                          navigate({ to: "/clients/$clientId", params: { clientId: String(order.client_id) }, search: { tab: 'orders' } })
                        }}
                      >{getClientName(order.client_id)}</TableCell>
                    )}
                    <TableCell>{getUserName(order.user_id)}</TableCell>
                    <TableCell>{order.comb_va ? `6/${order.comb_va}` : ''}</TableCell>
                    <TableCell>{order.comb_pd}</TableCell>
                    <TableCell>
                      <Button variant="ghost" className="h-8 w-8 p-0" onClick={(e) => {
                        e.stopPropagation();
                        setOrderToDelete(order);
                        setIsDeleteModalOpen(true);
                      }} title="מחיקה">
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
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