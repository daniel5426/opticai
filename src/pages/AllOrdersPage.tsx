import React, { useState, useEffect, useCallback } from "react"
import { useSearch, useNavigate } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedOrders, saveOrderDetailsComponent, updateContactLensOrder } from "@/lib/db/orders-db"
import { Order } from "@/lib/db/schema-interface"
import { OrdersTable } from "@/components/orders-table"
import { useUser } from "@/contexts/UserContext"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { TABLE_SEARCH_DEBOUNCE_MS, buildTableSearch } from "@/lib/list-page-search"
import { parseSortSearch, sortToOrder, sortToSearch } from "@/lib/table-sorting"
import { useUsersQuery } from "@/hooks/client/useClientTabQueries"
import { onBillingPaymentsChanged } from "@/lib/billing-events"

export default function AllOrdersPage() {
  const { currentClinic } = useUser()
  const search = useSearch({ from: "/orders" })
  const navigate = useNavigate()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState(search.q)
  const usersQuery = useUsersQuery(currentClinic?.id)
  const activeSort = React.useMemo(
    () => parseSortSearch(search.sort, { key: "order_date", direction: "desc" }),
    [search.sort],
  )

  useEffect(() => {
    setSearchInput(search.q)
  }, [search.q])

  const buildSearchState = useCallback((overrides?: Partial<{ q: string; page: number; kind: string; status: string; sort: string }>) => {
    return buildTableSearch(
      {
        q: searchInput.trim(),
        page: search.page,
        kind: search.kind,
        status: search.status,
        sort: search.sort,
        ...overrides,
      },
      {
        q: "",
        page: 1,
        kind: ALL_FILTER_VALUE,
        status: ALL_FILTER_VALUE,
        sort: "",
      },
    )
  }, [search.kind, search.page, search.sort, search.status, searchInput])

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/orders",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, TABLE_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [buildSearchState, navigate, search.q, searchInput])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedOrders(currentClinic?.id, {
        limit: pageSize,
        offset,
        order: sortToOrder(activeSort, "date_desc"),
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
  }, [activeSort, currentClinic, pageSize, search.kind, search.page, search.q, search.status])

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [loadData, currentClinic])

  useEffect(() => {
    return onBillingPaymentsChanged(() => {
      if (currentClinic) void loadData()
    })
  }, [currentClinic, loadData])

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

  const handleOrderStatusChange = async (order: Order, nextStatus: string) => {
    if (!order.id) return
    const previousOrders = orders
    const orderData = (order as any).order_data || {}
    const details = orderData.details || {}
    const optimisticOrder = {
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

    setOrders((current) => current.map((item) => (item.id === order.id ? optimisticOrder : item)))

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
      setOrders(previousOrders)
      throw error
    }
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
          users={usersQuery.data || []}
          onOrderDeleted={handleOrderDeleted} 
          onOrderDeleteFailed={handleOrderDeleteFailed}
          onOrderStatusChange={handleOrderStatusChange}
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          serverFiltered={true}
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
          sort={activeSort}
          onSortChange={(sort) =>
            navigate({
              to: "/orders",
              search: buildSearchState({ sort: sortToSearch(sort), page: 1 }),
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
