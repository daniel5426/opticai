import React, { useState, useEffect } from "react"
import { OrdersTable } from "@/components/orders-table"
import { getOrdersByClientId } from "@/lib/db/orders-db"
import { useParams } from "@tanstack/react-router"
import { Order } from "@/lib/db/schema"

export function ClientOrdersTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    // Get fresh data each time the component mounts
    const freshOrders = getOrdersByClientId(Number(clientId))
    setOrders(freshOrders)
  }, [clientId])

  return (
    <OrdersTable data={orders} clientId={Number(clientId)} />
  )
} 