import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { getAllOrders } from "@/lib/db/orders-db"
import { Order } from "@/lib/db/schema"
import { OrdersTable } from "@/components/orders-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useNavigate } from "@tanstack/react-router"

export default function AllOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadData = async () => {
    try {
      setLoading(true)
      const ordersData = await getAllOrders()
      setOrders(ordersData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOrderDeleted = (deletedOrderId: number) => {
    setOrders(prevOrders => prevOrders.filter(order => order.id !== deletedOrderId))
  }

  const handleOrderDeleteFailed = () => {
    loadData()
  }

  const handleClientSelect = (clientId: number) => {
    navigate({
      to: "/clients/$clientId/orders/new",
      params: { clientId: String(clientId) }
    })
  }

  return (
    <>
      <SiteHeader title="הזמנות" />
      <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold">כל ההזמנות</h1>
        </div>
        <OrdersTable 
          data={orders} 
          clientId={0} 
          onOrderDeleted={handleOrderDeleted} 
          onOrderDeleteFailed={handleOrderDeleteFailed}
          loading={loading}
        />
      </div>
    </>
  )
} 