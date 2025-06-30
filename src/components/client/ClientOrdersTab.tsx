import React from "react"
import { OrdersTable } from "@/components/orders-table"
import { useParams } from "@tanstack/react-router"
import { useClientData } from "@/contexts/ClientDataContext"
import { Order } from "@/lib/db/schema"

export function ClientOrdersTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { orders, loading, refreshOrders } = useClientData()
  const [currentOrders, setCurrentOrders] = React.useState<Order[]>(orders)

  React.useEffect(() => {
    setCurrentOrders(orders)
  }, [orders])

  const handleOrderDeleted = (deletedOrderId: number) => {
    setCurrentOrders(prevOrders => prevOrders.filter(order => order.id !== deletedOrderId))
  }

  const handleOrderDeleteFailed = () => {
    refreshOrders()
  }


  return (
    <OrdersTable
      data={currentOrders}
      clientId={Number(clientId)}
      onOrderDeleted={handleOrderDeleted}
      onOrderDeleteFailed={handleOrderDeleteFailed}
      loading={loading.orders}
    />
  )
} 