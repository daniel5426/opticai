import React from "react"
import { useTranslation } from "react-i18next"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { ClientsTable } from "@/components/clients-table"
import { getAllClients } from "@/lib/db/clients-db"

export default function ClientsPage() {
  const { t } = useTranslation()
  const clients = getAllClients()

  return (  
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset>
        <SiteHeader title="לקוחות" />
        <div className="flex flex-col flex-1">
          <div className="@container/main flex flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
              <div className="px-4 lg:px-6">
                <ClientsTable data={clients} />
              </div>
              <div className="h-12"></div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 