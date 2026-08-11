import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { FamiliesTable } from "@/components/families-table"
import { FamilyManagementModal } from "@/components/FamilyManagementModal"
import { getPaginatedFamilies } from "@/lib/db/family-db"
import { Family } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { ArrowRight, GitMerge, PlusIcon, Users } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { TABLE_SEARCH_DEBOUNCE_MS, buildTableSearch, useLatestTableSearchRequest } from "@/lib/list-page-search"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"
import { parseSortSearch, sortToOrder, sortToSearch } from "@/lib/table-sorting"
import { deferPaginationTotal } from "@/lib/deferred-pagination"

export default function FamiliesPage() {
  const search = useSearch({ from: "/clients/families" })
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const clinicId = currentClinic?.id
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchInput, setSearchInput] = useState(search.q)
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const { startSearchRequest, updateLatestSearch } = useLatestTableSearchRequest(searchInput)
  const activeSort = React.useMemo(() => parseSortSearch(search.sort, { key: "id", direction: "desc" }), [search.sort])

  useEffect(() => {
    updateLatestSearch(search.q)
    setSearchInput(search.q)
  }, [search.q, updateLatestSearch])

  const buildSearchState = useCallback(
    (overrides?: Partial<{ q: string; page: number; sort: string }>) =>
      buildTableSearch(
        { q: searchInput.trim(), page: search.page, sort: search.sort, ...overrides },
        { q: "", page: 1, sort: "" }
      ),
    [search.page, search.sort, searchInput]
  )

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (searchInput === search.q) return
      void navigate({
        to: "/clients/families",
        search: buildSearchState({ q: searchInput.trim(), page: 1 })
      })
    }, TABLE_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeout)
  }, [buildSearchState, navigate, search.q, searchInput])

  const loadFamilies = useCallback(async () => {
    if (!clinicId) return
    const canCommit = startSearchRequest(search.q)
    try {
      setLoading(true)
      setTotal(null)
      const paginationOptions = {
        limit: pageSize,
        offset: (search.page - 1) * pageSize,
        order: sortToOrder(activeSort, "id_desc"),
        search: search.q || undefined,
        includeTotal: false
      }
      const { items, hasMore: nextHasMore } = await getPaginatedFamilies(clinicId, paginationOptions)
      if (!canCommit()) return
      setFamilies(items)
      setHasMore(nextHasMore)
      deferPaginationTotal(
        () => getPaginatedFamilies(clinicId, { ...paginationOptions, countOnly: true }),
        canCommit,
        setTotal
      )
    } catch (error) {
      console.error("Error loading families:", error)
    } finally {
      if (canCommit()) setLoading(false)
    }
  }, [activeSort, clinicId, pageSize, search.page, search.q, startSearchRequest])

  useEffect(() => {
    if (!clinicId) {
      setFamilies([])
      setLoading(false)
      setTotal(null)
      setHasMore(false)
      return
    }
    void loadFamilies()
  }, [clinicId, loadFamilies])

  const handleFamilyDeleted = (familyId: number) => {
    setFamilies((previous) => previous.filter((family) => family.id !== familyId))
    if (families.length === 1 && search.page > 1) {
      void navigate({ to: "/clients/families", search: buildSearchState({ page: search.page - 1 }) })
      return
    }
    setTotal((previous) => (previous === null ? null : Math.max(0, previous - 1)))
  }

  const closeFamilyModal = () => {
    setIsFamilyModalOpen(false)
    setEditingFamily(null)
  }

  return (
    <>
      <SiteHeader title="משפחות" />
      <div className="flex h-full min-h-0 flex-1 flex-col p-4 lg:p-6" dir="rtl" style={{ scrollbarWidth: "none" }}>
        <div className="flex min-h-0 flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="flex items-center gap-2">
              <GuardedRouterLink to="/clients">
                <ArrowRight className="h-4 w-4" />
                לקוחות
              </GuardedRouterLink>
            </Button>
            <Button asChild variant="outline" className="flex items-center gap-2">
              <GuardedRouterLink to="/clients/merge">
                <GitMerge className="h-4 w-4" />
                מיזוג
              </GuardedRouterLink>
            </Button>
            <Button onClick={() => setIsFamilyModalOpen(true)} className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              משפחה חדשה
            </Button>
          </div>
          <FamiliesTable
            data={families}
            onFamilyEdit={(family) => {
              setEditingFamily(family)
              setIsFamilyModalOpen(true)
            }}
            onFamilyDeleted={handleFamilyDeleted}
            onFamilyDeleteFailed={loadFamilies}
            searchQuery={searchInput}
            onSearchChange={(value) => {
              updateLatestSearch(value)
              setSearchInput(value)
            }}
            hideSearch={false}
            serverFiltered={true}
            loading={loading}
            fillHeight
            sort={activeSort}
            onSortChange={(sort) =>
              void navigate({
                to: "/clients/families",
                search: buildSearchState({ sort: sortToSearch(sort), page: 1 })
              })
            }
            pagination={{
              page: search.page,
              pageSize,
              total,
              hasMore,
              setPage: (page) =>
                void navigate({ to: "/clients/families", search: buildSearchState({ page }) })
            }}
          />
        </div>
      </div>
      {isFamilyModalOpen ? (
        <FamilyManagementModal
          isOpen
          onClose={closeFamilyModal}
          family={editingFamily}
          onFamilyChange={loadFamilies}
        />
      ) : null}
    </>
  )
}
