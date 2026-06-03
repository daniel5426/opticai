import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Client } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PlusIcon, Trash2 } from "lucide-react"
import { CustomModal } from "@/components/ui/custom-modal"
import { deleteClient } from "@/lib/db/clients-db"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { TableFiltersBar } from "@/components/table-filters-bar"
import { GENDER_FILTER_OPTIONS } from "@/lib/table-filters"
import { SortableTableHead } from "@/components/sortable-table-head"
import { SortColumns, SortState, sortRows } from "@/lib/table-sorting"
import { DateSearchHelper } from "@/lib/date-search-helper"

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
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void }
  genderFilter?: string
  onGenderFilterChange?: (value: string) => void
  toolbarActions?: React.ReactNode
  sort?: SortState
  onSortChange?: (sort: SortState) => void
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
}: ClientsTableProps) {
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

  const sortColumns = React.useMemo<SortColumns<Client>>(() => ({
    id: { getValue: (client) => client.id, type: "number" },
    first_name: { getValue: (client) => client.first_name },
    last_name: { getValue: (client) => client.last_name },
    gender: { getValue: (client) => client.gender },
    national_id: { getValue: (client) => client.national_id },
    phone_mobile: { getValue: (client) => client.phone_mobile },
    email: { getValue: (client) => client.email },
    family_role: { getValue: (client) => client.family_role },
  }), [])

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
      filtered = filtered.filter(client => client.gender === genderFilter)
    }

    if (!serverFiltered && searchQuery && filtered.length > 0) {
      filtered = filtered.filter((client) => {
        const searchableFields = [
          client.first_name,
          client.last_name,
          client.national_id,
          client.phone_mobile,
          client.email,
        ]

        return searchableFields.some(
          (field) =>
            field && field.toLowerCase().includes(searchQuery.toLowerCase()),
        ) || [
          client.date_of_birth,
          client.file_creation_date,
          client.membership_end,
          client.service_end,
        ].some((date) => DateSearchHelper.matchesDate(searchQuery, date))
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
    if (clientId !== undefined) {
      navigate({ to: "/clients/$clientId", params: { clientId: String(clientId) }, search: { tab: "details" } })
    }
  }

  return (
    <div className="space-y-2.5 mb-10" dir="rtl" style={{ scrollbarWidth: 'none' }}>
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
              widthClassName: "w-[130px]",
            },
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
                <Button onClick={() => navigate({ to: "/clients/new" })} dir="rtl">
                  לקוח חדש
                  <PlusIcon className="mr-2 h-4 w-4" />
                </Button>
              ) : null}
            </>
          }
        />
      )}

      <div className="rounded-md bg-card">
        <Table
          dir="rtl"
          containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain"
          containerStyle={{ scrollbarWidth: 'none' }}
        >
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <SortableTableHead sortKey="id" sort={activeSort} onSortChange={handleSortChange} className="text-right sticky top-0 z-20 bg-card">מס' לקוח</SortableTableHead>
              <SortableTableHead sortKey="first_name" sort={activeSort} onSortChange={handleSortChange} className="text-right sticky top-0 z-20 bg-card">שם פרטי</SortableTableHead>
              <SortableTableHead sortKey="last_name" sort={activeSort} onSortChange={handleSortChange} className="text-right sticky top-0 z-20 bg-card">שם משפחה</SortableTableHead>
              {!compactMode && <SortableTableHead sortKey="gender" sort={activeSort} onSortChange={handleSortChange} className="text-right sticky top-0 z-20 bg-card">מגדר</SortableTableHead>}
              <SortableTableHead sortKey="national_id" sort={activeSort} onSortChange={handleSortChange} className="text-right sticky top-0 z-20 bg-card">ת.ז.</SortableTableHead>
              {!compactMode && <SortableTableHead sortKey="phone_mobile" sort={activeSort} onSortChange={handleSortChange} className="text-right sticky top-0 z-20 bg-card">נייד</SortableTableHead>}
              {!compactMode && <SortableTableHead sortKey="email" sort={activeSort} onSortChange={handleSortChange} className="text-right sticky top-0 z-20 bg-card">אימייל</SortableTableHead>}
              {showFamilyColumn && <SortableTableHead sortKey="family_role" sort={activeSort} onSortChange={handleSortChange} className="text-right sticky top-0 z-20 bg-card">תפקיד במשפחה</SortableTableHead>}
              <TableHead className="w-[50px] text-right sticky top-0 z-20 bg-card"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="w-[20%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  {!compactMode && (
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  {!compactMode && (
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                  )}
                  {!compactMode && (
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                  )}
                  {showFamilyColumn && (
                    <TableCell>
                      <Skeleton className="w-[70%] h-4 my-2" />
                    </TableCell>
                  )}
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                </TableRow>
              ))
            ) : displayData.length > 0 ? (
              displayData.map((client) => (
                <TableRow
                  key={client.id}
                  className="cursor-pointer"
                  onClick={() => handleRowClick(client.id)}
                >
                  <TableCell className="font-medium">{client.id}</TableCell>
                  <TableCell>{client.first_name || ""}</TableCell>
                  <TableCell>{client.last_name || ""}</TableCell>
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
                        e.stopPropagation();
                        setClientToDelete(client);
                        setIsDeleteModalOpen(true);
                      }} 
                      title="מחיקה"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={compactMode ? (showFamilyColumn ? 6 : 5) : (showFamilyColumn ? 9 : 8)} className="h-24 text-center text-muted-foreground">
                  {showFamilyColumn && !selectedFamilyId ? 'בחר משפחה כדי לראות את חבריה' : 
                   selectedFamilyId ? 'לא נמצאו לקוחות במשפחה זו' : 'לא נמצאו לקוחות לתצוגה'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {pagination && (
        <div className="flex items-center justify-between mt-4">
          <div className="text-sm text-muted-foreground">
            עמוד {pagination.page} מתוך {Math.max(1, Math.ceil((pagination.total || 0) / (pagination.pageSize || 1)))} · סה"כ {pagination.total || 0}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page <= 1}
              onClick={() => pagination.setPage(Math.max(1, pagination.page - 1))}
            >הקודם</Button>
            <Button
              variant="outline"
              size="sm"
              disabled={loading || pagination.page >= Math.ceil((pagination.total || 0) / (pagination.pageSize || 1))}
              onClick={() => pagination.setPage(pagination.page + 1)}
            >הבא</Button>
          </div>
        </div>
      )}

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת לקוח"
        description={clientToDelete ? `האם אתה בטוח שברצונך למחוק את הלקוח ${clientToDelete.first_name} ${clientToDelete.last_name}? פעולה זו אינה הפיכה.` : "האם אתה בטוח שברצונך למחוק לקוח זה? פעולה זו אינה הפיכה."}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        className="text-center"
        cancelText="בטל"
        showCloseButton={false}
      />
    </div>
  )
}
