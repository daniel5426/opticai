import { affectsFamily } from "@/lib/record-changes";
import { TableExportProvider } from "@/components/table-export/context";
import { CompanyClinicToolbarProvider } from "@/components/CompanyClinicFilter"
import { useCompanyClinicFilter } from "@/hooks/client/useCompanyClinicFilter"
import React, { useState, useEffect, useCallback } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { TableListPageContent } from "@/components/table-list-layout"
import { useTranslation } from "react-i18next"
import { SiteHeader } from "@/components/site-header"
import { getPaginatedEnrichedExams } from "@/lib/db/exams-db"
import { OpticalExam } from "@/lib/db/schema-interface"
import { ExamsTable } from "@/components/exams-table"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { useUser } from "@/contexts/UserContext"
import { Button } from "@/components/ui/button"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { TABLE_SEARCH_DEBOUNCE_MS, buildTableSearch, useLatestTableSearchRequest } from "@/lib/list-page-search"
import { parseSortSearch, sortToOrder, sortToSearch } from "@/lib/table-sorting"
import { parseColumnFilters, serializeColumnFilters } from "@/lib/column-filters"
import { deferPaginationTotal } from "@/lib/deferred-pagination"

export default function AllExamsPage() {
  const { t } = useTranslation()
  const { currentClinic } = useUser()
  const clinicFilter = useCompanyClinicFilter()
  const search = useSearch({ from: "/exams" })
  const navigate = useNavigate()
  const [exams, setExams] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pageSize] = useState(25)
  const [total, setTotal] = useState<number | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [searchInput, setSearchInput] = useState(search.q)
  const { startSearchRequest, updateLatestSearch } = useLatestTableSearchRequest(searchInput)
  const activeSort = React.useMemo(
    () => parseSortSearch(search.sort, { key: "exam_date", direction: "desc" }),
    [search.sort]
  )
  const columnFilters = React.useMemo(() => parseColumnFilters(search.filters), [search.filters])

  useEffect(() => {
    updateLatestSearch(search.q)
    setSearchInput((current) => (current.trim() === search.q ? current : search.q))
  }, [search.q, updateLatestSearch])

  const handleSearchInputChange = (value: string) => {
    updateLatestSearch(value)
    setSearchInput(value)
  }

  const buildSearchState = useCallback(
    (
      overrides?: Partial<{
        q: string
        page: number
        testName: string
        sort: string
        filters: string
      }>
    ) => {
      return buildTableSearch(
        {
          q: searchInput.trim(),
          page: search.page,
          testName: search.testName,
          sort: search.sort,
          filters: search.filters,
          ...overrides
        },
        {
          q: "",
          page: 1,
          testName: ALL_FILTER_VALUE,
          sort: "",
          filters: ""
        }
      )
    },
    [search.filters, search.page, search.sort, search.testName, searchInput]
  )

  useEffect(() => {
    const t = setTimeout(() => {
      if (searchInput.trim() === search.q) return
      navigate({
        to: "/exams",
        search: buildSearchState({ q: searchInput.trim(), page: 1 })
      })
    }, TABLE_SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [buildSearchState, navigate, search.q, searchInput])

  const loadData = useCallback(async (background = false) => {
    const canCommit = startSearchRequest(search.q)
    try {
      if (!background) setLoading(true)
      setTotal(null)
      const offset = (search.page - 1) * pageSize
      const paginationOptions = {
        limit: pageSize,
        offset,
        order: sortToOrder(activeSort, "exam_date_desc"),
        q: search.q || undefined,
        testName: search.testName !== ALL_FILTER_VALUE ? search.testName : undefined,
        columnFilters: search.filters || undefined,
        includeTotal: false
      }
      const { items, hasMore: nextHasMore } = await getPaginatedEnrichedExams("exam", clinicFilter.clinicId, paginationOptions)
      if (!canCommit()) return
      setExams(items)
      setHasMore(nextHasMore)
      deferPaginationTotal(
        () => getPaginatedEnrichedExams("exam", clinicFilter.clinicId, { ...paginationOptions, countOnly: true }),
        canCommit,
        setTotal
      )
    } catch (error) {
      console.error("Error loading data:", error)
    } finally {
      if (canCommit()) {
        setLoading(false)
      }
    }
  }, [activeSort, clinicFilter.clinicId, currentClinic, pageSize, search.page, search.q, search.testName, search.filters, startSearchRequest])

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [loadData, currentClinic])

  const handleExamDeleted = (deletedExamId: number) => {
    setExams((prevExams) => {
      const updated = prevExams.filter((exam) => exam.id !== deletedExamId)
      const newTotal = total === null ? null : Math.max(0, total - 1)
      setTotal(newTotal)
      if (updated.length === 0 && search.page > 1) {
        navigate({
          to: "/exams",
          search: buildSearchState({ page: Math.max(1, search.page - 1) })
        })
      }
      return updated
    })
  }

  const handleExamDeleteFailed = () => {
    loadData()
  }

  useEffect(() => {
    const refresh = (event: Event) => { if (affectsFamily(event, "exams")) void loadData(true) }
    window.addEventListener("prysm:client-records-changed", refresh)
    return () => window.removeEventListener("prysm:client-records-changed", refresh)
  }, [loadData])

  return (
    <TableExportProvider value={{ table: "exams", clinicId: clinicFilter.clinicId, sort: sortToOrder(activeSort, "exam_date_desc") }}>
    <CompanyClinicToolbarProvider filter={{ ...clinicFilter, setValue: value => { clinicFilter.setValue(value); void navigate({ to: "/exams", search: buildSearchState({ page: 1 }) }) } }}>
      <SiteHeader title={t("exams")} />
      <TableListPageContent>
        <ExamsTable
          data={exams}
          clientId={0}
          onExamDeleted={handleExamDeleted}
          onExamDeleteFailed={handleExamDeleteFailed}
          searchQuery={searchInput}
          onSearchChange={handleSearchInputChange}
          serverFiltered={true}
          testNameFilter={search.testName}
          onTestNameFilterChange={(value) =>
            navigate({
              to: "/exams",
              search: buildSearchState({ testName: value, page: 1 })
            })
          }
          columnFilters={columnFilters}
          onColumnFiltersChange={(filters) =>
            navigate({
              to: "/exams",
              search: buildSearchState({ filters: serializeColumnFilters(filters), page: 1 }),
            })
          }
          sort={activeSort}
          onSortChange={(sort) =>
            navigate({
              to: "/exams",
              search: buildSearchState({ sort: sortToSearch(sort), page: 1 })
            })
          }
          loading={loading}
          fillHeight
          pagination={{
            page: search.page,
            pageSize,
            total,
            hasMore,
            setPage: (page) =>
              navigate({
                to: "/exams",
                search: buildSearchState({ page })
              })
          }}
        />
      </TableListPageContent>
    </CompanyClinicToolbarProvider>
    </TableExportProvider>
  )
}
