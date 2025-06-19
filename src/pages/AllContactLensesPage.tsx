import React, { useState, useEffect } from "react"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { getAllContactLenses } from "@/lib/db/contact-lens-db"
import { ContactLens } from "@/lib/db/schema"
import { ContactLensTable } from "@/components/contact-lens-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useNavigate } from "@tanstack/react-router"

export default function AllContactLensesPage() {
  const [contactLenses, setContactLenses] = useState<ContactLens[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadData = async () => {
    try {
      setLoading(true)
      const contactLensesData = await getAllContactLenses()
      setContactLenses(contactLensesData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleClientSelect = (clientId: number) => {
    navigate({
      to: "/clients/$clientId/contact-lenses/new",
      params: { clientId: String(clientId) }
    })
  }

  const handleContactLensDeleted = () => {
    loadData()
  }

  if (loading) {
    return (
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="עדשות מגע" />
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-lg">טוען עדשות מגע...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset className="overflow-auto" style={{scrollbarWidth: 'none'}}>
        <SiteHeader title="עדשות מגע" />
        <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">כל עדשות המגע</h1>
          </div>
          <ContactLensTable 
            data={contactLenses} 
            clientId={0} 
            onContactLensDeleted={handleContactLensDeleted}
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 