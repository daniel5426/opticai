import React, { useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema"
import { toast } from "sonner"
import { ClientDetailsTab } from "@/components/client"

export default function NewClientPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState<Client>({
    gender: "זכר",
    blocked_checks: false,
    blocked_credit: false,
    discount_percent: 0
  } as Client)
  const formRef = useRef<HTMLFormElement>(null!);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string | boolean, name: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      // Add file creation date
      const clientData = {
        ...formData,
        file_creation_date: new Date().toISOString().split('T')[0]
      }
      const newClient = await createClient(clientData)
      if (newClient) {
        toast.success("לקוח נוצר בהצלחה")
        navigate({ to: "/clients/$clientId", params: { clientId: String(newClient.id) } })
      } else {
        toast.error("שגיאה ביצירת לקוח חדש")
      }
    } catch (error) {
      toast.error("שגיאה ביצירת לקוח חדש")
    }
  }

  const handleCancel = () => {
    navigate({ to: "/clients" })
  }

  return (
    <SidebarProvider dir="rtl" className="h-full">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset>
        <SiteHeader 
          title="לקוח חדש" 
          backLink="/clients"
        />
        <div 
          className="container mx-auto p-6 max-w-7xl pb-30 overflow-y-auto" 
          style={{
            scrollbarWidth: 'none'
          }}
        >
          
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold" dir="rtl">יצירת לקוח חדש</h1>
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleCancel}>
                ביטול
              </Button>
              <Button 
                onClick={handleSubmit}
                type="submit"
              >
                שמירה
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-4" dir="ltr">
            <ClientDetailsTab
              client={{} as Client}
              formData={formData}
              isEditing={false}
              mode="new"
              handleInputChange={handleInputChange}
            handleSelectChange={handleSelectChange}
              formRef={formRef}
            />
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 