import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { ClientsTable } from "@/components/clients-table"
import { FamiliesTable } from "@/components/families-table"
import { FamilyManagementModal } from "@/components/FamilyManagementModal"
import { getAllClients } from "@/lib/db/clients-db"
import { getAllFamilies } from "@/lib/db/family-db"
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
  const [loading, setLoading] = useState(true)
  const [isFamilyMode, setIsFamilyMode] = useState(false)
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null)
  const [isFamilyModalOpen, setIsFamilyModalOpen] = useState(false)
  const [editingFamily, setEditingFamily] = useState<Family | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  const loadClients = async () => {
    try {
      setLoading(true)
      const clientsData = await getAllClients(currentClinic?.id)
      setClients(clientsData)
    } catch (error) {
      console.error('Error loading clients:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadFamilies = async () => {
    try {
      const familiesData = await getAllFamilies(currentClinic?.id)
      setFamilies(familiesData)
    } catch (error) {
      console.error('Error loading families:', error)
    }
  }

  const loadData = async () => {
    await Promise.all([loadClients(), loadFamilies()])
  }

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [currentClinic])

  const handleClientDeleted = (clientId: number) => {
    setClients(prevClients => prevClients.filter(client => client.id !== clientId))
  }

  const handleClientDeleteFailed = () => {
    loadClients()
  }

  const handleFamilySelected = (family: Family | null) => {
    setSelectedFamily(family)
  }

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

  const handleFamilyChange = () => {
    loadData()
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
                    loading={loading}
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
                loading={loading}
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