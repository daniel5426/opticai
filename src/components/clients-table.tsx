import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Client } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PlusIcon, Trash2 } from "lucide-react"
import { CustomModal } from "@/components/ui/custom-modal"
import { deleteClient } from "@/lib/db/clients-db"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { TableFiltersBar } from "@/components/table-filters-bar"
import { TablePagination } from "@/components/table-pagination"
import { GENDER_FILTER_OPTIONS } from "@/lib/table-filters"
import { SortableTableHead } from "@/components/sortable-table-head"
import { SortColumns, SortState, sortRows } from "@/lib/table-sorting"
import { DateSearchHelper } from "@/lib/date-search-helper"
import { useAppLocale } from "@/localization/use-app-locale"

const LIST_CELL_TEXT_LIMIT = 160

function getListCellText(value: string | undefined) {
  return typeof value === "string" ? value.slice(0, LIST_CELL_TEXT_LIMIT) : ""
}

interface ClientsTableProps {
  data: Client[]
  onClientDeleted?: (clientId: number) => void
  onClientDeleteFailed?: () => void
  selectedFamilyId?: number | null
  showFamilyColumn?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
  serverFiltered?: boolean
  hideSearch?: boolean
  hideNewButton?: boolean
  compactMode?: boolean
  loading?: boolean
  pagination?: {
    page: number
    pageSize: number
    total: number | null
    hasMore?: boolean
    setPage: (p: number) => void
  }
  genderFilter?: string
  onGenderFilterChange?: (value: string) => void
  toolbarActions?: React.ReactNode
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  mergeMode?: boolean
  selectedMergeClientIds?: number[]
  selectedMergeClients?: Client[]
  onToggleMergeClient?: (client: Client) => void
  fillHeight?: boolean
}

