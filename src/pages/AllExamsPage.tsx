import React, { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedEnrichedExams } from "@/lib/db/exams-db"
import { OpticalExam } from "@/lib/db/schema-interface"
import { ExamsTable } from "@/components/exams-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useUser } from "@/contexts/UserContext"
import { Button } from "@/components/ui/button"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { buildTableSearch } from "@/lib/list-page-search"

export default function AllExamsPage() {
  const { currentClinic } = useUser()
  const search = useSearch({ from: "/exams" })
  const navigate = useNavigate()
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState(0)
  const [searchInput, setSearchInput] = useState(search.q)

  useEffect(() => {
    setSearchInput(search.q)
  }, [search.q])

  const buildSearchState = useCallback((overrides?: Partial<{ q: string; page: number; testName: string }>) => {
    return buildTableSearch(
      {
        q: searchInput.trim(),
        page: search.page,
        testName: search.testName,
        ...overrides,
      },
      {
        q: "",
        page: 1,
        testName: ALL_FILTER_VALUE,
      },
    )
  }, [search.page, search.testName, searchInput])

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput === search.q) return
      navigate({
        to: "/exams",
        search: buildSearchState({ q: searchInput.trim(), page: 1 }),
      })
    }, 400)
    return () => clearTimeout(t)
  }, [buildSearchState, navigate, search.q, searchInput])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const offset = (search.page - 1) * pageSize
      const { items, total } = await getPaginatedEnrichedExams('exam', currentClinic?.id, {
        limit: pageSize,
        offset,
        order: 'exam_date_desc',
        q: search.q || undefined,
        testName: search.testName !== ALL_FILTER_VALUE ? search.testName : undefined,
      })
      setExams(items)
      setTotal(total)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentClinic, pageSize, search.page, search.q, search.testName])

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
      if (updated.length === 0 && search.page > 1) {
        navigate({
          to: "/exams",
          search: buildSearchState({ page: Math.max(1, search.page - 1) }),
        })
      }
      return updated
    })
  }

  const handleExamDeleteFailed = () => {
    loadData()
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
          searchQuery={searchInput}
          onSearchChange={setSearchInput}
          testNameFilter={search.testName}
          onTestNameFilterChange={(value) =>
            navigate({
              to: "/exams",
              search: buildSearchState({ testName: value, page: 1 }),
            })
          }
          loading={loading} 
          pagination={{
            page: search.page,
            pageSize,
            total,
            setPage: (page) =>
              navigate({
                to: "/exams",
                search: buildSearchState({ page }),
              }),
          }}
        />
      </div>
    </>
  )
} 
