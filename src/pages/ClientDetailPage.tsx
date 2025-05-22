import React, { useState, useRef, useEffect } from "react"
import { useParams } from "@tanstack/react-router"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
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
  ClientMedicalRecordTab
} from "@/components/client"

export default function ClientDetailPage() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [client, setClient] = useState<Client | undefined>(getClientById(Number(clientId)))
  const [isEditing, setIsEditing] = useState(false)
  const [formData, setFormData] = useState<Client>({} as Client)
  const [activeTab, setActiveTab] = useState("details")
  const formRef = useRef<HTMLFormElement>(null)
  
  useEffect(() => {
    if (client) {
      setFormData({ ...client })
    }
  }, [client])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string | boolean, name: string) => {
    setFormData(prev => ({ ...prev, [name]: value }))
  }
  
  const handleSave = () => {
    if (formRef.current) {
      // Update client data in the database
      const updatedClient = updateClient(formData)
      
      if (updatedClient) {
        setClient(updatedClient)
        setIsEditing(false)
        toast.success("פרטי הלקוח עודכנו בהצלחה")
      } else {
        toast.error("לא הצלחנו לשמור את השינויים")
      }
    }
  }
  
  if (!client) {
    return (
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="לקוחות" backLink="/clients" />
          <div className="flex flex-col items-center justify-center h-full">
            <h1 className="text-2xl">לקוח לא נמצא</h1>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  const fullName = `${client.first_name} ${client.last_name}`.trim()
  
  return (
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset>
        <SiteHeader 
          title="לקוחות" 
          backLink="/clients"
          clientName={fullName}
        />
        <div className="flex flex-col flex-1 p-4 lg:p-6 mb-40" dir="rtl">
          <Tabs 
            defaultValue="details" 
            className="w-full"
            onValueChange={(value) => setActiveTab(value)}
          >
            <div className="flex justify-between items-center mb-4">
              <TabsList>
                <TabsTrigger value="details">פרטים אישיים</TabsTrigger>
                <TabsTrigger value="exams">בדיקות</TabsTrigger>
                <TabsTrigger value="medical">רשומות רפואיות</TabsTrigger>
                <TabsTrigger value="orders">הזמנות</TabsTrigger>
                <TabsTrigger value="billing">חשבונות</TabsTrigger>
              </TabsList>
              
              {activeTab === "details" ? (
                <Button 
                  variant={isEditing ? "outline" : "default"} 
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                >
                  {isEditing ? "שמור שינויים" : "ערוך פרטים"}
                </Button>
              ) : activeTab === "exams" ? (
                <h2 className="text-xl font-semibold">בדיקות ראייה</h2>
              ) : null}
            </div>
            
            <TabsContent value="details">
              <ClientDetailsTab 
                client={client}
                formData={formData}
                isEditing={isEditing}
                handleInputChange={handleInputChange}
                handleSelectChange={handleSelectChange}
                formRef={formRef as React.RefObject<HTMLFormElement>}
              />
            </TabsContent>
            
            <TabsContent value="exams">
              <ClientExamsTab />
            </TabsContent>
            
            <TabsContent value="medical">
              <ClientMedicalRecordTab />
            </TabsContent>
            
            <TabsContent value="orders">
              <ClientOrdersTab />
            </TabsContent>
            
            <TabsContent value="billing">
              <ClientBillingTab />
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 