import React, { useEffect, useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { ClientsTable } from "@/components/clients-table"
import { FamiliesTable } from "@/components/families-table"
import { FamilyManagementModal } from "@/components/FamilyManagementModal"
import { getPaginatedClients } from "@/lib/db/clients-db"
import { getPaginatedFamilies } from "@/lib/db/family-db"
import { Client, Family } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { Users, PlusIcon, GitMerge, Loader2 } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { TableFiltersBar } from "@/components/table-filters-bar"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { TABLE_SEARCH_DEBOUNCE_MS, buildTableSearch, useLatestTableSearchRequest } from "@/lib/list-page-search"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"
import { parseSortSearch, sortToOrder, sortToSearch } from "@/lib/table-sorting"
import { CustomModal } from "@/components/ui/custom-modal"
import { apiClient } from "@/lib/api-client"
import { toast } from "sonner"
import { deferPaginationTotal } from "@/lib/deferred-pagination"
import { useAppLocale } from "@/localization/use-app-locale"

export default function ClientsPage() {
  const search = useSearch({ from: "/clients" })
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const { direction } = useAppLocale()
  const clinicId = currentClinic?.id
  const [clients, setClients] = useState<Client[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [familiesLoading, setFamiliesLoading] = useState(false)
  const [pageSize] = useState(25)
  const [clientsTotal, setClientsTotal] = useState<number | null>(null)
  const [clientsHasMore, setClientsHasMore] = useState(false)
  const [familiesTotal, setFamiliesTotal] = useState<number | null>(null)
  const [familiesHasMore, setFamiliesHasMore] = useState(false)
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [isMergeMode, setIsMergeMode] = useState(false)
  const [selectedMergeClients, setSelectedMergeClients] = useState<Client[]>([])
  const [isMergeModalOpen, setIsMergeModalOpen] = useState(false)
  const [canonicalClientId, setCanonicalClientId] = useState<number | null>(null)
  const [isMergingClients, setIsMergingClients] = useState(false)
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [searchInput, setSearchInput] = useState(search.q)
  const { startSearchRequest, updateLatestSearch } = useLatestTableSearchRequest(searchInput)
  const isFamilyMode = search.mode === "families"
  const activeSort = React.useMemo(() => parseSortSearch(search.sort, { key: "id", direction: "desc" }), [search.sort])

  useEffect(() => {
    updateLatestSearch(search.q)
    setSearchInput(search.q)
  }, [search.q, updateLatestSearch])

  const handleSearchInputChange = (value: string) => {
    updateLatestSearch(value)
    setSearchInput(value)
  }

  const buildSearchState = (
    overrides?: Partial<{
      mode: string
      q: string
      page: number
      gender: string
      sort: string
    }>
  ) =>
    buildTableSearch(
      {
        mode: search.mode,
        q: searchInput.trim(),
        page: search.page,
        gender: search.gender,
        sort: search.sort,
        ...overrides
      },
      {
        mode: "clients",
        q: "",
        page: 1,
        gender: ALL_FILTER_VALUE,
        sort: ""
      }
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
  }, [navigate, search.q, searchInput])

  const loadClients = async () => {
    if (!clinicId) return
    const canCommit = startSearchRequest(search.q)
    try {
      setClientsLoading(true)
      setClientsTotal(null)
      const paginationOptions = {
        limit: pageSize,
        offset: (search.page - 1) * pageSize,
        order: sortToOrder(activeSort, "id_desc"),
        q: search.q || undefined,
        gender: search.gender !== ALL_FILTER_VALUE ? search.gender : undefined,
        includeTotal: false
      }
      const { items, hasMore } = await getPaginatedClients(clinicId, paginationOptions)
      if (!canCommit()) return
      setClients(items)
      setClientsHasMore(hasMore)
      deferPaginationTotal(
        () => getPaginatedClients(clinicId, { ...paginationOptions, countOnly: true }),
        canCommit,
        setClientsTotal
      )
    } catch (error) {
      console.error("Error loading clients:", error)
    } finally {
      if (canCommit()) setClientsLoading(false)
    }
  }

  const loadFamilies = async () => {
    if (!clinicId) return
    const canCommit = startSearchRequest(search.q)
    try {
      setFamiliesLoading(true)
      setFamiliesTotal(null)
      const paginationOptions = {
        limit: pageSize,
        offset: (search.page - 1) * pageSize,
        order: sortToOrder(activeSort, "id_desc"),
        search: search.q || undefined,
        includeTotal: false
      }
      const { items, hasMore } = await getPaginatedFamilies(clinicId, paginationOptions)
      if (!canCommit()) return
      setFamilies(items)
      setFamiliesHasMore(hasMore)
      deferPaginationTotal(
        () => getPaginatedFamilies(clinicId, { ...paginationOptions, countOnly: true }),
        canCommit,
        setFamiliesTotal
      )
    } catch (error) {
      console.error("Error loading families:", error)
    } finally {
      if (canCommit()) setFamiliesLoading(false)
    }
  }

  const loadData = async () => {
    if (isFamilyMode) {
      await loadFamilies()
    } else {
      await loadClients()
    }
  }

  useEffect(() => {
    if (!clinicId) {
      setClients([])
      setFamilies([])
      setClientsLoading(false)
      setFamiliesLoading(false)
      return
    }
    void loadData()
  }, [activeSort, clinicId, pageSize, isFamilyMode, search.gender, search.page, search.q, startSearchRequest])

  const handleClientDeleted = (clientId: number) => {
    setClients((previous) => previous.filter((client) => client.id !== clientId))
    if (!isFamilyMode && clients.length === 1 && search.page > 1) {
      void navigate({ to: "/clients", search: buildSearchState({ page: search.page - 1 }) })
      return
    }
    if (!isFamilyMode) {
      setClientsTotal((previous) => (previous === null ? null : Math.max(0, previous - 1)))
    }
  }

  const handleClientDeleteFailed = () => {
    void loadClients()
  }

  const setSelectedFamilyClients = (family: Family | null) => {
    if (!family?.id) {
      setClients([])
      setClientsTotal(0)
      setClientsHasMore(false)
      return
    }
    const members = families.find((item) => item.id === family.id)?.clients || []
    setClients(members)
    setClientsTotal(members.length)
    setClientsHasMore(false)
  }

  const handleFamilySelected = (family: Family | null) => {
    setSelectedFamily(family)
    if (isFamilyMode) setSelectedFamilyClients(family)
  }

  useEffect(() => {
    if (isFamilyMode) setSelectedFamilyClients(selectedFamily)
  }, [isFamilyMode, selectedFamily?.id, clinicId, families])

  const handleFamilyEdit = (family: Family) => {
    setEditingFamily(family)
    setIsFamilyModalOpen(true)
  }

  const handleFamilyDeleted = (familyId: number) => {
    setFamilies((previous) => previous.filter((family) => family.id !== familyId))
    if (selectedFamily?.id === familyId) setSelectedFamily(null)
    if (isFamilyMode && families.length === 1 && search.page > 1) {
      void navigate({ to: "/clients", search: buildSearchState({ page: search.page - 1 }) })
      return
    }
    if (isFamilyMode) {
      setFamiliesTotal((previous) => (previous === null ? null : Math.max(0, previous - 1)))
      return
    }
    void loadClients()
  }

  const handleFamilyDeleteFailed = () => {
    void loadFamilies()
  }

  const handleFamilyModalClose = () => {
    setIsFamilyModalOpen(false)
    setEditingFamily(null)
  }

  const handleFamilyChange = async () => {
    await loadData()
  }

  const handleCreateFamily = () => {
    setEditingFamily(null)
    setIsFamilyModalOpen(true)
  }

  const toggleFamilyMode = () => {
    setSelectedFamily(null)
    setIsMergeMode(false)
    setSelectedMergeClients([])
    void navigate({
      to: "/clients",
      search: buildSearchState({
        mode: isFamilyMode ? "clients" : "families",
        q: "",
        page: 1,
        gender: ALL_FILTER_VALUE,
        sort: ""
      })
    })
  }

  const toggleMergeMode = () => {
    setIsMergeMode((previous) => {
      const next = !previous
      if (!next) {
        setSelectedMergeClients([])
        setCanonicalClientId(null)
      }
      return next
    })
  }

  const toggleMergeClient = (client: Client) => {
    if (!client.id) return
    setSelectedMergeClients((previous) => {
      const next = previous.some((item) => item.id === client.id)
        ? previous.filter((item) => item.id !== client.id)
        : [...previous, client]
      setCanonicalClientId((current) => (current && next.some((item) => item.id === current) ? current : next[0]?.id || null))
      return next
    })
  }

  const openMergeConfirm = () => {
    if (selectedMergeClients.length < 2) return
    setCanonicalClientId(selectedMergeClients[0].id || null)
    setIsMergeModalOpen(true)
  }

  const handleMergeConfirm = async () => {
    if (!canonicalClientId) return
    const duplicateIds = selectedMergeClients
      .map((client) => client.id)
      .filter((id): id is number => Boolean(id && id !== canonicalClientId))
    if (!duplicateIds.length) return
    try {
      setIsMergingClients(true)
      const response = await apiClient.mergeClients(canonicalClientId, duplicateIds)
      if (response.error) {
        toast.error(response.error)
        return
      }
      toast.success("הלקוחות מוזגו בהצלחה")
      setIsMergeModalOpen(false)
      setIsMergeMode(false)
      setSelectedMergeClients([])
      setCanonicalClientId(null)
      await loadClients()
    } catch (error) {
      console.error("Error merging clients:", error)
      toast.error("שגיאה במיזוג לקוחות")
    } finally {
      setIsMergingClients(false)
    }
  }

  return (
    <>
      <SiteHeader title="לקוחות" />
      <div className="flex h-full min-h-0 flex-1 flex-col p-4 lg:p-6" dir={direction} style={{ scrollbarWidth: "none" }}>
        <div className="@container/main flex min-h-0 flex-1 flex-col">
          <div className="flex min-h-0 flex-1 flex-col">
            {isFamilyMode ? (
              <div className="flex min-h-0 flex-1 flex-col gap-2.5">
                <TableFiltersBar
                  searchValue={searchInput}
                  onSearchChange={handleSearchInputChange}
                  searchPlaceholder="חיפוש משפחות…"
                  actions={
                    <>
                      <Button onClick={handleCreateFamily} className="flex items-center gap-2">
                        <PlusIcon className="h-4 w-4" />
                        משפחה חדשה
                      </Button>
                      <Button variant="default" onClick={toggleFamilyMode} className="flex items-center gap-2" title="מצב רגיל">
                        <Users className="h-4 w-4" />
                      </Button>
                    </>
                  }
                />
                <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="flex min-h-0 flex-col">
                    <FamiliesTable
                      data={families}
                      onFamilySelected={handleFamilySelected}
                      onFamilyEdit={handleFamilyEdit}
                      onFamilyDeleted={handleFamilyDeleted}
                      onFamilyDeleteFailed={handleFamilyDeleteFailed}
                      selectedFamilyId={selectedFamily?.id}
                      searchQuery={searchInput}
                      onSearchChange={handleSearchInputChange}
                      hideSearch
                      serverFiltered
                      loading={familiesLoading}
                      fillHeight
                      sort={activeSort}
                      onSortChange={(sort) =>
                        void navigate({ to: "/clients", search: buildSearchState({ sort: sortToSearch(sort), page: 1 }) })
                      }
                      pagination={{
                        page: search.page,
                        pageSize,
                        total: familiesTotal,
                        hasMore: familiesHasMore,
                        setPage: (page) => void navigate({ to: "/clients", search: buildSearchState({ page }) })
                      }}
                    />
                  </div>
                  <div className="flex min-h-0 flex-col">
                    <ClientsTable
                      data={clients}
                      onClientDeleted={handleClientDeleted}
                      onClientDeleteFailed={handleClientDeleteFailed}
                      selectedFamilyId={selectedFamily?.id}
                      showFamilyColumn
                      hideSearch
                      hideNewButton
                      compactMode
                      fillHeight
                    />
                  </div>
                </div>
              </div>
            ) : (
              <ClientsTable
                data={clients}
                onClientDeleted={handleClientDeleted}
                onClientDeleteFailed={handleClientDeleteFailed}
                searchQuery={searchInput}
                onSearchChange={handleSearchInputChange}
                serverFiltered
                genderFilter={search.gender}
                onGenderFilterChange={(gender) =>
                  void navigate({ to: "/clients", search: buildSearchState({ gender, page: 1 }) })
                }
                hideNewButton
                loading={clientsLoading}
                fillHeight
                sort={activeSort}
                onSortChange={(sort) =>
                  void navigate({ to: "/clients", search: buildSearchState({ sort: sortToSearch(sort), page: 1 }) })
                }
                pagination={{
                  page: search.page,
                  pageSize,
                  total: clientsTotal,
                  hasMore: clientsHasMore,
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
                    <Button variant="outline" onClick={toggleFamilyMode} className="flex items-center gap-2" title="מצב משפחות">
                      <Users className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={isMergeMode ? "default" : "outline"}
                      onClick={toggleMergeMode}
                      className="flex items-center gap-2"
                      title="מצב מיזוג"
                    >
                      <GitMerge className="h-4 w-4" />
                    </Button>
                    {isMergeMode ? (
                      <Button onClick={openMergeConfirm} disabled={selectedMergeClients.length < 2} className="flex items-center gap-2">
                        <GitMerge className="h-4 w-4" />
                        מזג
                      </Button>
                    ) : null}
                  </>
                }
                mergeMode={isMergeMode}
                selectedMergeClientIds={selectedMergeClients.map((client) => client.id).filter((id): id is number => Boolean(id))}
                selectedMergeClients={selectedMergeClients}
                onToggleMergeClient={toggleMergeClient}
              />
            )}
          </div>
        </div>
      </div>

      <FamilyManagementModal
        isOpen={isFamilyModalOpen}
        onClose={handleFamilyModalClose}
        family={editingFamily}
        onFamilyChange={handleFamilyChange}
      />

      <CustomModal
        isOpen={isMergeModalOpen}
        onClose={() => setIsMergeModalOpen(false)}
        title="מיזוג לקוחות"
        onConfirm={handleMergeConfirm}
        confirmText="מזג לקוחות"
        cancelText="ביטול"
        isLoading={isMergingClients}
        width="max-w-2xl"
      >
        <div className="space-y-3 text-sm" dir={direction}>
          <p className="text-muted-foreground">
            הלקוח הראשי ישמור את פרטי הפרופיל שלו. כל התורים, הבדיקות, ההזמנות, ההפניות, הקבצים והרשומות יעברו אליו.
          </p>
          <div className="rounded-md border">
            {selectedMergeClients.map((client) => (
              <label
                key={client.id}
                className="hover:bg-muted/60 flex cursor-pointer items-center justify-between border-b p-3 last:border-b-0"
              >
                <div>
                  <div className="font-medium">
                    {`${client.first_name || ""} ${client.last_name || ""}`.trim() || `לקוח ${client.id}`}
                  </div>
                  <div className="text-muted-foreground text-xs">
                    {[client.id ? `#${client.id}` : null, client.national_id, client.phone_mobile].filter(Boolean).join(" · ")}
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
          {isMergingClients ? (
            <div className="text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              ממזג לקוחות...
            </div>
          ) : null}
        </div>
      </CustomModal>
    </>
  )
}
