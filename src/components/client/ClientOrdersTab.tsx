import React, { useState } from "react"
import { OrdersTable } from "@/components/orders-table"
import { useParams } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { useUser } from "@/contexts/UserContext"
import {
  clientQueryKeys,
  removeQueryItemById,
  replaceQueryItemById,
  restoreQueryData,
  useClientOrdersContextQuery,
  useClientOrdersQuery,
  useUsersQuery,
} from "@/hooks/client/useClientTabQueries"
import { Order } from "@/lib/db/schema-interface"
import {
  saveOrderDetailsComponent,
  updateContactLensOrder,
} from "@/lib/db/orders-db"
import { onBillingPaymentsChanged } from "@/lib/billing-events"

interface ClientOrdersTabProps {
  enabled?: boolean
}

export function ClientOrdersTab({ enabled = true }: ClientOrdersTabProps) {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const clientIdNum = Number(clientId)
  const queryClient = useQueryClient()
  const { currentClinic } = useUser()
  const ordersQuery = useClientOrdersQuery(clientIdNum, enabled)
  const ordersContextQuery = useClientOrdersContextQuery(clientIdNum, enabled)
  const usersQuery = useUsersQuery(currentClinic?.id, enabled)
  const [searchQuery, setSearchQuery] = useState("")
  const ordersQueryKey = clientQueryKeys.orders(clientIdNum)

  React.useEffect(() => {
    return onBillingPaymentsChanged(() => {
      queryClient.invalidateQueries({ queryKey: ordersQueryKey })
      queryClient.invalidateQueries({ queryKey: clientQueryKeys.ordersContext(clientIdNum) })
    })
  }, [clientIdNum, ordersQueryKey, queryClient])

  const handleOrderDeleted = (deletedOrderId: number) => {
    queryClient.setQueryData<Order[]>(ordersQueryKey, (current) =>
      removeQueryItemById(current, deletedOrderId),
    )
  }

  const handleOrderDeleteFailed = () => {
    queryClient.invalidateQueries({ queryKey: ordersQueryKey })
    queryClient.invalidateQueries({ queryKey: clientQueryKeys.ordersContext(clientIdNum) })
  }

  const handleOrderStatusChange = async (order: Order, nextStatus: string) => {
    if (!order.id) return
    const previous = queryClient.getQueryData<Order[]>(ordersQueryKey)
    const orderData = (order as any).order_data || {}
    const details = orderData.details || {}
    const optimisticOrder: Order = {
      ...order,
      order_status: nextStatus,
      order_data: {
        ...orderData,
        details: {
          ...details,
          order_status: nextStatus,
        },
      },
    }

    queryClient.setQueryData<Order[]>(ordersQueryKey, (current) =>
      replaceQueryItemById(current, optimisticOrder),
    )

    try {
      if ((order as any).__contact) {
        const updated = await updateContactLensOrder({
          ...(order as any),
          order_status: nextStatus,
        })
        if (!updated) throw new Error("contact update failed")
      } else {
        const saved = await saveOrderDetailsComponent(order.id, {
          ...details,
          order_status: nextStatus,
        })
        if (!saved) throw new Error("order status save failed")
      }
    } catch (error) {
      restoreQueryData(queryClient, ordersQueryKey, previous)
      throw error
    }
  }

  return (
    <OrdersTable
      data={ordersQuery.data || []}
      clientId={clientIdNum}
      users={usersQuery.data || []}
      ordersContext={ordersContextQuery.data}
      ordersContextLoading={ordersContextQuery.isLoading}
      onOrderDeleted={handleOrderDeleted}
      onOrderDeleteFailed={handleOrderDeleteFailed}
      onOrderStatusChange={handleOrderStatusChange}
      loading={ordersQuery.isLoading}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
    />
  )
} 
