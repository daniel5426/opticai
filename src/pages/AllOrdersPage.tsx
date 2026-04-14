import React, { useState, useEffect, useCallback } from "react"
import { useSearch, useNavigate } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedOrders } from "@/lib/db/orders-db"
import { Order } from "@/lib/db/schema-interface"
import { OrdersTable } from "@/components/orders-table"
import { useUser } from "@/contexts/UserContext"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { buildTableSearch } from "@/lib/list-page-search"

export default function AllOrdersPage() {
  const { currentClinic } = useUser()
  const search = useSearch({ from: "/orders" })
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState(search.q)

  useEffect(() => {
    setSearchInput(search.q)
  }, [search.q])

  const buildSearchState = useCallback((overrides?: Partial<{ q: string; page: number; kind: string; status: string }>) => {
    return buildTableSearch(
      {
        q: searchInput.trim(),
        page: search.page,
        kind: search.kind,
        status: search.status,
        ...overrides,
      },
      {
        q: "",
        page: 1,
        kind: ALL_FILTER_VALUE,
        status: ALL_FILTER_VALUE,
      },
    )
  }, [search.kind, search.page, search.status, searchInput])

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/orders",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, 400)
    return () => clearTimeout(t)
  }, [buildSearchState, navigate, search.q, searchInput])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedOrders(currentClinic?.id, {
        limit: pageSize,
        offset,
        order: 'date_desc',
        q: search.q || undefined,
        kind: search.kind !== ALL_FILTER_VALUE ? search.kind : undefined,
        status: search.status !== ALL_FILTER_VALUE ? search.status : undefined,
      })
      setOrders(items)
      setTotal(total)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentClinic, pageSize, search.kind, search.page, search.q, search.status])

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [loadData, currentClinic])

  const handleOrderDeleted = (deletedOrderId: number) => {
    setOrders(prevOrders => prevOrders.filter(order => order.id !== deletedOrderId))
    // Move to previous page if we deleted the last item on the current page
    if (orders.length === 1 && search.page > 1) {
      navigate({
        to: "/orders",
        search: buildSearchState({ page: search.page - 1 }),
      })
    } else {
      setTotal(prev => prev - 1)
    }
  }

  const handleOrderDeleteFailed = () => {
    loadData()
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
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          kindFilter={search.kind}
          onKindFilterChange={(value) =>
            navigate({
              to: "/orders",
              search: buildSearchState({ kind: value, page: 1 }),
            })
          }
          statusFilter={search.status}
          onStatusFilterChange={(value) =>
            navigate({
              to: "/orders",
              search: buildSearchState({ status: value, page: 1 }),
            })
          }
          loading={loading}
          pagination={{
            page: search.page,
            pageSize,
            total,
            setPage: (page) =>
              navigate({
                to: "/orders",
                search: buildSearchState({ page }),
              }),
          }}
        />
      </div>
    </>
  )
} 
