import React, { useCallback, useEffect, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { ClientsTable } from "@/components/clients-table"
import { getPaginatedClients } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { ArrowRight, GitMerge, Loader2, Users } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { TABLE_SEARCH_DEBOUNCE_MS, buildTableSearch, useLatestTableSearchRequest } from "@/lib/list-page-search"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"
import { parseSortSearch, sortToOrder, sortToSearch } from "@/lib/table-sorting"
import { CustomModal } from "@/components/ui/custom-modal"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { deferPaginationTotal } from "@/lib/deferred-pagination"

export default function ClientsMergePage() {
  const search = useSearch({ from: "/clients/merge" })
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const clinicId = currentClinic?.id
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchInput, setSearchInput] = useState(search.q)
  const [selectedClients, setSelectedClients] = useState<Client[]>([])
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const [canonicalClientId, setCanonicalClientId] = useState<number | null>(null)
  const [isMerging, setIsMerging] = useState(false)
  const { startSearchRequest, updateLatestSearch } = useLatestTableSearchRequest(searchInput)
  const activeSort = React.useMemo(() => parseSortSearch(search.sort, { key: "id", direction: "desc" }), [search.sort])

  useEffect(() => {
    updateLatestSearch(search.q)
    setSearchInput(search.q)
  }, [search.q, updateLatestSearch])

  const buildSearchState = useCallback(
    (overrides?: Partial<{ q: string; page: number; gender: string; sort: string }>) =>
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
        to: "/clients/merge",
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
    if (!clinicId) {
      setClients([])
      setLoading(false)
      setTotal(null)
      setHasMore(false)
      return
    }
    void loadClients()
  }, [clinicId, loadClients])

  const toggleClient = (client: Client) => {
    if (!client.id) return
    setSelectedClients((previous) => {
      const next = previous.some((item) => item.id === client.id)
        ? previous.filter((item) => item.id !== client.id)
        : [...previous, client]
      setCanonicalClientId((current) => (current && next.some((item) => item.id === current) ? current : next[0]?.id || null))
      return next
    })
  }

  const handleMergeConfirm = async () => {
    if (!canonicalClientId) return
    const duplicateIds = selectedClients
      .map((client) => client.id)
      .filter((id): id is number => Boolean(id && id !== canonicalClientId))
    if (!duplicateIds.length) return
    try {
      setIsMerging(true)
      const response = await apiClient.mergeClients(canonicalClientId, duplicateIds)
      if (response.error) {
        toast.error(response.error)
        return
      }
      toast.success("הלקוחות מוזגו בהצלחה")
      setIsConfirmOpen(false)
      setSelectedClients([])
      setCanonicalClientId(null)
      await loadClients()
    } catch (error) {
      console.error("Error merging clients:", error)
      toast.error("שגיאה במיזוג לקוחות")
    } finally {
      setIsMerging(false)
    }
  }

  return (
    <>
      <SiteHeader title="מיזוג לקוחות" />
      <div className="flex h-full min-h-0 flex-1 flex-col p-4 lg:p-6" dir="rtl" style={{ scrollbarWidth: "none" }}>
        <ClientsTable
          data={clients}
          onClientDeleteFailed={loadClients}
          searchQuery={searchInput}
          onSearchChange={(value) => {
            updateLatestSearch(value)
            setSearchInput(value)
          }}
          serverFiltered={true}
          genderFilter={search.gender}
          onGenderFilterChange={(gender) =>
            void navigate({ to: "/clients/merge", search: buildSearchState({ gender, page: 1 }) })
          }
          hideNewButton
          loading={loading}
          fillHeight
          sort={activeSort}
          onSortChange={(sort) =>
            void navigate({ to: "/clients/merge", search: buildSearchState({ sort: sortToSearch(sort), page: 1 }) })
          }
          pagination={{
            page: search.page,
            pageSize,
            total,
            hasMore,
            setPage: (page) => void navigate({ to: "/clients/merge", search: buildSearchState({ page }) })
          }}
          toolbarActions={
            <>
              <Button asChild variant="outline" className="flex items-center gap-2">
                <GuardedRouterLink to="/clients">
                  <ArrowRight className="h-4 w-4" />
                  לקוחות
                </GuardedRouterLink>
              </Button>
              <Button asChild variant="outline" className="flex items-center gap-2">
                <GuardedRouterLink to="/clients/families">
                  <Users className="h-4 w-4" />
                  משפחות
                </GuardedRouterLink>
              </Button>
              <Button
                onClick={() => {
                  if (selectedClients.length >= 2) {
                    setCanonicalClientId(selectedClients[0].id || null)
                    setIsConfirmOpen(true)
                  }
                }}
                disabled={selectedClients.length < 2}
                className="flex items-center gap-2"
              >
                <GitMerge className="h-4 w-4" />
                מזג
              </Button>
            </>
          }
          mergeMode
          selectedMergeClientIds={selectedClients.map((client) => client.id).filter((id): id is number => Boolean(id))}
          selectedMergeClients={selectedClients}
          onToggleMergeClient={toggleClient}
        />
      </div>
      {isConfirmOpen ? (
        <CustomModal
          isOpen
          onClose={() => setIsConfirmOpen(false)}
          title="מיזוג לקוחות"
          onConfirm={handleMergeConfirm}
          confirmText="מזג לקוחות"
          cancelText="ביטול"
          isLoading={isMerging}
          width="max-w-2xl"
        >
          <div className="space-y-3 text-sm" dir="rtl">
            <p className="text-muted-foreground">
              הלקוח הראשי ישמור את פרטי הפרופיל שלו. כל התורים, הבדיקות, ההזמנות, ההפניות, הקבצים והרשומות יעברו אליו.
            </p>
            <div className="rounded-md border">
              {selectedClients.map((client) => (
                <label
                  key={client.id}
                  className="hover:bg-muted/60 flex cursor-pointer items-center justify-between border-b p-3 last:border-b-0"
                >
                  <div>
                    <div className="font-medium">
                      {`${client.first_name || ""} ${client.last_name || ""}`.trim() || `לקוח ${client.id}`}
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {[client.id ? `#${client.id}` : null, client.national_id, client.phone_mobile]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-xs">ראשי</span>
                    <input
                      type="radio"
                      name="canonical-client"
                      checked={canonicalClientId === client.id}
                      onChange={() => setCanonicalClientId(client.id || null)}
                    />
                  </div>
                </label>
              ))}
            </div>
            {isMerging ? (
              <div className="text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                ממזג לקוחות...
              </div>
            ) : null}
          </div>
        </CustomModal>
      ) : null}
    </>
  )
}
