import React, { useState, useRef, useEffect } from "react"
import { useParams, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getClientById, updateClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { 
  ClientDetailsTab, 
  ClientExamsTab, 
  ClientOrdersTab,
  ClientBillingTab,
  ClientMedicalRecordTab,
  ClientContactLensTab,
  ClientReferralTab,
  ClientAppointmentsTab,
  ClientFilesTab
} from "@/components/client"

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
  
  const [client, setClient] = useState<Client | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Client>({} as Client)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [refreshKey, setRefreshKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  
  useEffect(() => {
    const loadClient = async () => {
      try {
        setLoading(true)
        const clientData = await getClientById(Number(clientId))
        setClient(clientData)
        if (clientData) {
          setFormData({ ...clientData })
        }
      } catch (error) {
        console.error('Error loading client:', error)
      } finally {
        setLoading(false)
      }
    }

    loadClient()
  }, [clientId])

  useEffect(() => {
    // Refresh orders data when switching to orders tab
    if (activeTab === 'orders') {
      setRefreshKey(prev => prev + 1)
    }
    
    // Save current tab to localStorage for this client
    if (clientId && activeTab) {
      localStorage.setItem(`client-${clientId}-last-tab`, activeTab)
    }
  }, [activeTab, clientId])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string | boolean, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  const handleSave = async () => {
    if (formRef.current) {
      try {
        // Update client data in the database
        const updatedClient = await updateClient(formData)
        
        if (updatedClient) {
          setClient(updatedClient)
          setIsEditing(false)
          toast.success("פרטי הלקוח עודכנו בהצלחה")
        } else {
          toast.error("לא הצלחנו לשמור את השינויים")
        }
      } catch (error) {
        toast.error("לא הצלחנו לשמור את השינויים")
      }
    }
  }
  
  if (loading) {
    return (
      <>
        <SiteHeader title="לקוחות" backLink="/clients" />
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-lg">טוען פרטי לקוח...</div>
        </div>
      </>
    )
  }
  
  if (!client) {
    return (
      <>
        <SiteHeader title="לקוחות" backLink="/clients" />
        <div className="flex flex-col items-center justify-center h-full">
          <h1 className="text-2xl">לקוח לא נמצא</h1>
        </div>
      </>
    )
  }

  const fullName = `${client.first_name} ${client.last_name}`.trim()
  
  return (
    <>
      <SiteHeader 
        title="לקוחות" 
        backLink="/clients"
        client={client}
        tabs={{
          activeTab,
          onTabChange: setActiveTab
        }}
      />
      <div className="flex flex-col flex-1 p-4 lg:p-6 mb-30 overflow-auto scrollbar-hide" dir="rtl" style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}>
        <Tabs 
          value={activeTab}
          className="w-full"
          onValueChange={(value) => setActiveTab(value)}
        >
          <TabsContent value="details">
            <ClientDetailsTab 
              client={client}
              formData={formData}
              isEditing={isEditing}
              handleInputChange={handleInputChange}
              handleSelectChange={handleSelectChange}
              formRef={formRef as React.RefObject<HTMLFormElement>}
              setIsEditing={setIsEditing}
              handleSave={handleSave}
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
          
          <TabsContent value="contact-lenses">
            <ClientContactLensTab />
          </TabsContent>
          
          <TabsContent value="referrals">
            <ClientReferralTab />
          </TabsContent>
          
          <TabsContent value="appointments">
            <ClientAppointmentsTab />
          </TabsContent>
          
          <TabsContent value="files">
            <ClientFilesTab />
          </TabsContent>
          
          <TabsContent value="billing">
            <ClientBillingTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
} 