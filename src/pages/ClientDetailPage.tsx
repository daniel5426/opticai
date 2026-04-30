import React, { useState, useRef, useEffect } from "react"
import { useParams, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
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
import { ClientDataProvider } from "@/contexts/ClientDataContext"
import { ClientSpaceLayout } from "@/layouts/ClientSpaceLayout"
import { useClientSidebar } from "@/contexts/ClientSidebarContext"
import { useClientDetailsEditor } from "@/hooks/client/useClientDetailsEditor"

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
  const editor = useClientDetailsEditor(clientIdNum)
  const [activeTab, setActiveTab] = useState(initialTab)
  const [refreshKey, setRefreshKey] = useState(0)
  const formRef = useRef<HTMLFormElement>(null)
  const isDetailsLoading = editor.isLoading || !editor.draftClient

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

  useEffect(() => {
    if (editor.serverClient) updateCurrentClient(editor.serverClient)
  }, [editor.serverClient, updateCurrentClient])

  const handleSave = async () => {
    const updated = await editor.saveDraft()
    if (updated) {
      updateCurrentClient(updated)
      toast.success("פרטי הלקוח עודכנו בהצלחה")
    } else {
      toast.error("לא הצלחנו לשמור את השינויים")
    }
  }




  return (
    <ClientDataProvider clientId={clientIdNum}>
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
              {editor.isError ? (
                <div className="bg-card rounded-lg examcard p-6 text-right" dir="rtl">
                  לא הצלחנו לטעון את פרטי הלקוח
                </div>
              ) : (
                <ClientDetailsTab
                  draft={editor.draftClient || {} as Client}
                  isEditing={editor.isEditing}
                  isLoading={isDetailsLoading}
                  isSaving={editor.isSaving}
                  onFieldChange={editor.updateDraftField}
                  formRef={formRef as React.RefObject<HTMLFormElement>}
                  onStartEdit={editor.startEdit}
                  onCancelEdit={editor.cancelEdit}
                  onSave={handleSave}
                />
              )}
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