export function ClientsTable({
  data,
  onClientDeleted,
  onClientDeleteFailed,
  selectedFamilyId,
  showFamilyColumn = false,
  searchQuery: externalSearchQuery,
  onSearchChange,
  serverFiltered = false,
  hideSearch = false,
  hideNewButton = false,
  compactMode = false,
  loading = false,
  pagination,
  genderFilter: externalGenderFilter,
  onGenderFilterChange,
  toolbarActions,
  sort,
  onSortChange,
  mergeMode = false,
  selectedMergeClientIds = [],
  selectedMergeClients = [],
  onToggleMergeClient,
  fillHeight = false
}: ClientsTableProps) {
  const { direction } = useAppLocale()
  const [internalSearchQuery, setInternalSearchQuery] = React.useState("")
  const [selectedGender, setSelectedGender] = React.useState<string>("all")
  const [localSort, setLocalSort] = React.useState<SortState | undefined>()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [clientToDelete, setClientToDelete] = React.useState<Client | null>(null)
  const navigate = useNavigate()

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery
  const genderFilter = externalGenderFilter ?? selectedGender
  const activeSort = sort ?? localSort
  const handleSortChange = onSortChange ?? setLocalSort

  const sortColumns = React.useMemo<SortColumns<Client>>(
    () => ({
      id: { getValue: (client) => client.id, type: "number" },
      first_name: { getValue: (client) => client.first_name },
      last_name: { getValue: (client) => client.last_name },
      gender: { getValue: (client) => client.gender },
      national_id: { getValue: (client) => client.national_id },
      phone_mobile: { getValue: (client) => client.phone_mobile },
      email: { getValue: (client) => client.email },
      family_role: { getValue: (client) => client.family_role }
    }),
    []
  )

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value)
    } else {
      setInternalSearchQuery(value)
    }
  }

  const handleGenderFilterChange = (value: string) => {
    if (onGenderFilterChange) {
      onGenderFilterChange(value)
      return
    }
    setSelectedGender(value)
  }

  const filteredData = React.useMemo(() => {
    let filtered = data

    if (showFamilyColumn) {
      if (selectedFamilyId) {
        filtered = filtered.filter((client) => client.family_id === selectedFamilyId)
      } else {
        filtered = []
      }
    }

    if (!serverFiltered && genderFilter !== "all") {
      filtered = filtered.filter((client) => client.gender === genderFilter)
    }

    if (!serverFiltered && searchQuery && filtered.length > 0) {
      filtered = filtered.filter((client) => {
        const searchableFields = [
          client.first_name,
          client.last_name,
          client.national_id,
          client.phone_mobile,
          client.email
        ]

        return (
          searchableFields.some((field) => field && field.toLowerCase().includes(searchQuery.toLowerCase())) ||
          [client.date_of_birth, client.file_creation_date, client.membership_end, client.service_end].some((date) =>
            DateSearchHelper.matchesDate(searchQuery, date)
          )
        )
      })
    }

    return filtered
  }, [data, searchQuery, selectedFamilyId, showFamilyColumn, genderFilter, serverFiltered])

  const displayData = React.useMemo(() => {
    return onSortChange ? filteredData : sortRows(filteredData, activeSort, sortColumns)
  }, [activeSort, filteredData, onSortChange, sortColumns])

  const handleDeleteConfirm = async () => {
    if (clientToDelete && clientToDelete.id !== undefined) {
      try {
        const deletedClientId = clientToDelete.id
        onClientDeleted?.(deletedClientId)
        toast.success("לקוח נמחק בהצלחה")

        const success = await deleteClient(deletedClientId)
        if (!success) {
          toast.error("אירעה שגיאה בעת מחיקת הלקוח. מרענן נתונים...")
          onClientDeleteFailed?.()
        }
      } catch (error) {
        toast.error("אירעה שגיאה בעת מחיקת הלקוח")
        onClientDeleteFailed?.()
      } finally {
        setClientToDelete(null)
      }
    }
    setIsDeleteModalOpen(false)
  }

  const handleRowClick = (clientId: number | undefined) => {
    if (clientId === undefined) return
    if (mergeMode) {
      const client =
        displayData.find((item) => item.id === clientId) || selectedMergeClients.find((item) => item.id === clientId)
      if (client) onToggleMergeClient?.(client)
      return
    }
    navigate({
      to: "/clients/$clientId",
      params: { clientId: String(clientId) },
      search: { tab: "details" }
    })
  }

  const columnsCount = (compactMode ? (showFamilyColumn ? 6 : 5) : showFamilyColumn ? 9 : 8) + (mergeMode ? 1 : 0)
  const emptyMessage = showFamilyColumn && !selectedFamilyId
    ? "בחר משפחה כדי לראות את חבריה"
    : selectedFamilyId
      ? "לא נמצאו לקוחות במשפחה זו"
      : "לא נמצאו לקוחות לתצוגה"

  return (
    <div className={fillHeight ? "flex min-h-0 flex-1 flex-col gap-2.5" : "space-y-2.5"} dir={direction} style={{ scrollbarWidth: "none" }}>
      {!hideSearch && (
        <TableFiltersBar
          searchValue={searchQuery}
          onSearchChange={handleSearchChange}
          searchPlaceholder="חיפוש לקוחות…"
          filters={[
            {
              key: "gender",
              value: genderFilter,
              onChange: handleGenderFilterChange,
              placeholder: "מגדר",
              options: GENDER_FILTER_OPTIONS,
              widthClassName: "w-[130px]"
            }
          ]}
          hasActiveFilters={Boolean(searchQuery.trim()) || genderFilter !== "all"}
          onReset={() => {
            handleSearchChange("")
            handleGenderFilterChange("all")
          }}
          actions={
            <>
              {toolbarActions}
              {!hideNewButton ? (
                <Button onClick={() => navigate({ to: "/clients/new" })} dir={direction}>
                  לקוח חדש
                  <PlusIcon className="mr-2 h-4 w-4" />
                </Button>
              ) : null}
            </>
          }
        />
      )}

      <div className={fillHeight ? "bg-card min-h-0 flex-1 rounded-md" : "bg-card rounded-md"}>
        <Table
          dir={direction}
          containerClassName={fillHeight ? "h-full min-h-0 overflow-y-auto overscroll-contain" : "max-h-[70vh] overflow-y-auto overscroll-contain"}
          containerStyle={{ scrollbarWidth: "none" }}
          emptyState={!loading && displayData.length === 0 ? emptyMessage : undefined}
          showTrailingRowBorder={fillHeight}
        >
          <TableHeader className="bg-card sticky top-0">
            <TableRow>
              {mergeMode && <TableHead className="bg-card sticky top-0 z-20 w-[44px] !p-0 text-right"></TableHead>}
              <SortableTableHead
                sortKey="id"
                sort={activeSort}
                onSortChange={handleSortChange}
                className="bg-card sticky top-0 z-20 text-right"
              >
                מס' לקוח
              </SortableTableHead>
              <SortableTableHead
                sortKey="first_name"
                sort={activeSort}
                onSortChange={handleSortChange}
                className="bg-card sticky top-0 z-20 text-right"
              >
                שם פרטי
              </SortableTableHead>
              <SortableTableHead
                sortKey="last_name"
                sort={activeSort}
                onSortChange={handleSortChange}
                className="bg-card sticky top-0 z-20 text-right"
              >
                שם משפחה
              </SortableTableHead>
              {!compactMode && (
                <SortableTableHead
                  sortKey="gender"
                  sort={activeSort}
                  onSortChange={handleSortChange}
                  className="bg-card sticky top-0 z-20 text-right"
                >
                  מגדר
                </SortableTableHead>
              )}
              <SortableTableHead
                sortKey="national_id"
                sort={activeSort}
                onSortChange={handleSortChange}
                className="bg-card sticky top-0 z-20 text-right"
              >
                ת.ז.
              </SortableTableHead>
              {!compactMode && (
                <SortableTableHead
                  sortKey="phone_mobile"
                  sort={activeSort}
                  onSortChange={handleSortChange}
                  className="bg-card sticky top-0 z-20 text-right"
                >
                  נייד
                </SortableTableHead>
              )}
              {!compactMode && (
                <SortableTableHead
                  sortKey="email"
                  sort={activeSort}
                  onSortChange={handleSortChange}
                  className="bg-card sticky top-0 z-20 text-right"
                >
                  אימייל
                </SortableTableHead>
              )}
              {showFamilyColumn && (
                <SortableTableHead
                  sortKey="family_role"
                  sort={activeSort}
                  onSortChange={handleSortChange}
                  className="bg-card sticky top-0 z-20 text-right"
                >
                  תפקיד במשפחה
                </SortableTableHead>
              )}
              <TableHead className="bg-card sticky top-0 z-20 w-[50px] text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mergeMode && selectedMergeClients.length > 0 && (
              <TableRow className="bg-muted/90 hover:bg-muted/90 sticky top-10 z-10">
                <TableCell colSpan={columnsCount} className="!p-0">
                  <div className="flex flex-wrap items-center gap-2 px-4 py-2 text-xs">
                    <span className="text-muted-foreground font-medium">לקוחות שנבחרו למיזוג</span>
                    {selectedMergeClients.map((client) => (
                      <button
                        key={`selected-${client.id}`}
                        type="button"
                        className="bg-background hover:bg-accent inline-flex max-w-[240px] items-center gap-2 rounded-md border px-2 py-1 text-right"
                        onClick={() => onToggleMergeClient?.(client)}
                      >
                        <Checkbox checked={true} className="pointer-events-none h-3.5 w-3.5" />
                        <span className="truncate">
                          {client.id} · {[client.first_name, client.last_name].filter(Boolean).join(" ") || "ללא שם"}
                        </span>
                      </button>
                    ))}
                  </div>
                </TableCell>
              </TableRow>
            )}
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <TableRow key={i}>
                  {mergeMode && (
                    <TableCell className="w-[44px] !p-0">
                      <div className="flex h-full min-h-9 items-center justify-center">
                        <Skeleton className="my-2 h-4 w-4" />
                      </div>
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[20%]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                  {!compactMode && (
                    <TableCell>
                      <Skeleton className="my-2 h-4 w-[70%]" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                  {!compactMode && (
                    <TableCell>
                      <Skeleton className="my-2 h-4 w-[70%]" />
                    </TableCell>
                  )}
                  {!compactMode && (
                    <TableCell>
                      <Skeleton className="my-2 h-4 w-[70%]" />
                    </TableCell>
                  )}
                  {showFamilyColumn && (
                    <TableCell>
                      <Skeleton className="my-2 h-4 w-[70%]" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="my-2 h-4 w-[70%]" />
                  </TableCell>
                </TableRow>
              ))
            ) : displayData.length > 0 ? (
              displayData.map((client) => (
                <TableRow key={client.id} className="cursor-pointer" onClick={() => handleRowClick(client.id)}>
                  {mergeMode && (
                    <TableCell className="w-[44px] !p-0">
                      <div className="flex h-full min-h-9 items-center justify-center">
                        <Checkbox
                          checked={client.id ? selectedMergeClientIds.includes(client.id) : false}
                          onClick={(event) => event.stopPropagation()}
                          onCheckedChange={() => onToggleMergeClient?.(client)}
                        />
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="font-medium">{client.id}</TableCell>
                  <TableCell className="max-w-[12rem] overflow-hidden">
                    <bdi className="block truncate" dir="auto">
                      {getListCellText(client.first_name)}
                    </bdi>
                  </TableCell>
                  <TableCell className="max-w-[12rem] overflow-hidden">
                    <bdi className="block truncate" dir="auto">
                      {getListCellText(client.last_name)}
                    </bdi>
                  </TableCell>
                  {!compactMode && <TableCell>{client.gender || ""}</TableCell>}
                  <TableCell>{client.national_id || ""}</TableCell>
                  {!compactMode && <TableCell>{client.phone_mobile || ""}</TableCell>}
                  {!compactMode && <TableCell>{client.email || ""}</TableCell>}
                  {showFamilyColumn && <TableCell>{client.family_role || ""}</TableCell>}
                  <TableCell>
                    <Button
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      onClick={(e) => {
                        e.stopPropagation()
                        setClientToDelete(client)
                        setIsDeleteModalOpen(true)
                      }}
                      title="מחיקה"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : null}
          </TableBody>
        </Table>
      </div>

      {pagination ? (
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={pagination.total}
          hasMore={pagination.hasMore}
          onPageChange={pagination.setPage}
          loading={loading}
        />
      ) : null}

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת לקוח"
        description={
          clientToDelete
            ? `האם אתה בטוח שברצונך למחוק את הלקוח ${clientToDelete.first_name} ${clientToDelete.last_name}? פעולה זו אינה הפיכה.`
            : "האם אתה בטוח שברצונך למחוק לקוח זה? פעולה זו אינה הפיכה."
        }
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
      />
    </div>
  )
}
