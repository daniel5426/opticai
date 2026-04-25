import React, { useState, useRef, useEffect } from "react"
import { useParams, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getClientById, updateClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema-interface"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import {
  ClientDetailsTab,
  ClientExamsTab,
  ClientOrdersTab,
  ClientMedicalRecordTab,
  ClientReferralTab,
  ClientAppointmentsTab,
  ClientFilesTab
} from "@/components/client"
import { ClientDataProvider } from "@/contexts/ClientDataContext"
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout"
import { useClientSidebar } from "@/contexts/ClientSidebarContext"

export default function ClientDetailPage() {
  const { clientId } = useParams({ from: "/clients/$clientId" })

  // Get search params to check for tab parameter
  let initialTab = 'details'
  try {
    const searchParams = useSearch({ from: "/clients/$clientId" })
    const urlTab = (searchParams as any)?.tab

    if (urlTab) {
      // If URL specifies a tab, use it
      initialTab = urlTab
    } else {
      // If no URL tab, check localStorage for remembered tab
      const rememberedTab = localStorage.getItem(`client-${clientId}-last-tab`)
      initialTab = rememberedTab || 'details'
    }
  } catch {
    // Fallback to URL search params or localStorage
    const urlSearchParams = new URLSearchParams(window.location.search)
    const urlTab = urlSearchParams.get('tab')

    if (urlTab) {
      initialTab = urlTab
    } else {
      const rememberedTab = localStorage.getItem(`client-${clientId}-last-tab`)
      initialTab = rememberedTab || 'details'
    }
  }

  const { currentClient, updateCurrentClient, setActiveTab: setSidebarActiveTab } = useClientSidebar()
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Client>({} as Client)
  const formDataRef = useRef<Client>({} as Client)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [refreshKey, setRefreshKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const isDetailsLoading = !currentClient || !currentClient.id

  useEffect(() => {
    if (!currentClient || isEditing) return
    const next = { ...currentClient }
    formDataRef.current = next
    setFormData(next)
  }, [currentClient, isEditing])

  const updateFormData = (updater: (prev: Client) => Client) => {
    const next = updater(formDataRef.current)
    formDataRef.current = next
    setFormData(next)
  }

  useEffect(() => {
    // Refresh orders and referrals data when switching to those tabs
    if (activeTab === 'orders' || activeTab === 'referrals') {
      setRefreshKey(prev => prev + 1)
    }

    // Save current tab to localStorage for this client
    if (clientId && activeTab) {
      localStorage.setItem(`client-${clientId}-last-tab`, activeTab)
    }

    // Update the sidebar context with the active tab
    setSidebarActiveTab(activeTab)
  }, [activeTab, clientId, setSidebarActiveTab])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    updateFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string | boolean, name: string) => {
    let processedValue: any = value

    // Convert family_id to number if it's a string
    if (name === 'family_id' && typeof value === 'string') {
      processedValue = value === '' ? null : parseInt(value, 10)
    }

    updateFormData(prev => ({
      ...prev,
      [name]: processedValue,
      ...(name === 'health_fund' ? { status: '' } : {})
    }))
  }

  const handleSave = async () => {
    if (!formRef.current) return
    const latestFormData = formDataRef.current
    const prev = currentClient ? { ...currentClient } : { ...latestFormData }
    updateCurrentClient(latestFormData)
    setIsEditing(false)
    const p = updateClient(latestFormData)
    p.then((updated) => {
      if (updated) {
        const next = { ...updated }
        formDataRef.current = next
        setFormData(next)
        updateCurrentClient(next)
        toast.success("פרטי הלקוח עודכנו בהצלחה")
      } else {
        formDataRef.current = prev
        updateCurrentClient(prev)
        setFormData(prev)
        setIsEditing(true)
        toast.error("לא הצלחנו לשמור את השינויים")
      }
    }).catch(() => {
      formDataRef.current = prev
      updateCurrentClient(prev)
      setFormData(prev)
      setIsEditing(true)
      toast.error("לא הצלחנו לשמור את השינויים")
    })
  }




  return (
    <ClientDataProvider clientId={Number(clientId)}>
      <SiteHeader
        title="לקוחות"
        backLink="/clients"
        tabs={{
          activeTab,
          onTabChange: setActiveTab
        }}
      />
      <ClientSpaceLayout>
        <div className="flex flex-col flex-1 p-2 lg:p-5 mb-30" dir="rtl" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <Tabs
            value={activeTab}
            className="w-full"
            onValueChange={(value) => setActiveTab(value)}
          >
            <TabsContent value="details">
              <ClientDetailsTab
                client={currentClient || {} as Client}
                formData={formData}
                isEditing={isEditing}
                isLoading={isDetailsLoading}
                handleInputChange={handleInputChange}
                handleSelectChange={handleSelectChange}
                formRef={formRef as React.RefObject<HTMLFormElement>}
                setIsEditing={setIsEditing}
                handleSave={handleSave}
                onClientUpdate={updateCurrentClient}
              />
            </TabsContent>

            <TabsContent value="exams">
              <ClientExamsTab />
            </TabsContent>

            <TabsContent value="medical">
              <ClientMedicalRecordTab />
            </TabsContent>

            <TabsContent value="orders">
              <ClientOrdersTab key={refreshKey} />
            </TabsContent>


            <TabsContent value="referrals">
              <ClientReferralTab key={refreshKey} />
            </TabsContent>

            <TabsContent value="appointments">
              <ClientAppointmentsTab />
            </TabsContent>

            <TabsContent value="files">
              <ClientFilesTab />
            </TabsContent>

          </Tabs>
        </div>
      </ClientSpaceLayout>
    </ClientDataProvider>
  )
} 
