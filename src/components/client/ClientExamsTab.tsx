import React, { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { ExamsTable } from "@/components/exams-table"
import { getExamsByClientId } from "@/lib/db/exams-db"
import { useParams } from "@tanstack/react-router"
import { OpticalExam } from "@/lib/db/schema"

export function ClientExamsTab() {
  const { clientId } = useParams({ from: "/clients/$clientId" })
  const [exams, setExams] = useState<OpticalExam[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadExams = async () => {
      try {
        setLoading(true)
        const examsData = await getExamsByClientId(Number(clientId))
        setExams(examsData)
      } catch (error) {
        console.error('Error loading exams:', error)
      } finally {
        setLoading(false)
      }
    }

    loadExams()
  }, [clientId])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-32">
        <div className="text-lg">טוען בדיקות...</div>
      </div>
    )
  }

  return (
    <ExamsTable data={exams} clientId={Number(clientId)} />
  )
} 