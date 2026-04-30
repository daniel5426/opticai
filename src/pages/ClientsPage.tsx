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
import { Users, PlusIcon } from "lucide-react"
import { useUser } from "@/contexts/UserContext"
import { TableFiltersBar } from "@/components/table-filters-bar"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { buildTableSearch } from "@/lib/list-page-search"
import { GuardedRouterLink } from "@/components/GuardedRouterLink"

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
  
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [searchInput, setSearchInput] = useState(search.q)
  const isFamilyMode = search.mode === "families"

  useEffect(() => {
    setSearchInput(search.q)
  }, [search.q])

  const buildSearchState = (overrides?: Partial<{ mode: string; q: string; page: number; gender: string }>) =>
    buildTableSearch(
      {
        mode: search.mode,
        q: searchInput.trim(),
        page: search.page,
        gender: search.gender,
        ...overrides,
      },
      {
        mode: "clients",
        q: "",
        page: 1,
        gender: ALL_FILTER_VALUE,
      },
    )

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/clients",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, 400)
    return () => clearTimeout(t)
  }, [navigate, search.q, searchInput])

  // Show loading instantly while waiting for debounced server search
  useEffect(() => {
    if (!currentClinic) return
    if (isFamilyMode) {
      setFamiliesLoading(true)
      setFamilies([])
    } else {
      setClientsLoading(true)
      setClients([])
    }
  }, [currentClinic, isFamilyMode, searchInput])

  const loadClients = async () => {
    try {
      setClientsLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedClients(
        currentClinic?.id,
        {
          limit: pageSize,
          offset,
          order: 'id_desc',
          q: search.q || undefined,
          gender: search.gender !== ALL_FILTER_VALUE ? search.gender : undefined,
        }
      )
      setClients(items)
      setClientsTotal(total)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setClientsLoading(false)
    }
  }

  const loadFamilies = async () => {
    try {
      setFamiliesLoading(true)
      const offset = (search.page - 1) * pageSize
      const {items, total} = await getPaginatedFamilies(currentClinic?.id, {
        limit: pageSize,
        offset,
        order: 'id_desc',
        search: search.q || undefined,
      })
      setFamilies(items)
      setFamiliesTotal(total)
    } catch (error) {
      console.error('Error loading families:', error)
    } finally {
      setFamiliesLoading(false)
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
  }, [currentClinic, pageSize, isFamilyMode, search.gender, search.page, search.q])

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
    navigate({
      to: "/clients",
      search: buildSearchState({
        mode: isFamilyMode ? "clients" : "families",
        q: "",
        page: 1,
        gender: ALL_FILTER_VALUE,
      }),
    })
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
                  onSearchChange={setSearchInput}
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
                      onSearchChange={setSearchInput}
                      hideSearch={true}
                      loading={familiesLoading}
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
                onSearchChange={setSearchInput}
                genderFilter={search.gender}
                onGenderFilterChange={(value) =>
                  navigate({
                    to: "/clients",
                    search: buildSearchState({ gender: value, page: 1 }),
                  })
                }
                hideNewButton={true}
                loading={clientsLoading}
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
                  </>
                }
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
    </>
  )
} 
