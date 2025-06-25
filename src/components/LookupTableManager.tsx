import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { CustomModal } from '@/components/ui/custom-modal'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface LookupItem {
  id?: number
  name: string
  created_at?: string
}

interface LookupTableManagerProps {
  tableName: string
  displayName: string
  items: LookupItem[]
  onRefresh: () => void
  onCreate: (data: Omit<LookupItem, 'id'>) => Promise<LookupItem | null>
  onUpdate: (data: LookupItem) => Promise<LookupItem | null>
  onDelete: (id: number) => Promise<boolean>
}

export function LookupTableManager({
  tableName,
  displayName,
  items,
  onRefresh,
  onCreate,
  onUpdate,
  onDelete
}: LookupTableManagerProps) {
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<LookupItem | null>(null)
  const [formData, setFormData] = useState({ name: '' })
  const [loading, setLoading] = useState(false)

  const openCreateModal = () => {
    setEditingItem(null)
    setFormData({ name: '' })
    setShowModal(true)
  }

  const openEditModal = (item: LookupItem) => {
    setEditingItem(item)
    setFormData({ name: item.name })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('השם הוא שדה חובה')
      return
    }

    try {
      setLoading(true)
      let result: LookupItem | null = null

      if (editingItem) {
        result = await onUpdate({ ...editingItem, name: formData.name.trim() })
      } else {
        result = await onCreate({ name: formData.name.trim() })
      }

      if (result) {
        toast.success(editingItem ? 'הפריט עודכן בהצלחה' : 'הפריט נוצר בהצלחה')
        setShowModal(false)
        onRefresh()
      } else {
        toast.error('שגיאה בשמירת הפריט')
      }
    } catch (error) {
      console.error('Error saving item:', error)
      toast.error('שגיאה בשמירת הפריט')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק את הפריט?')) {
      try {
        const success = await onDelete(id)
        if (success) {
          toast.success('הפריט נמחק בהצלחה')
          onRefresh()
        } else {
          toast.error('שגיאה במחיקת הפריט')
        }
      } catch (error) {
        console.error('Error deleting item:', error)
        toast.error('שגיאה במחיקת הפריט')
      }
    }
  }

  return (
    <>
      <Card className="shadow-md border-none">
        <CardHeader>
          <div className="flex justify-between items-center">
            <Button 
              onClick={openCreateModal}
              size="icon"
              className="bg-default text-default-foreground hover:bg-accent/90"
              title={`הוסף ${displayName.slice(0, -1)} חדש`}
            >
              <IconPlus className="h-4 w-4" />
            </Button>
            <div className="text-right">
              <CardTitle className="text-right">{displayName}</CardTitle>
              <p className="text-sm text-muted-foreground text-right">
                {items.length} פריטים
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border" style={{scrollbarWidth: 'none'}}>
            <Table>
              <TableBody>
                {items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                      אין פריטים
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => handleDelete(item.id!)}
                            className="text-red-600 hover:text-red-700 h-8 w-8"
                          >
                            <IconTrash className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => openEditModal(item)}
                            className="h-8 w-8"
                          >
                            <IconEdit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.name}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <CustomModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingItem ? `ערוך ${displayName.slice(0, -1)}` : `הוסף ${displayName.slice(0, -1)} חדש`}
        className="max-w-md"
      >
        <div className="space-y-4" dir="rtl">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-right block">
              שם *
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ name: e.target.value })}
              placeholder="הזן שם"
              className="text-right"
              dir="rtl"
            />
          </div>

          <div className="flex justify-start gap-2 pt-4">
            <Button 
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'שומר...' : (editingItem ? 'עדכן' : 'צור')}
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowModal(false)}
              disabled={loading}
            >
              ביטול
            </Button>
          </div>
        </div>
      </CustomModal>
    </>
  )
} 