import React, { useState, useEffect, useCallback } from "react"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedEnrichedExams } from "@/lib/db/exams-db"
import { OpticalExam } from "@/lib/db/schema-interface"
import { ExamsTable } from "@/components/exams-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useNavigate } from "@tanstack/react-router"
import { useUser } from "@/contexts/UserContext"
import { Button } from "@/components/ui/button"

export default function AllExamsPage() {
  const { currentClinic } = useUser()
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedSearch, setDebouncedSearch] = useState("")

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchQuery), 400)
    return () => clearTimeout(t)
  }, [searchQuery])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (page - 1) * pageSize
      const { items, total } = await getPaginatedEnrichedExams('exam', currentClinic?.id, { limit: pageSize, offset, order: 'exam_date_desc', search: debouncedSearch || undefined })
      setExams(items)
      setTotal(total)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentClinic, page, pageSize, debouncedSearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [loadData, currentClinic])

  const handleExamDeleted = (deletedExamId: number) => {
    setExams(prevExams => {
      const updated = prevExams.filter(exam => exam.id !== deletedExamId)
      const newTotal = Math.max(0, total - 1)
      setTotal(newTotal)
      if (updated.length === 0 && page > 1) {
        setPage(p => Math.max(1, p - 1))
      }
      return updated
    })
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
        <ExamsTable 
          data={exams} 
          clientId={0} 
          onExamDeleted={handleExamDeleted} 
          onExamDeleteFailed={handleExamDeleteFailed} 
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          loading={loading} 
          pagination={{ page, pageSize, total, setPage }}
        />
      </div>
    </>
  )
} 