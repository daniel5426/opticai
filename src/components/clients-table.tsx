import * as React from "react"
import { useNavigate } from "@tanstack/react-router"
import { Client } from "@/lib/db/schema-interface"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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

interface ClientsTableProps {
  data: Client[]
  onClientDeleted?: (clientId: number) => void
  onClientDeleteFailed?: () => void
  selectedFamilyId?: number | null
  showFamilyColumn?: boolean
  searchQuery?: string
  onSearchChange?: (query: string) => void
  hideSearch?: boolean
  hideNewButton?: boolean
  compactMode?: boolean
  loading?: boolean
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void }
}

export function ClientsTable({ 
  data, 
  onClientDeleted, 
  onClientDeleteFailed,
  selectedFamilyId,
  showFamilyColumn = false,
  searchQuery: externalSearchQuery,
  onSearchChange,
  hideSearch = false,
  hideNewButton = false,
  compactMode = false,
  loading = false,
  pagination
}: ClientsTableProps) {
  const [internalSearchQuery, setInternalSearchQuery] = React.useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [clientToDelete, setClientToDelete] = React.useState<Client | null>(null)
  const navigate = useNavigate()

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery
  const isExternalSearch = externalSearchQuery !== undefined

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value)
    } else {
      setInternalSearchQuery(value)
    }
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

    // Only apply local text filtering when using internal search.
    if (!isExternalSearch && searchQuery && filtered.length > 0) {
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
        )
      })
    }

    return filtered
  }, [data, searchQuery, selectedFamilyId, showFamilyColumn, isExternalSearch])

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
    <div className="space-y-4 mb-10" dir="rtl" style={{ scrollbarWidth: 'none' }}>
      {!hideSearch && (
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Input
              placeholder="חיפוש לקוחות..."
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-[250px] bg-card dark:bg-card"
              dir="rtl"
            />
          </div>
          {!hideNewButton && (
            <Button onClick={() => navigate({ to: "/clients/new" })} dir="rtl">
              לקוח חדש
              <PlusIcon className="mr-2 h-4 w-4" />
            </Button>
          )}
        </div>
      )}

      <div className="rounded-md bg-card">
        <Table
          dir="rtl"
          containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain"
          containerStyle={{ scrollbarWidth: 'none' }}
        >
          <TableHeader className="sticky top-0 bg-card">
            <TableRow>
              <TableHead className="text-right sticky top-0 z-20 bg-card">מס' לקוח</TableHead>
              <TableHead className="text-right sticky top-0 z-20 bg-card">שם פרטי</TableHead>
              <TableHead className="text-right sticky top-0 z-20 bg-card">שם משפחה</TableHead>
              {!compactMode && <TableHead className="text-right sticky top-0 z-20 bg-card">מגדר</TableHead>}
              <TableHead className="text-right sticky top-0 z-20 bg-card">ת.ז.</TableHead>
              {!compactMode && <TableHead className="text-right sticky top-0 z-20 bg-card">נייד</TableHead>}
              {!compactMode && <TableHead className="text-right sticky top-0 z-20 bg-card">אימייל</TableHead>}
              {showFamilyColumn && <TableHead className="text-right sticky top-0 z-20 bg-card">תפקיד במשפחה</TableHead>}
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
            ) : filteredData.length > 0 ? (
              filteredData.map((client) => (
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