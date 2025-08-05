import React, { useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema-interface"
import { toast } from "sonner"
import { ClientDetailsTab } from "@/components/client"
import { useUser } from "@/contexts/UserContext"

export default function NewClientPage() {
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const [formData, setFormData] = useState<Client>({
    gender: "זכר",
    blocked_checks: false,
    blocked_credit: false,
    discount_percent: 0
  } as Client)
  const formRef = useRef<HTMLFormElement>(null!);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData((prev: Client) => ({ ...prev, [name]: value }))
  }

  const handleSelectChange = (value: string | boolean, name: string) => {
    setFormData((prev: Client) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate required fields
    if (!formData.first_name?.trim()) {
      toast.error("שם פרטי הוא שדה חובה")
      return
    }
    
    if (!formData.last_name?.trim()) {
      toast.error("שם משפחה הוא שדה חובה")
      return
    }
    
    try {
      // Add file creation date and clinic_id
      const clientData = {
        ...formData,
        clinic_id: currentClinic?.id,
        file_creation_date: new Date().toISOString().split('T')[0]
      }
      const newClient = await createClient(clientData)
      if (newClient) {
        toast.success("לקוח נוצר בהצלחה")
        navigate({ to: "/clients/$clientId", params: { clientId: String(newClient.id) }, search: { tab: "details" } })
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
    <>
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
          <div dir="rtl">
            <h1 className="text-2xl font-bold">יצירת לקוח חדש</h1>
            <p className="text-sm text-muted-foreground mt-1">
              שדות המסומנים ב<span className="text-red-500">*</span> הם חובה
            </p>
          </div>
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
    </>
  )
} 