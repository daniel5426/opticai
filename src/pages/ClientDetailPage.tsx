import React, { useState, useRef, useEffect, useCallback } from "react"
import { useParams, useSearch } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { SiteHeader } from "@/components/site-header"
import { Button } from "@/components/ui/button"
import { Client } from "@/lib/db/schema-interface"
import { Tabs, TabsContent } from "@/components/ui/tabs"
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
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout"
import { useClientSidebar } from "@/contexts/ClientSidebarContext"
import { useUser } from "@/contexts/UserContext"
import { useClientDetailsEditor } from "@/hooks/client/useClientDetailsEditor"
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog"
import { useUnsavedChanges } from "@/hooks/shared/useUnsavedChanges"
import { serializeClientDraftForUnsavedChanges } from "@/lib/client-details-editor"
import { ClientTabName, prefetchClientTab } from "@/hooks/client/useClientTabQueries"
import { apiClient } from "@/lib/api-client"

export default function ClientDetailPage() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const clientIdNum = Number(clientId)

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

  const { updateCurrentClient, setActiveTab: setSidebarActiveTab } = useClientSidebar()
  const { currentClinic } = useUser()
  const queryClient = useQueryClient()
  const editor = useClientDetailsEditor(clientIdNum)
  const [activeTab, setActiveTab] = useState(initialTab)
  const formRef = useRef<HTMLFormElement>(null)
  const isDetailsLoading = editor.isLoading
  const hasDetailsError = editor.isError || (!editor.isLoading && !editor.draftClient)

  const getSerializedState = useCallback(
    () => serializeClientDraftForUnsavedChanges(editor.draftClient),
    [editor.draftClient],
  )

  const {
    showUnsavedDialog,
    handleNavigationAttempt,
    handleUnsavedConfirm,
    handleUnsavedCancel,
    setBaseline,
    baselineInitializedRef,
  } = useUnsavedChanges({
    getSerializedState,
    isEditing: editor.isEditing,
    isNewMode: false,
  })

  useEffect(() => {
    // Save current tab to localStorage for this client
    if (clientId && activeTab) {
      localStorage.setItem(`client-${clientId}-last-tab`, activeTab)
    }

    // Update the sidebar context with the active tab
    setSidebarActiveTab(activeTab)
  }, [activeTab, clientId, setSidebarActiveTab])

  useEffect(() => {
    prefetchClientTab(
      queryClient,
      clientIdNum,
      activeTab as ClientTabName,
      currentClinic?.id,
    )
  }, [activeTab, clientIdNum, currentClinic?.id, queryClient])

  useEffect(() => {
    if (editor.serverClient) updateCurrentClient(editor.serverClient)
  }, [editor.serverClient, updateCurrentClient])

  useEffect(() => {
    if (!clientIdNum || Number.isNaN(clientIdNum)) return
    apiClient.markClientVisited(clientIdNum).catch((error) => {
      console.error("Error marking recent client visit:", error)
    })
  }, [clientIdNum])

  useEffect(() => {
    if (!editor.isEditing) {
      baselineInitializedRef.current = false
      return
    }
    if (isDetailsLoading || baselineInitializedRef.current) return

    const timer = setTimeout(() => {
      setBaseline()
    }, 0)
    return () => clearTimeout(timer)
  }, [baselineInitializedRef, editor.isEditing, isDetailsLoading, setBaseline])

  const handleSave = async () => {
    const updated = await editor.saveDraft()
    if (updated) {
      updateCurrentClient(updated)
      toast.success("פרטי הלקוח עודכנו בהצלחה")
    } else {
      toast.error("לא הצלחנו לשמור את השינויים")
    }
  }

  const handleStartEdit = () => {
    editor.startEdit()
    baselineInitializedRef.current = false
  }

  const handleTabChange = (value: string) => {
    if (value === activeTab) return
    handleNavigationAttempt(() => {
      if (activeTab === "details" && value !== "details" && editor.isEditing) {
        editor.cancelEdit()
      }
      setActiveTab(value)
    })
  }

  return (
    <>
      <SiteHeader
        title="לקוחות"
        backLink="/clients"
        tabs={{
          activeTab,
          onTabChange: handleTabChange
        }}
      />
      <ClientSpaceLayout>
        <div className="flex h-full min-h-0 flex-1 flex-col p-2 lg:p-5" dir="rtl" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <Tabs
            value={activeTab}
            className="w-full min-h-0 flex-1"
            onValueChange={handleTabChange}
          >
            <TabsContent value="details" className="min-h-0 overflow-y-auto">
              {hasDetailsError ? (
                <div className="bg-card examcard rounded-lg p-6 text-start" dir="rtl">
                  <p>לא הצלחנו לטעון את פרטי הלקוח</p>
                  <Button
                    className="mt-4"
                    variant="outline"
                    onClick={() => void editor.refetchClient()}
                  >
                    נסה שוב
                  </Button>
                </div>
              ) : (
                <ClientDetailsTab
                  draft={editor.draftClient || {} as Client}
                  isEditing={editor.isEditing}
                  isLoading={isDetailsLoading}
                  isSaving={editor.isSaving}
                  onFieldChange={editor.updateDraftField}
                  formRef={formRef as React.RefObject<HTMLFormElement>}
                  onStartEdit={handleStartEdit}
                  onCancelEdit={editor.cancelEdit}
                  onSave={handleSave}
                />
              )}
            </TabsContent>

            <TabsContent value="exams" className="flex min-h-0 flex-1 flex-col">
              <ClientExamsTab enabled={activeTab === "exams"} />
            </TabsContent>

            <TabsContent value="medical" className="min-h-0 overflow-y-auto">
              <ClientMedicalRecordTab enabled={activeTab === "medical"} />
            </TabsContent>

            <TabsContent value="orders" className="flex min-h-0 flex-1 flex-col">
              <ClientOrdersTab enabled={activeTab === "orders"} />
            </TabsContent>


            <TabsContent value="referrals" className="flex min-h-0 flex-1 flex-col">
              <ClientReferralTab enabled={activeTab === "referrals"} />
            </TabsContent>

            <TabsContent value="appointments" className="flex min-h-0 flex-1 flex-col">
              <ClientAppointmentsTab enabled={activeTab === "appointments"} />
            </TabsContent>

            <TabsContent value="files" className="flex min-h-0 flex-1 flex-col">
              <ClientFilesTab enabled={activeTab === "files"} />
            </TabsContent>

          </Tabs>
        </div>
      </ClientSpaceLayout>
      <UnsavedChangesDialog
        open={showUnsavedDialog}
        onConfirm={handleUnsavedConfirm}
        onCancel={handleUnsavedCancel}
      />
    </>
  )
} 
