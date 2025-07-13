import * as React from "react"
import { Family } from "@/lib/db/schema"
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
import { deleteFamily, getFamilyMembers } from "@/lib/db/family-db"
import { toast } from "sonner"

interface FamiliesTableProps {
  data: Family[]
  onFamilySelected?: (family: Family | null) => void
  onFamilyEdit?: (family: Family) => void
  onFamilyDeleted?: (familyId: number) => void
  onFamilyDeleteFailed?: () => void
  selectedFamilyId?: number | null
  searchQuery: string
  onSearchChange: (query: string) => void
  hideSearch?: boolean
}

export function FamiliesTable({ 
  data, 
  onFamilySelected, 
  onFamilyEdit, 
  onFamilyDeleted, 
  onFamilyDeleteFailed,
  selectedFamilyId,
  searchQuery,
  onSearchChange,
  hideSearch = false
}: FamiliesTableProps) {
  const [isDeleteModalOpen, setIsDeleteModalOpen] = React.useState(false)
  const [familyToDelete, setFamilyToDelete] = React.useState<Family | null>(null)
  const [memberCounts, setMemberCounts] = React.useState<Record<number, number>>({})

  const filteredData = React.useMemo(() => {
    return data.filter((family) => {
      return family.name.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [data, searchQuery])

  React.useEffect(() => {
    const loadMemberCounts = async () => {
      const counts: Record<number, number> = {}
      for (const family of data) {
        if (family.id) {
          try {
            const members = await getFamilyMembers(family.id)
            counts[family.id] = members.length
          } catch (error) {
            console.error('Error loading member count for family:', family.id, error)
            counts[family.id] = 0
          }
        }
      }
      setMemberCounts(counts)
    }

    if (data.length > 0) {
      loadMemberCounts()
    }
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
    <div className="space-y-4" dir="rtl">
      {!hideSearch && (
        <div className="flex items-center justify-between">
          <Input
            placeholder="חיפוש משפחות..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-[250px] bg-card dark:bg-card"
            dir="rtl"
          />
          <h3 className="text-lg font-semibold">משפחות</h3>
        </div>
      )}

      <div className="rounded-md border bg-card">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">שם המשפחה</TableHead>
              <TableHead className="text-right">מספר חברים</TableHead>
              <TableHead className="text-right">נוצר בתאריך</TableHead>
              <TableHead className="w-[100px] text-right">פעולות</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length > 0 ? (
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