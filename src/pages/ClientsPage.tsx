import React, { useState, useEffect } from "react"
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

export default function ClientsPage() {
  const search = useSearch({ from: "/clients" })
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const [clients, setClients] = useState<Client[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [familiesLoading, setFamiliesLoading] = useState(false)
  const [pageSize] = useState(25)
  const [clientsTotal, setClientsTotal] = useState(0)
  const [familiesTotal, setFamiliesTotal] = useState(0)
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
  const activeSort = React.useMemo(
    () => parseSortSearch(search.sort, { key: "id", direction: "desc" }),
    [search.sort],
  )

  useEffect(() => {
    updateLatestSearch(search.q)
    setSearchInput(search.q)
  }, [search.q, updateLatestSearch])

  const handleSearchInputChange = (value: string) => {
    updateLatestSearch(value)
    setSearchInput(value)
  }

  const buildSearchState = (overrides?: Partial<{ mode: string; q: string; page: number; gender: string; sort: string }>) =>
    buildTableSearch(
      {
        mode: search.mode,
        q: searchInput.trim(),
        page: search.page,
        gender: search.gender,
        sort: search.sort,
        ...overrides,
      },
      {
        mode: "clients",
        q: "",
        page: 1,
        gender: ALL_FILTER_VALUE,
        sort: "",
      },
    )

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/clients",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, TABLE_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [navigate, search.q, searchInput])

  const loadClients = async () => {
    const canCommit = startSearchRequest(search.q)
    try {
      setClientsLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedClients(
        currentClinic?.id,
        {
          limit: pageSize,
          offset,
          order: sortToOrder(activeSort, "id_desc"),
          q: search.q || undefined,
          gender: search.gender !== ALL_FILTER_VALUE ? search.gender : undefined,
        }
      )
      if (!canCommit()) return
      setClients(items)
      setClientsTotal(total)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      if (canCommit()) {
        setClientsLoading(false)
      }
    }
  }

  const loadFamilies = async () => {
    const canCommit = startSearchRequest(search.q)
    try {
      setFamiliesLoading(true)
      const offset = (search.page - 1) * pageSize
      const {items, total} = await getPaginatedFamilies(currentClinic?.id, {
        limit: pageSize,
        offset,
        order: sortToOrder(activeSort, "id_desc"),
        search: search.q || undefined,
      })
      if (!canCommit()) return
      setFamilies(items)
      setFamiliesTotal(total)
    } catch (error) {
      console.error('Error loading families:', error)
    } finally {
      if (canCommit()) {
        setFamiliesLoading(false)
      }
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
    if (currentClinic) {
      loadData()
    }
  }, [activeSort, currentClinic, pageSize, isFamilyMode, search.gender, search.page, search.q, startSearchRequest])

  const handleClientDeleted = (clientId: number) => {
    setClients(prevClients => prevClients.filter(client => client.id !== clientId))
    if (!isFamilyMode && clients.length === 1 && search.page > 1) {
      navigate({
        to: "/clients",
        search: buildSearchState({ page: search.page - 1 }),
      })
      return
    }
    if (!isFamilyMode) {
      setClientsTotal(prev => prev - 1)
    }
  }

  const handleClientDeleteFailed = () => {
    loadClients()
  }

  

  const handleFamilySelected = (family: Family | null) => {
    setSelectedFamily(family)
    if (isFamilyMode) {
      if (family?.id) {
        const found = families.find(f => f.id === family.id)
        const members = found?.clients || []
        setClients(members)
        setClientsTotal(members.length)
      } else {
        setClients([])
        setClientsTotal(0)
      }
    }
  }

  useEffect(() => {
    if (!isFamilyMode) return
    if (!selectedFamily?.id) {
      setClients([])
      setClientsTotal(0)
      return
    }
    const found = families.find(f => f.id === selectedFamily.id)
    const members = found?.clients || []
    setClients(members)
    setClientsTotal(members.length)
  }, [isFamilyMode, selectedFamily?.id, currentClinic?.id, families])

  const handleFamilyEdit = (family: Family) => {
    setEditingFamily(family)
    setIsFamilyModalOpen(true)
  }

  const handleFamilyDeleted = (familyId: number) => {
    setFamilies(prevFamilies => prevFamilies.filter(family => family.id !== familyId))
    if (selectedFamily?.id === familyId) {
      setSelectedFamily(null)
    }
    if (isFamilyMode && families.length === 1 && search.page > 1) {
      navigate({
        to: "/clients",
        search: buildSearchState({ page: search.page - 1 }),
      })
      return
    }
    if (isFamilyMode) {
      setFamiliesTotal(prev => prev - 1)
      return
    }
    loadClients()
  }

  const handleFamilyDeleteFailed = () => {
    loadFamilies()
  }

  const handleFamilyModalClose = () => {
    setIsFamilyModalOpen(false)
    setEditingFamily(null)
  }

  const handleFamilyChange = async () => {
    await loadData()
    if (isFamilyMode) {
      if (!selectedFamily?.id) {
        setClients([])
        setClientsTotal(0)
      } else {
        const found = families.find(f => f.id === selectedFamily.id)
        const members = found?.clients || []
        setClients(members)
        setClientsTotal(members.length)
      }
    }
  }

  const handleCreateFamily = () => {
    setEditingFamily(null)
    setIsFamilyModalOpen(true)
  }

  const toggleFamilyMode = () => {
    setSelectedFamily(null)
    setIsMergeMode(false)
    setSelectedMergeClients([])
    navigate({
      to: "/clients",
      search: buildSearchState({
        mode: isFamilyMode ? "clients" : "families",
        q: "",
        page: 1,
        gender: ALL_FILTER_VALUE,
        sort: "",
      }),
    })
  }

  const toggleMergeMode = () => {
    setIsMergeMode(prev => {
      const next = !prev
      if (!next) {
        setSelectedMergeClients([])
        setCanonicalClientId(null)
      }
      return next
    })
  }

  const toggleMergeClient = (client: Client) => {
    if (!client.id) return
    setSelectedMergeClients(prev => {
      const exists = prev.some(item => item.id === client.id)
      const next = exists ? prev.filter(item => item.id !== client.id) : [...prev, client]
      setCanonicalClientId(current => {
        if (current && next.some(item => item.id === current)) return current
        return next[0]?.id || null
      })
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
      .map(client => client.id)
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
      <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="@container/main flex flex-col gap-2">
          <div className="flex flex-col gap-2 md:gap-0 ">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-xl font-bold">{isFamilyMode ? "כל המשפחות" : "כל הלקוחות"}</h1>
            </div>

            {isFamilyMode ? (
              <div className="space-y-2.5">
                <TableFiltersBar
                  searchValue={searchInput}
                  onSearchChange={handleSearchInputChange}
                  searchPlaceholder="חיפוש משפחות…"
                  actions={
                    <>
                      <Button
                        onClick={handleCreateFamily}
                        className="flex items-center gap-2"
                      >
                        <PlusIcon className="h-4 w-4" />
                        משפחה חדשה
                      </Button>
                      <Button
                        variant="default"
                        onClick={toggleFamilyMode}
                        className="flex items-center gap-2"
                        title="מצב רגיל"
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    </>
                  }
                />
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="space-y-4">
                    <FamiliesTable
                      data={families}
                      onFamilySelected={handleFamilySelected}
                      onFamilyEdit={handleFamilyEdit}
                      onFamilyDeleted={handleFamilyDeleted}
                      onFamilyDeleteFailed={handleFamilyDeleteFailed}
                      selectedFamilyId={selectedFamily?.id}
                      searchQuery={searchInput}
                      onSearchChange={handleSearchInputChange}
                      hideSearch={true}
                      serverFiltered={true}
                      loading={familiesLoading}
                      sort={activeSort}
                      onSortChange={(sort) =>
                        navigate({
                          to: "/clients",
                          search: buildSearchState({ sort: sortToSearch(sort), page: 1 }),
                        })
                      }
                      pagination={{
                        page: search.page,
                        pageSize,
                        total: familiesTotal,
                        setPage: (page) =>
                          navigate({
                            to: "/clients",
                            search: buildSearchState({ page }),
                          }),
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <ClientsTable
                      data={clients}
                      onClientDeleted={handleClientDeleted}
                      onClientDeleteFailed={handleClientDeleteFailed}
                      selectedFamilyId={selectedFamily?.id}
                      showFamilyColumn={true}
                      hideSearch={true}
                      hideNewButton={true}
                      compactMode={true}
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
                serverFiltered={true}
                genderFilter={search.gender}
                onGenderFilterChange={(value) =>
                  navigate({
                    to: "/clients",
                    search: buildSearchState({ gender: value, page: 1 }),
                  })
                }
                hideNewButton={true}
                loading={clientsLoading}
                sort={activeSort}
                onSortChange={(sort) =>
                  navigate({
                    to: "/clients",
                    search: buildSearchState({ sort: sortToSearch(sort), page: 1 }),
                  })
                }
                pagination={{
                  page: search.page,
                  pageSize,
                  total: clientsTotal,
                  setPage: (page) =>
                    navigate({
                      to: "/clients",
                      search: buildSearchState({ page }),
                    }),
                }}
                toolbarActions={
                  <>
                    <Button asChild className="flex items-center gap-2">
                      <GuardedRouterLink to="/clients/new">
                        <PlusIcon className="h-4 w-4" />
                        לקוח חדש
                      </GuardedRouterLink>
                    </Button>
                    <Button
                      variant="outline"
                      onClick={toggleFamilyMode}
                      className="flex items-center gap-2"
                      title="מצב משפחות"
                    >
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
                    {isMergeMode && (
                      <Button
                        onClick={openMergeConfirm}
                        disabled={selectedMergeClients.length < 2}
                        className="flex items-center gap-2"
                      >
                        <GitMerge className="h-4 w-4" />
                        מזג
                      </Button>
                    )}
                  </>
                }
                mergeMode={isMergeMode}
                selectedMergeClientIds={selectedMergeClients.map(client => client.id).filter((id): id is number => Boolean(id))}
                selectedMergeClients={selectedMergeClients}
                onToggleMergeClient={toggleMergeClient}
              />
            )}
            
            <div className="h-12"></div>
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
        <div className="space-y-3 text-sm">
          <p className="text-muted-foreground">
            הלקוח הראשי ישמור את פרטי הפרופיל שלו. כל התורים, הבדיקות, ההזמנות, ההפניות, הקבצים והרשומות יעברו אליו.
          </p>
          <div className="rounded-md border">
            {selectedMergeClients.map(client => (
              <label
                key={client.id}
                className="flex cursor-pointer items-center justify-between border-b p-3 last:border-b-0 hover:bg-muted/60"
              >
                <div>
                  <div className="font-medium">{`${client.first_name || ""} ${client.last_name || ""}`.trim() || `לקוח ${client.id}`}</div>
                  <div className="text-xs text-muted-foreground">
                    {[client.id ? `#${client.id}` : null, client.national_id, client.phone_mobile].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">ראשי</span>
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
          {isMergingClients && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              ממזג לקוחות...
            </div>
          )}
        </div>
      </CustomModal>
    </>
  )
} 
