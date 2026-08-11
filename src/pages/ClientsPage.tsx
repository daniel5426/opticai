import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { ClientsTable } from "@/components/clients-table"
import { getPaginatedClients } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { GitMerge, PlusIcon, Users } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { TABLE_SEARCH_DEBOUNCE_MS, buildTableSearch, useLatestTableSearchRequest } from "@/lib/list-page-search"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"
import { parseSortSearch, sortToOrder, sortToSearch } from "@/lib/table-sorting"
import { deferPaginationTotal } from "@/lib/deferred-pagination"
import { useAppLocale } from "@/localization/use-app-locale"

export default function ClientsPage() {
  const search = useSearch({ from: "/clients" })
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const { direction } = useAppLocale()
  const clinicId = currentClinic?.id
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchInput, setSearchInput] = useState(search.q)
  const { startSearchRequest, updateLatestSearch } = useLatestTableSearchRequest(searchInput)
  const activeSort = React.useMemo(() => parseSortSearch(search.sort, { key: "id", direction: "desc" }), [search.sort])
  const isLegacyFamiliesUrl = search.mode === "families"

  useEffect(() => {
    if (!isLegacyFamiliesUrl) return
    void navigate({
      to: "/clients/families",
      search: buildTableSearch(
        { q: search.q, page: search.page, sort: search.sort },
        { q: "", page: 1, sort: "" }
      ),
      replace: true
    })
  }, [isLegacyFamiliesUrl, navigate, search.page, search.q, search.sort])

  useEffect(() => {
    updateLatestSearch(search.q)
    setSearchInput(search.q)
  }, [search.q, updateLatestSearch])

  const buildSearchState = useCallback(
    (
      overrides?: Partial<{
        q: string
        page: number
        gender: string
        sort: string
      }>
    ) =>
      buildTableSearch(
        {
          q: searchInput.trim(),
          page: search.page,
          gender: search.gender,
          sort: search.sort,
          ...overrides
        },
        { q: "", page: 1, gender: ALL_FILTER_VALUE, sort: "" }
      ),
    [search.gender, search.page, search.sort, searchInput]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput === search.q) return
      void navigate({
        to: "/clients",
        search: buildSearchState({ q: searchInput.trim(), page: 1 })
      })
    }, TABLE_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [buildSearchState, navigate, search.q, searchInput])

  const loadClients = useCallback(async () => {
    if (!clinicId) return
    const canCommit = startSearchRequest(search.q)
    try {
      setLoading(true)
      setTotal(null)
      const paginationOptions = {
        limit: pageSize,
        offset: (search.page - 1) * pageSize,
        order: sortToOrder(activeSort, "id_desc"),
        q: search.q || undefined,
        gender: search.gender !== ALL_FILTER_VALUE ? search.gender : undefined,
        includeTotal: false
      }
      const { items, hasMore: nextHasMore } = await getPaginatedClients(clinicId, paginationOptions)
      if (!canCommit()) return
      setClients(items)
      setHasMore(nextHasMore)
      deferPaginationTotal(
        () => getPaginatedClients(clinicId, { ...paginationOptions, countOnly: true }),
        canCommit,
        setTotal
      )
    } catch (error) {
      console.error("Error loading clients:", error)
    } finally {
      if (canCommit()) setLoading(false)
    }
  }, [activeSort, clinicId, pageSize, search.gender, search.page, search.q, startSearchRequest])

  useEffect(() => {
    if (isLegacyFamiliesUrl) return
    if (!clinicId) {
      setClients([])
      setLoading(false)
      setTotal(null)
      setHasMore(false)
      return
    }
    void loadClients()
  }, [clinicId, isLegacyFamiliesUrl, loadClients])

  const handleClientDeleted = (clientId: number) => {
    setClients((previous) => previous.filter((client) => client.id !== clientId))
    if (clients.length === 1 && search.page > 1) {
      void navigate({ to: "/clients", search: buildSearchState({ page: search.page - 1 }) })
      return
    }
    setTotal((previous) => (previous === null ? null : Math.max(0, previous - 1)))
  }

  if (isLegacyFamiliesUrl) return null

  return (
    <>
      <SiteHeader title="לקוחות" />
      <div className="flex h-full min-h-0 flex-1 flex-col p-4 lg:p-6" dir={direction} style={{ scrollbarWidth: "none" }}>
        <ClientsTable
          data={clients}
          onClientDeleted={handleClientDeleted}
          onClientDeleteFailed={loadClients}
          searchQuery={searchInput}
          onSearchChange={(value) => {
            updateLatestSearch(value)
            setSearchInput(value)
          }}
          serverFiltered={true}
          genderFilter={search.gender}
          onGenderFilterChange={(gender) =>
            void navigate({ to: "/clients", search: buildSearchState({ gender, page: 1 }) })
          }
          hideNewButton={true}
          loading={loading}
          fillHeight
          sort={activeSort}
          onSortChange={(sort) =>
            void navigate({ to: "/clients", search: buildSearchState({ sort: sortToSearch(sort), page: 1 }) })
          }
          pagination={{
            page: search.page,
            pageSize,
            total,
            hasMore,
            setPage: (page) => void navigate({ to: "/clients", search: buildSearchState({ page }) })
          }}
          toolbarActions={
            <>
              <Button asChild className="flex items-center gap-2">
                <GuardedRouterLink to="/clients/new">
                  <PlusIcon className="h-4 w-4" />
                  לקוח חדש
                </GuardedRouterLink>
              </Button>
              <Button asChild variant="outline" className="flex items-center gap-2" title="משפחות">
                <GuardedRouterLink to="/clients/families">
                  <Users className="h-4 w-4" />
                  משפחות
                </GuardedRouterLink>
              </Button>
              <Button asChild variant="outline" className="flex items-center gap-2" title="מיזוג לקוחות">
                <GuardedRouterLink to="/clients/merge">
                  <GitMerge className="h-4 w-4" />
                  מיזוג
                </GuardedRouterLink>
              </Button>
            </>
          }
        />
      </div>
    </>
  )
}
