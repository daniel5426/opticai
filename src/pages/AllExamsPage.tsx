import React, { useState, useEffect, useCallback } from "react"
import { SiteHeader } from "@/components/site-header"
import { getAllEnrichedExams } from "@/lib/db/exams-db"
import { OpticalExam } from "@/lib/db/schema-interface"
import { ExamsTable } from "@/components/exams-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useNavigate } from "@tanstack/react-router"
import { useUser } from "@/contexts/UserContext"

export default function AllExamsPage() {
  const { currentClinic } = useUser()
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const examsData = await getAllEnrichedExams('exam', currentClinic?.id)
      setExams(examsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentClinic])

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [loadData, currentClinic])

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