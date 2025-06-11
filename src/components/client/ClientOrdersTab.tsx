import React, { useState, useEffect } from "react"
import { OrdersTable } from "@/components/orders-table"
import { getOrdersByClientId } from "@/lib/db/orders-db"
import { useParams } from "@tanstack/react-router"
import { Order } from "@/lib/db/schema"

export function ClientOrdersTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoading(true)
        const ordersData = await getOrdersByClientId(Number(clientId))
        setOrders(ordersData)
      } catch (error) {
        console.error('Error loading orders:', error)
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [clientId])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-lg">טוען הזמנות...</div>
      </div>
    )
  }

  return (
    <OrdersTable data={orders} clientId={Number(clientId)} />
  )
} 