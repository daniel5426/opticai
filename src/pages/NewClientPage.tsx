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
  const formDataRef = useRef<Client>(formData)
  const formRef = useRef<HTMLFormElement>(null!);

  const updateFormData = (updater: (prev: Client) => Client) => {
    const next = updater(formDataRef.current)
    formDataRef.current = next
    setFormData(next)
  }

  const handleFieldChange = (name: string, value: string | boolean | number | null) => {
    updateFormData((prev: Client) => ({
      ...prev,
      [name]: value,
      ...(name === 'health_fund' ? { status: '' } : {})
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const latestFormData = formDataRef.current
    if (!latestFormData.first_name?.trim()) { toast.error("שם פרטי הוא שדה חובה"); return }
    if (!latestFormData.last_name?.trim()) { toast.error("שם משפחה הוא שדה חובה"); return }
    const clientData = {
      ...latestFormData,
      clinic_id: currentClinic?.id,
      file_creation_date: new Date().toISOString().split('T')[0]
    }
    ;(async () => {
      try {
        const newClient = await createClient(clientData)
        if (newClient) {
          toast.success("לקוח נוצר בהצלחה")
          navigate({ to: "/clients/$clientId", params: { clientId: String(newClient.id) }, search: { tab: "details" } })
        } else {
          toast.error("שגיאה ביצירת לקוח חדש")
        }
      } catch {
        toast.error("שגיאה ביצירת לקוח חדש")
      }
    })()
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
            draft={formData}
            isEditing={false}
            mode="new"
            onFieldChange={handleFieldChange}
            formRef={formRef}
          />
        </div>
      </div>
    </>
  )
} 
