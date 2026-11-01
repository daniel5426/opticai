import React, { useState, useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { TableCell, TableHead, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Trash2 } from "lucide-react"
import { OpticalExam, ExamLayout } from "@/lib/db/schema-interface"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { CustomModal } from "@/components/ui/custom-modal"
import { deleteExam } from "@/lib/db/exams-db"
import { getAllExamLayouts } from "@/lib/db/exam-layouts-db"
import { toast } from "sonner"
import { DateSearchHelper } from "@/lib/date-search-helper"
import { useUser } from "@/contexts/UserContext"
import { Eye } from "lucide-react"
import { ExamPreviewModal } from "@/components/exam/ExamPreviewModal"
import { TableListLayout } from "@/components/table-list-layout"
import { useAppLocale } from "@/localization/use-app-locale"
import { ALL_FILTER_VALUE } from "@/lib/table-filters"
import { SortableTableHead } from "@/components/sortable-table-head"
import { ColumnFiltersProvider, useColumnFilterState } from "@/components/column-filter"
import { matchesColumnFilters, type ColumnFilterDefinition, type ColumnFilters } from "@/lib/column-filters"
import { SortColumns, SortState, sortRows } from "@/lib/table-sorting"
import { useTranslation } from "react-i18next"

interface ExamWithNames extends OpticalExam {
  username?: string
  clientName?: string
  clinic?: string
  full_name?: string
}

interface ExamsTableProps {
  data: ExamWithNames[]
  clientId: number
  onExamDeleted: (examId: number) => void
  onExamDeleteFailed: () => void
  loading: boolean
  pagination?: {
    page: number
    pageSize: number
    total: number | null
    hasMore?: boolean
    setPage: (p: number) => void
  }
  searchQuery?: string
  onSearchChange?: (q: string) => void
  serverFiltered?: boolean
  testNameFilter?: string
  onTestNameFilterChange?: (value: string) => void
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  columnFilters?: ColumnFilters
  onColumnFiltersChange?: (filters: ColumnFilters) => void
  fillHeight?: boolean
}

function layoutNames(layouts: ExamLayout[]): string[] {
  return layouts.flatMap((layout) => (layout.is_group ? layoutNames(layout.children ?? []) : [layout.name]))
}

function filterActiveLayouts(layouts: ExamLayout[]): ExamLayout[] {
  return layouts
    .map((layout) => {
      const children = layout.children ? filterActiveLayouts(layout.children) : undefined
      if (layout.is_group) {
        return layout.is_active !== false && children && children.length > 0 ? { ...layout, children } : null
      }
      return layout.is_active === false ? null : { ...layout, children }
    })
    .filter(Boolean) as ExamLayout[]
}

export function ExamsTable({
  data,
  clientId,
  onExamDeleted,
  onExamDeleteFailed,
  loading,
  pagination,
  searchQuery: externalSearch,
  onSearchChange,
  serverFiltered = false,
  testNameFilter: externalTestNameFilter,
  onTestNameFilterChange,
  sort,
  onSortChange,
  columnFilters: externalColumnFilters,
  onColumnFiltersChange,
  fillHeight = false
}: ExamsTableProps) {
  const { t } = useTranslation()
  const columnFilters = useColumnFilterState(externalColumnFilters, onColumnFiltersChange)
  const { locale, direction } = useAppLocale()
  const [searchQuery, setSearchQuery] = useState("")
  const [localSort, setLocalSort] = useState<SortState | undefined>()
  const searchValue = externalSearch !== undefined ? externalSearch : searchQuery
  const navigate = useNavigate()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [examToDelete, setExamToDelete] = useState<ExamWithNames | null>(null)
  const [activeLayouts, setActiveLayouts] = useState<ExamLayout[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const { currentClinic } = useUser()
  const [previewExamId, setPreviewExamId] = useState<number | null>(null)
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [selectedTestName, setSelectedTestName] = useState<string>(ALL_FILTER_VALUE)
  const testNameFilter = externalTestNameFilter ?? selectedTestName
  const activeSort = sort ?? localSort
  const handleSortChange = onSortChange ?? setLocalSort

  const sortColumns = React.useMemo<SortColumns<ExamWithNames>>(
    () => ({
      exam_date: { getValue: (exam) => exam.exam_date, type: "date" },
      test_name: { getValue: (exam) => exam.test_name },
      client: { getValue: (exam) => exam.clientName },
      clinic: { getValue: (exam) => exam.clinic },
      examiner: { getValue: (exam) => exam.full_name || exam.username }
    }),
    []
  )

  useEffect(() => {
    const fetchActiveLayouts = async () => {
      if (!currentClinic?.id) {
        setActiveLayouts([])
        return
      }
      try {
        const layouts = await getAllExamLayouts(currentClinic?.id)
        setActiveLayouts(filterActiveLayouts(layouts))
      } catch (error) {
        console.error("Error fetching active layouts:", error)
      }
    }
    fetchActiveLayouts()
  }, [currentClinic?.id])

  const handleTestNameFilterChange = (value: string) => {
    if (onTestNameFilterChange) {
      onTestNameFilterChange(value)
      return
    }
    setSelectedTestName(value)
  }

  const columnFilterDefinitions = React.useMemo<ColumnFilterDefinition<ExamWithNames>[]>(() => {
    const testNames = Array.from(
      new Set([...layoutNames(activeLayouts), ...data.map((exam) => exam.test_name)].filter((name): name is string => Boolean(name)))
    ).sort((a, b) => a.localeCompare(b, locale))
    return [
      { key: "exam_date", label: t("examList.date"), kind: "date", getValue: (exam) => exam.exam_date },
      {
        key: "test_name",
        label: t("examList.kind"),
        kind: "options",
        options: testNames.map((name) => ({ value: name, label: name })),
        getValue: (exam) => exam.test_name,
      },
      ...(clientId === 0
        ? [{ key: "client", label: t("examList.client"), kind: "text" as const, getValue: (exam: ExamWithNames) => exam.clientName }]
        : []),
      { key: "clinic", label: t("examList.clinic"), kind: "text", getValue: (exam) => exam.clinic },
      { key: "examiner", label: t("examList.examiner"), kind: "text", getValue: (exam) => exam.full_name || exam.username },
    ]
  }, [activeLayouts, clientId, data, locale, t])

  const filteredData = React.useMemo(() => {
    let result = data

    if (!serverFiltered && testNameFilter !== ALL_FILTER_VALUE) {
      result = result.filter((exam) => exam.test_name === testNameFilter)
    }
    if (!serverFiltered) {
      result = result.filter((exam) => matchesColumnFilters(exam, columnFilters.filters, columnFilterDefinitions))
    }

    const searchLower = serverFiltered ? "" : searchValue.toLowerCase().trim()
    if (!searchLower) {
      return result
    }

    return result.filter((exam) => {
      const fullName = (exam.full_name || exam.username || "").toLowerCase()
      const clinic = (exam.clinic || "").toLowerCase()
      const testName = (exam.test_name || "").toLowerCase()

      if (fullName.includes(searchLower) || clinic.includes(searchLower) || testName.includes(searchLower)) {
        return true
      }

      return DateSearchHelper.matchesDate(searchLower, exam.exam_date)
    })
  }, [data, searchValue, testNameFilter, serverFiltered, columnFilters.filters, columnFilterDefinitions])

  const displayData = React.useMemo(() => {
    return onSortChange ? filteredData : sortRows(filteredData, activeSort, sortColumns)
  }, [activeSort, filteredData, onSortChange, sortColumns])

  const uniqueTestNames = React.useMemo(() => {
    return Array.from(new Set(data.map((exam) => exam.test_name).filter(Boolean)))
  }, [data])

  const handleDeleteConfirm = async () => {
    if (examToDelete && examToDelete.id !== undefined) {
      try {
        const deletedExamId = examToDelete.id
        // Optimistically update the UI
        onExamDeleted(deletedExamId)
        const success = await deleteExam(deletedExamId)
        if (!success) {
          // Revert optimistic update if API call fails (you might need to refetch or pass original data back)
          toast.error("אירעה שגיאה בעת מחיקת הבדיקה. מרענן נתונים...")
          onExamDeleteFailed() // Trigger full refresh
        }
      } catch (error) {
        toast.error("אירעה שגיאה בעת מחיקת הבדיקה")
        onExamDeleteFailed() // Trigger full refresh on error
      } finally {
        setExamToDelete(null)
      }
    }
    setIsDeleteModalOpen(false)
  }

  return (
    <ColumnFiltersProvider filters={columnFilters.filters} definitions={columnFilterDefinitions} onChange={columnFilters.setFilters}>
      <TableListLayout fillHeight={fillHeight} columnCount={clientId === 0 ? 6 : 5} loading={loading}
        toolbar={{searchValue:searchValue,
onSearchChange:(value) => (onSearchChange ? onSearchChange(value) : setSearchQuery(value)),
searchPlaceholder:t("examList.search"),
filters:[
          {
            key: "test-name",
            value: testNameFilter,
            onChange: handleTestNameFilterChange,
            placeholder: t("examList.kind"),
            options: [
              { value: ALL_FILTER_VALUE, label: t("examList.all") },
              ...uniqueTestNames.map((testName) => ({
                value: testName || "unknown",
                label: testName || t("examList.unknown")
              }))
            ],
            widthClassName: "w-[190px]"
          }
        ],
hasActiveFilters:Boolean(searchValue.trim()) || testNameFilter !== ALL_FILTER_VALUE || columnFilters.active,
onReset:() => {
          if (onSearchChange) onSearchChange("")
          else setSearchQuery("")
          handleTestNameFilterChange(ALL_FILTER_VALUE)
          columnFilters.setFilters({})
        },
actions:clientId > 0 ? (
            activeLayouts.length > 0 ? (
              <DropdownMenu dir={direction} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
                <DropdownMenuTrigger dir={direction} asChild>
                  <Button aria-label={t("examList.add")}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {activeLayouts.map((layout) => (
                    <DropdownMenuItem
                      dir={direction}
                      key={layout.id}
                      onClick={() => {
                        navigate({
                          to: "/clients/$clientId/exams/new",
                          params: { clientId: String(clientId) },
                          search: { layoutId: String(layout.id) }
                        })
                        setIsDropdownOpen(false)
                      }}
                    >
                      {layout.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button aria-label={t("examList.add")}>
                <Plus className="h-4 w-4" />
              </Button>
            )
          ) : (
            <NewExamButtonWithoutClient
              activeLayouts={activeLayouts}
              onClientSelect={(selectedClientId, layoutId) => {
                navigate({
                  to: "/clients/$clientId/exams/new",
                  params: { clientId: String(selectedClientId) },
                  search: layoutId ? { layoutId: String(layoutId) } : undefined
                })
              }}
            />
          )}}
        header={<TableRow>
              <SortableTableHead
                sortKey="exam_date"
                sort={activeSort}
                onSortChange={handleSortChange}
                className="text-start"
              >
                {t("examList.date")}
              </SortableTableHead>
              <SortableTableHead
                sortKey="test_name"
                sort={activeSort}
                onSortChange={handleSortChange}
                className="text-start"
              >
                {t("examList.kind")}
              </SortableTableHead>
              {clientId === 0 && (
                <SortableTableHead
                  sortKey="client"
                  sort={activeSort}
                  onSortChange={handleSortChange}
                  className="text-start"
                >
                  {t("examList.client")}
                </SortableTableHead>
              )}
              <SortableTableHead
                sortKey="clinic"
                sort={activeSort}
                onSortChange={handleSortChange}
                className="text-start"
              >
                {t("examList.clinic")}
              </SortableTableHead>
              <SortableTableHead
                sortKey="examiner"
                sort={activeSort}
                onSortChange={handleSortChange}
                className="text-start"
              >
                {t("examList.examiner")}
              </SortableTableHead>
              <TableHead className="w-[50px] text-start"></TableHead>
            </TableRow>}
        emptyState={displayData.length === 0 ? t('examList.empty') : undefined}
        pagination={pagination ? {page:pagination.page,pageSize:pagination.pageSize,total:pagination.total,hasMore:pagination.hasMore,onPageChange:pagination.setPage,loading} : undefined}
      >
        {displayData.map((exam) => (
                <TableRow
                  key={exam.id}
                  className="cursor-pointer"
                  onClick={() => {
                    navigate({
                      to: "/clients/$clientId/exams/$examId",
                      params: {
                        clientId: String(exam.client_id),
                        examId: String(exam.id)
                      }
                    })
                  }}
                >
                  <TableCell>{exam.exam_date ? new Date(exam.exam_date).toLocaleDateString({he:"he-IL",en:"en-US",fr:"fr-FR"}[locale]) : ""}</TableCell>
                  <TableCell>{exam.test_name}</TableCell>
                  {clientId === 0 && (
                    <TableCell>
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (exam.client_id) {
                            navigate({
                              to: "/clients/$clientId",
                              params: { clientId: String(exam.client_id) },
                              search: { tab: "exams" }
                            })
                          }
                        }}
                      >
                        {exam.clientName}
                      </button>
                    </TableCell>
                  )}
                  <TableCell>{exam.clinic}</TableCell>
                  <TableCell>{exam.full_name || exam.username}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setExamToDelete(exam)
                        setIsDeleteModalOpen(true)
                      }}
                      title={t("examList.delete")}
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPreviewExamId(exam.id || null)
                        setIsPreviewOpen(true)
                      }}
                      title={t("examList.preview")}
                    >
                      <Eye className="text-muted-foreground h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
      </TableListLayout>

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={t("trashMoveTitle")}
        description={t("trashMoveDescription", { item: examToDelete?.test_name || t("trashTypeExam") })}
        onConfirm={handleDeleteConfirm}
        confirmText={t("trashMoveConfirm")}
        className="text-center"
        cancelText={t("cancel")}
        showCloseButton={false}
      />

      <ExamPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        examId={previewExamId}
        onNext={() => {
          const index = displayData.findIndex((e) => e.id === previewExamId)
          if (index < displayData.length - 1) {
            setPreviewExamId(displayData[index + 1].id || null)
          }
        }}
        onPrev={() => {
          const index = displayData.findIndex((e) => e.id === previewExamId)
          if (index > 0) {
            setPreviewExamId(displayData[index - 1].id || null)
          }
        }}
        hasNext={(() => {
          const index = displayData.findIndex((e) => e.id === previewExamId)
          return index !== -1 && index < displayData.length - 1
        })()}
        hasPrev={(() => {
          const index = displayData.findIndex((e) => e.id === previewExamId)
          return index > 0
        })()}
      />
    </ColumnFiltersProvider>
  )
}

function NewExamButtonWithoutClient({
  activeLayouts,
  onClientSelect
}: {
  activeLayouts: ExamLayout[]
  onClientSelect: (clientId: number, layoutId?: number) => void
}) {
  const { direction } = useAppLocale()
  const { t } = useTranslation()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [isClientModalOpen, setIsClientModalOpen] = useState(false)
  const [selectedLayoutId, setSelectedLayoutId] = useState<number | undefined>()

  const handleLayoutSelect = (layoutId: number) => {
    setSelectedLayoutId(layoutId)
    setIsDropdownOpen(false)
    setIsClientModalOpen(true)
  }

  const handleClientSelect = (clientId: number) => {
    onClientSelect(clientId, selectedLayoutId)
    setIsClientModalOpen(false)
    setSelectedLayoutId(undefined)
  }

  if (activeLayouts.length > 0) {
    return (
      <>
        <DropdownMenu dir={direction} open={isDropdownOpen} onOpenChange={setIsDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <Button aria-label={t("examList.add")}>
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {activeLayouts.map((layout) => (
              <DropdownMenuItem dir={direction} key={layout.id} onClick={() => handleLayoutSelect(layout.id!)}>
                {layout.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <ClientSelectModal
          isOpen={isClientModalOpen}
          onClose={() => {
            setIsClientModalOpen(false)
            setSelectedLayoutId(undefined)
          }}
          onClientSelect={handleClientSelect}
        />
      </>
    )
  }

  return (
    <Button aria-label={t("examList.add")}>
      <Plus className="h-4 w-4" />
    </Button>
  )
}
