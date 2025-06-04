import React, { useState } from "react"
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
import { MoreHorizontal } from "lucide-react"
import { Order } from "@/lib/db/schema"
import { getExamById } from "@/lib/db/exams-db"

interface OrdersTableProps {
  data: Order[]
  clientId: number
}

export function OrdersTable({ data, clientId }: OrdersTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const navigate = useNavigate()

  // Filter data based on search query
  const filteredData = data.filter((order) => {
    const exam = order.exam_id ? getExamById(order.exam_id) : null
    const searchableFields = [
      order.type,
      order.order_date,
      exam?.test_name || '',
      exam?.clinic || '',
    ]

    return searchableFields.some(
      (field) => field && field.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש הזמנות..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px]" dir="rtl"
          />
        </div>
        <Link to="/clients/$clientId/orders/new" params={{ clientId: String(clientId) }}>
          <Button>הזמנה חדשה</Button>
        </Link>
      </div>

      <div className="rounded-md border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך הזמנה</TableHead>
              <TableHead className="text-right">סוג הזמנה</TableHead>
              <TableHead className="text-right">מבדיקה</TableHead>
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
                  className="h-24 text-center"
                >
                  לא נמצאו הזמנות לתצוגה
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((order) => {
                const exam = order.exam_id ? getExamById(order.exam_id) : null
                return (
                  <TableRow 
                    key={order.id}
                    className="cursor-pointer"
                    onClick={() => {
                      navigate({
                        to: "/clients/$clientId/orders/$orderId",
                        params: { 
                          clientId: String(clientId), 
                          orderId: String(order.id) 
                        }
                      })
                    }}
                  >
                    <TableCell>
                      {order.order_date ? new Date(order.order_date).toLocaleDateString('he-IL') : ''}
                    </TableCell>
                    <TableCell>{order.type}</TableCell>
                    <TableCell>
                      {exam ? `${exam.test_name} - ${new Date(exam.exam_date).toLocaleDateString('he-IL')}` : ''}
                    </TableCell>
                    <TableCell>{order.comb_va ? `6/${order.comb_va}` : ''}</TableCell>
                    <TableCell>{order.comb_pd}</TableCell>
                    <TableCell>
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