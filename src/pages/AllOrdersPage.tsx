import React, { useState, useEffect, useCallback } from "react"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedOrders } from "@/lib/db/orders-db"
import { Order } from "@/lib/db/schema-interface"
import { OrdersTable } from "@/components/orders-table"
import { useNavigate } from "@tanstack/react-router"
import { useUser } from "@/contexts/UserContext"

export default function AllOrdersPage() {
  const { currentClinic } = useUser()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * pageSize
      const { items, total } = await getPaginatedOrders(currentClinic?.id, { limit: pageSize, offset, order: 'date_desc', search: debouncedSearch || undefined })
      setOrders(items)
      setTotal(total)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentClinic, page, pageSize, debouncedSearch])

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [loadData, currentClinic])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const handleOrderDeleted = (deletedOrderId: number) => {
    setOrders(prevOrders => prevOrders.filter(order => order.id !== deletedOrderId))
    // Move to previous page if we deleted the last item on the current page
    if (orders.length === 1 && page > 1) {
      setPage(page - 1)
    } else {
      setTotal(prev => prev - 1)
    }
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
          <h1 className="text-xl font-bold">כל ההזמנות</h1>
        </div>
        <OrdersTable 
          data={orders} 
          clientId={0} 
          onOrderDeleted={handleOrderDeleted} 
          onOrderDeleteFailed={handleOrderDeleteFailed}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading}
          pagination={{ page, pageSize, total, setPage }}
        />
      </div>
    </>
  )
} 