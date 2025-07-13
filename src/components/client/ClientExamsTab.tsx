import React from "react"
import { ExamsTable } from "@/components/exams-table"
import { useParams } from "@tanstack/react-router"
import { useClientData } from "@/contexts/ClientDataContext"

export function ClientExamsTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const { exams, loading, removeExam, refreshExams } = useClientData()

  const handleExamDeleted = (deletedExamId: number) => {
    removeExam(deletedExamId)
  }

  const handleExamDeleteFailed = () => {
    refreshExams()
  }

  return (
    <ExamsTable 
      data={exams} 
      clientId={Number(clientId)} 
      onExamDeleted={handleExamDeleted} 
      onExamDeleteFailed={handleExamDeleteFailed}
      loading={loading.exams}
    />
  )
} 