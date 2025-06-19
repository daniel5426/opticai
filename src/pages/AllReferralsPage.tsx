import React, { useState, useEffect } from "react"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { getAllReferrals } from "@/lib/db/referral-db"
import { getAllClients } from "@/lib/db/clients-db"
import { Referral, Client } from "@/lib/db/schema"
import { ReferralTable } from "@/components/referral-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useNavigate } from "@tanstack/react-router"

export default function AllReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadData = async () => {
    try {
      setLoading(true)
      const [referralsData, clientsData] = await Promise.all([
        getAllReferrals(),
        getAllClients()
      ])
      setReferrals(referralsData)
      setClients(clientsData)
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
      to: "/referrals/create",
      search: { clientId: String(clientId) }
    })
  }

  if (loading) {
    return (
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="הפניות" />
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-lg">טוען הפניות...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset className="overflow-auto" style={{scrollbarWidth: 'none'}}>
        <SiteHeader title="הפניות" />
        <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">כל ההפניות</h1>
          </div>
          <ReferralTable 
            referrals={referrals} 
            onRefresh={loadData} 
            clientId={0} 
          />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 