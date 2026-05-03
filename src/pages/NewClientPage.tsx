import React, { useCallback, useEffect, useRef, useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/db/clients-db"
import { Client } from "@/lib/db/schema-interface"
import { toast } from "sonner"
import { ClientDetailsTab } from "@/components/client"
import { useUser } from "@/contexts/UserContext"
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog"
import { useUnsavedChanges } from "@/hooks/shared/useUnsavedChanges"
import { serializeClientDraftForUnsavedChanges } from "@/lib/client-details-editor"

export default function NewClientPage() {
  const navigate = useNavigate()
  const { currentClinic } = useUser()
  const [formData, setFormData] = useState<Client>({
    gender: "זכר",
    blocked_checks: false,
    blocked_credit: false,
    discount_percent: 0,
    file_creation_date: new Date().toISOString().split('T')[0]
  } as Client)
  const [isSaving, setIsSaving] = useState(false)
  const isSavingRef = useRef(false)
  const formDataRef = useRef<Client>(formData)
  const formRef = useRef<HTMLFormElement>(null!);

  const getSerializedState = useCallback(
    () => serializeClientDraftForUnsavedChanges(formData),
    [formData],
  )

  const {
    showUnsavedDialog,
    handleNavigationAttempt,
    handleUnsavedConfirm,
    handleUnsavedCancel,
    setBaseline,
    baselineInitializedRef,
    allowNavigationRef,
  } = useUnsavedChanges({
    getSerializedState,
    isEditing: false,
    isNewMode: true,
  })

  useEffect(() => {
    if (baselineInitializedRef.current) return
    const timer = setTimeout(() => {
      setBaseline()
    }, 0)
    return () => clearTimeout(timer)
  }, [baselineInitializedRef, setBaseline])

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

  const handleSubmit = async () => {
    if (isSavingRef.current) return

    const latestFormData = formDataRef.current
    if (!latestFormData.first_name?.trim()) { toast.error("שם פרטי הוא שדה חובה"); return }
    if (!latestFormData.last_name?.trim()) { toast.error("שם משפחה הוא שדה חובה"); return }

    isSavingRef.current = true
    setIsSaving(true)
    const clientData = {
      ...latestFormData,
      clinic_id: currentClinic?.id,
      file_creation_date: new Date().toISOString().split('T')[0]
    }

    let shouldResetSaving = true
    try {
      const newClient = await createClient(clientData)
      if (newClient) {
        shouldResetSaving = false
        toast.success("לקוח נוצר בהצלחה")
        allowNavigationRef.current = true
        navigate({ to: "/clients/$clientId", params: { clientId: String(newClient.id) }, search: { tab: "details" } })
        setTimeout(() => {
          allowNavigationRef.current = false
        }, 0)
      } else {
        toast.error("שגיאה ביצירת לקוח חדש")
      }
    } catch {
      toast.error("שגיאה ביצירת לקוח חדש")
    } finally {
      if (shouldResetSaving) {
        isSavingRef.current = false
        setIsSaving(false)
      }
    }
  }

  const handleCancel = () => {
    handleNavigationAttempt(() => {
      navigate({ to: "/clients" })
    })
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
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "שומר..." : "שמירה"}
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
            isSaving={isSaving}
          />
        </div>
      </div>
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onConfirm={handleUnsavedConfirm}
        onCancel={handleUnsavedCancel}
      />
    </>
  )
}
