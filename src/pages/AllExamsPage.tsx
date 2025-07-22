import React, { useState, useEffect, useCallback } from "react"
import { SiteHeader } from "@/components/site-header"
import { getAllExams } from "@/lib/db/exams-db"
import { OpticalExam } from "@/lib/db/schema"
import { ExamsTable } from "@/components/exams-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useNavigate } from "@tanstack/react-router"
import { getUserById } from "@/lib/db/users-db"
import { getClientById } from "@/lib/db/clients-db"

export default function AllExamsPage() {
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const examsData = await getAllExams('exam')
      const enriched = await Promise.all(
        examsData.map(async (exam) => {
          let username = ''
          let clientName = ''
          if (exam.user_id) {
            const user = await getUserById(exam.user_id)
            username = user?.username || ''
          }
          if (exam.client_id) {
            const client = await getClientById(exam.client_id)
            clientName = client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : ''
          }
          return { ...exam, username, clientName }
        })
      )
      setExams(enriched)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleExamDeleted = (deletedExamId: number) => {
    setExams(prevExams => prevExams.filter(exam => exam.id !== deletedExamId))
  }

  const handleExamDeleteFailed = () => {
    loadData()
  } 

  const handleClientSelect = (clientId: number) => {
    navigate({
      to: "/clients/$clientId/exams/new",
      params: { clientId: String(clientId) }
    })
  }

  return (
    <>
      <SiteHeader title="בדיקות" />
      <div className="flex flex-col flex-1 p-4 lg:p-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">כל הבדיקות</h1>
        </div>
        <ExamsTable data={exams} clientId={0} onExamDeleted={handleExamDeleted} onExamDeleteFailed={handleExamDeleteFailed} loading={loading} />
      </div>
    </>
  )
} 