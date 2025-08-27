import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { ClientsTable } from "@/components/clients-table"
import { FamiliesTable } from "@/components/families-table"
import { FamilyManagementModal } from "@/components/FamilyManagementModal"
import { getAllClients, getPaginatedClients } from "@/lib/db/clients-db"
import { getAllFamilies, getPaginatedFamilies } from "@/lib/db/family-db"
import { Client, Family } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Users, UserPlus, PlusIcon } from "lucide-react"
import { useUser } from "@/contexts/UserContext"

export default function ClientsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const [clients, setClients] = useState<Client[]>([])
  const [families, setFamilies] = useState<Family[]>([])
  const [clientsLoading, setClientsLoading] = useState(true)
  const [familiesLoading, setFamiliesLoading] = useState(false)
  const [clientsPage, setClientsPage] = useState(1)
  const [familiesPage, setFamiliesPage] = useState(1)
  const [pageSize] = useState(25)
  const [clientsTotal, setClientsTotal] = useState(0)
  const [familiesTotal, setFamiliesTotal] = useState(0)
  const [isFamilyMode, setIsFamilyMode] = useState(false)
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

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
  }, [searchQuery, currentClinic, isFamilyMode])

  const loadClients = async () => {
    try {
      setClientsLoading(true)
      const offset = (clientsPage - 1) * pageSize
      const { items, total } = await getPaginatedClients(
        currentClinic?.id,
        { limit: pageSize, offset, order: 'id_desc', search: isFamilyMode ? undefined : (debouncedSearch || undefined) }
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
      const offset = (familiesPage - 1) * pageSize
      const {items, total} = await getPaginatedFamilies(currentClinic?.id, { limit: pageSize, offset, order: 'id_desc', search: debouncedSearch || undefined })
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
      await Promise.all([loadFamilies(), loadClients()])
    } else {
      await loadClients()
    }
  }

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [currentClinic, pageSize, debouncedSearch, isFamilyMode, clientsPage, familiesPage])

  // Reset to first page when search changes
  useEffect(() => {
    if (isFamilyMode) {
      setFamiliesPage(1)
    } else {
      setClientsPage(1)
    }
  }, [debouncedSearch, isFamilyMode])

  const handleClientDeleted = (clientId: number) => {
    setClients(prevClients => prevClients.filter(client => client.id !== clientId))
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
    setIsFamilyMode(!isFamilyMode)
    setSelectedFamily(null)
    setSearchQuery("")
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
            <div className="flex items-center justify-between mb-4">
                          <div className="flex gap-2">
                <Input
                  placeholder={isFamilyMode ? "חיפוש משפחות..." : "חיפוש לקוחות..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-[250px] bg-card dark:bg-card"
                  dir="rtl"
                />
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={isFamilyMode ? handleCreateFamily : () => navigate({ to: "/clients/new" })}
                  className="flex items-center gap-2"
                >
                  {isFamilyMode ? (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      משפחה חדשה
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      לקוח חדש
                    </>
                  )}
                </Button>
                <Button 
                  variant={isFamilyMode ? "default" : "outline"}
                  onClick={toggleFamilyMode}
                  className={`flex items-center gap-2 ${!isFamilyMode ? 'bg-card dark:bg-card' : ''}`}
                  title={isFamilyMode ? "מצב רגיל" : "מצב משפחות"}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </div>
              
            </div>

            {isFamilyMode ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <FamiliesTable 
                    data={families}
                    onFamilySelected={handleFamilySelected}
                    onFamilyEdit={handleFamilyEdit}
                    onFamilyDeleted={handleFamilyDeleted}
                    onFamilyDeleteFailed={handleFamilyDeleteFailed}
                    selectedFamilyId={selectedFamily?.id}
                    searchQuery={searchQuery}
                    onSearchChange={setSearchQuery}
                    hideSearch={true}
                    loading={familiesLoading}
                    pagination={{ page: familiesPage, pageSize, total: familiesTotal, setPage: setFamiliesPage }}
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
            ) : (
              <ClientsTable 
                data={clients} 
                onClientDeleted={handleClientDeleted}
                onClientDeleteFailed={handleClientDeleteFailed}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                hideSearch={true}
                hideNewButton={true}
                loading={clientsLoading}
                pagination={{ page: clientsPage, pageSize, total: clientsTotal, setPage: setClientsPage }}
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