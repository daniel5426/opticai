import * as React from "react"
import { Family } from "@/lib/db/schema-interface"
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
import { Edit2, Trash2 } from "lucide-react"
import { CustomModal } from "@/components/ui/custom-modal"
import { deleteFamily } from "@/lib/db/family-db"
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"

interface FamiliesTableProps {
  data: Family[]
  onFamilySelected?: (family: Family | null) => void
  onFamilyEdit?: (family: Family) => void
  onFamilyDeleted?: (familyId: number) => void
  onFamilyDeleteFailed?: () => void
  selectedFamilyId?: number | null
  searchQuery?: string
  onSearchChange?: (query: string) => void
  hideSearch?: boolean
  loading?: boolean
  pagination?: { page: number; pageSize: number; total: number; setPage: (p: number) => void }
}

export function FamiliesTable({ 
  data, 
  onFamilySelected, 
  onFamilyEdit, 
  onFamilyDeleted, 
  onFamilyDeleteFailed,
  selectedFamilyId,
  searchQuery: externalSearchQuery,
  onSearchChange,
  hideSearch = false,
  loading = false,
  pagination
}: FamiliesTableProps) {
  const [internalSearchQuery, setInternalSearchQuery] = React.useState("")
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [familyToDelete, setFamilyToDelete] = React.useState<Family | null>(null)
  const [memberCounts, setMemberCounts] = React.useState<Record<number, number>>({})

  const searchQuery = externalSearchQuery !== undefined ? externalSearchQuery : internalSearchQuery
  const isExternalSearch = externalSearchQuery !== undefined

  const filteredData = React.useMemo(() => {
    if (!isExternalSearch && searchQuery) {
      return data.filter((family) => family.name.toLowerCase().includes(searchQuery.toLowerCase()))
    }
    return data
  }, [data, searchQuery, isExternalSearch])

  const handleSearchChange = (value: string) => {
    if (onSearchChange) {
      onSearchChange(value)
    } else {
      setInternalSearchQuery(value)
    }
  }

  React.useEffect(() => {
    const counts: Record<number, number> = {}
    for (const family of data) {
      if (family.id) {
        counts[family.id] = typeof family.member_count === 'number' 
          ? family.member_count 
          : (family.clients?.length || 0)
      }
    }
    setMemberCounts(counts)
  }, [data])

  const handleDeleteConfirm = async () => {
    if (familyToDelete && familyToDelete.id !== undefined) {
      try {
        const deletedFamilyId = familyToDelete.id
        onFamilyDeleted?.(deletedFamilyId)
        toast.success("משפחה נמחקה בהצלחה")

        const success = await deleteFamily(deletedFamilyId)
        if (!success) {
          toast.error("אירעה שגיאה בעת מחיקת המשפחה. מרענן נתונים...")
          onFamilyDeleteFailed?.()
        }
      } catch (error) {
        toast.error("אירעה שגיאה בעת מחיקת המשפחה")
        onFamilyDeleteFailed?.()
      } finally {
        setFamilyToDelete(null)
      }
    }
    setIsDeleteModalOpen(false)
  }

  const handleRowClick = (family: Family) => {
    onFamilySelected?.(selectedFamilyId === family.id ? null : family)
  }

  return (
    <div className="space-y-4 mb-10" dir="rtl">
      {!hideSearch && (
        <div className="flex items-center justify-between">
          <Input
            placeholder="חיפוש משפחות..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-[250px] bg-card dark:bg-card"
            dir="rtl"
          />
          <h3 className="text-lg font-semibold">משפחות</h3>
        </div>
      )}

      <div className="rounded-md bg-card">
        <Table dir="rtl" containerClassName="max-h-[70vh] overflow-y-auto overscroll-contain" containerStyle={{ scrollbarWidth: 'none' }}>
          <TableHeader className="sticky top-0 z-30 bg-card">
            <TableRow>
              <TableHead className="text-right">שם המשפחה</TableHead>
              <TableHead className="text-right">מספר חברים</TableHead>
              <TableHead className="text-right">נוצר בתאריך</TableHead>
              <TableHead className="w-[100px] text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 14 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="w-[70%] h-4 my-2" />
                  </TableCell>
                </TableRow>
              ))
            ) : filteredData.length > 0 ? (
              filteredData.map((family) => (
                <TableRow
                  key={family.id}
                  className={`cursor-pointer hover:bg-muted/50 ${
                    selectedFamilyId === family.id ? 'bg-muted border-r-2 border-primary' : ''
                  }`}
                  onClick={() => handleRowClick(family)}
                >
                  <TableCell className="font-medium">{family.name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center justify-center w-6 h-6 bg-primary/10 text-primary rounded-full text-sm font-medium">
                        {memberCounts[family.id!] || 0}
                      </span>
                      <span className="text-sm text-muted-foreground">חברים</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {family.created_date 
                      ? new Date(family.created_date).toLocaleDateString('he-IL')
                      : 'לא זמין'
                    }
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0" 
                        onClick={(e) => {
                          e.stopPropagation()
                          onFamilyEdit?.(family)
                        }} 
                        title="עריכה"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        className="h-8 w-8 p-0" 
                        onClick={(e) => {
                          e.stopPropagation()
                          setFamilyToDelete(family)
                          setIsDeleteModalOpen(true)
                        }} 
                        title="מחיקה"
                      >
                        <Trash2 className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {searchQuery ? 'לא נמצאו משפחות המתאימות לחיפוש' : 'לא נמצאו משפחות'}
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
        title="מחיקת משפחה"
        description={
          familyToDelete 
            ? `האם אתה בטוח שברצונך למחוק את המשפחה "${familyToDelete.name}"? פעולה זו תסיר את כל הלקוחות מהמשפחה אבל לא תמחק את הלקוחות עצמם.`
            : "האם אתה בטוח שברצונך למחוק משפחה זו?"
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