import React from "react"
import { useParams, useNavigate } from "@tanstack/react-router"
import { getClientById } from "@/lib/db/clients-db"
import { Order } from "@/lib/db/schema-interface"
import { toast } from "sonner"
import OrderDetailPage from "./OrderDetailPage"

export default function OrderCreatePage() {
  const { clientId } = useParams({ from: "/clients/$clientId/orders/new" })
  const client = getClientById(Number(clientId))
  const navigate = useNavigate()

  const handleSave = (order: Order) => {
    navigate({ to: `/clients/${clientId}`, search: { tab: 'orders' } })
  }

  const handleCancel = () => {
    navigate({ to: `/clients/${clientId}` })
  }
  
  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <h1 className="text-2xl">לקוח לא נמצא</h1>
      </div>
    )
  }

  return (
    <OrderDetailPage
      mode="new"
      clientId={clientId}
      onSave={handleSave}
      onCancel={handleCancel}
    />
  )
} 