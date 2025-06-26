import React from "react"
import { useState, useEffect } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MoreHorizontal, Plus } from "lucide-react"
import { Order, User } from "@/lib/db/schema"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { getAllUsers } from "@/lib/db/users-db"

interface OrdersTableProps {
  data: Order[]
  clientId: number
}

export function OrdersTable({ data, clientId }: OrdersTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const usersData = await getAllUsers()
        setUsers(usersData)
      } catch (error) {
        console.error('Error loading users:', error)
      }
    }
    loadUsers()
  }, [])

  const getUserName = (userId?: number): string => {
    if (!userId) return ''
    const user = users.find(u => u.id === userId)
    return user?.username || ''
  }

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
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש הזמנות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px]" dir="rtl"
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

      <div className="rounded-md border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך הזמנה</TableHead>
              <TableHead className="text-right">סוג הזמנה</TableHead>
              <TableHead className="text-right">בודק</TableHead>
              <TableHead className="text-right">VA</TableHead>
              <TableHead className="text-right">PD</TableHead>
              <TableHead className="text-right w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  לא נמצאו הזמנות לתצוגה
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((order) => {
                return (
                  <TableRow 
                    key={order.id}
                    className={clientId > 0 ? "cursor-pointer" : ""}
                    onClick={() => {
                      // Only allow navigation if we have a valid client ID
                      if (clientId > 0) {
                        navigate({
                          to: "/clients/$clientId/orders/$orderId",
                          params: { 
                            clientId: String(clientId), 
                            orderId: String(order.id) 
                          }
                        })
                      }
                    }}
                  >
                    <TableCell>
                      {order.order_date ? new Date(order.order_date).toLocaleDateString('he-IL') : ''}
                    </TableCell>
                    <TableCell>{order.type}</TableCell>
                    <TableCell>{getUserName(order.user_id)}</TableCell>
                    <TableCell>{order.comb_va ? `6/${order.comb_va}` : ''}</TableCell>
                    <TableCell>{order.comb_pd}</TableCell>
                    <TableCell>
                      {clientId > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                            >
                              <span className="sr-only">פתח תפריט</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <Link to="/clients/$clientId/orders/$orderId" params={{ clientId: String(clientId), orderId: String(order.id) }}>
                              <DropdownMenuItem>פרטי הזמנה</DropdownMenuItem>
                            </Link>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 