import React, { useState } from "react"
import { OrdersTable } from "@/components/orders-table"
import { useParams } from "@tanstack/react-router"
import { useClientData } from "@/contexts/ClientDataContext"

export function ClientOrdersTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { orders, loading, removeOrder, refreshOrders } = useClientData()
  const [searchQuery, setSearchQuery] = useState("")

  const handleOrderDeleted = (deletedOrderId: number) => {
    removeOrder(deletedOrderId)
  }

  const handleOrderDeleteFailed = () => {
    refreshOrders()
  }

  return (
    <OrdersTable
      data={orders}
      clientId={Number(clientId)}
      onOrderDeleted={handleOrderDeleted}
      onOrderDeleteFailed={handleOrderDeleteFailed}
      loading={loading.orders}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    />
  )
} 