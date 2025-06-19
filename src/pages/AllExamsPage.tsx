import React, { useState, useEffect } from "react"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { getAllExams } from "@/lib/db/exams-db"
import { OpticalExam } from "@/lib/db/schema"
import { ExamsTable } from "@/components/exams-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useNavigate } from "@tanstack/react-router"

export default function AllExamsPage() {
  const [exams, setExams] = useState<OpticalExam[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true)
        const examsData = await getAllExams()
        setExams(examsData)
      } catch (error) {
        console.error('Error loading data:', error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const handleClientSelect = (clientId: number) => {
    navigate({
      to: "/clients/$clientId/exams/new",
      params: { clientId: String(clientId) }
    })
  }

  if (loading) {
    return (
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="בדיקות" />
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-lg">טוען בדיקות...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset className="overflow-auto" style={{scrollbarWidth: 'none'}}>
        <SiteHeader title="בדיקות" />
        <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold">כל הבדיקות</h1>
          </div>
          <ExamsTable data={exams} clientId={0} />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
} 