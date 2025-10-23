import React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CustomModal } from "@/components/ui/custom-modal"
import { UserSelect } from "@/components/ui/user-select"
import { Trash2, Loader2 } from "lucide-react"
import { Appointment, Client, User } from "@/lib/db/schema-interface"

interface AppointmentModalProps {
  isOpen: boolean
  onClose: () => void
  editingAppointment: Appointment | null
  selectedClient: Client | null
  formData: Omit<Appointment, 'id'>
  users: User[]
  saving: boolean
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void
  onSave: () => void
  onDelete: (appointmentId: number) => void
  onUserChange: (userId: number) => void
}

export function AppointmentModal({
  isOpen,
  onClose,
  editingAppointment,
  selectedClient,
  formData,
  users,
  saving,
  onInputChange,
  onSave,
  onDelete,
  onUserChange
}: AppointmentModalProps) {
  return (
    <CustomModal
      isOpen={isOpen}
      onClose={onClose}
      title={editingAppointment ? 'עריכת תור' : selectedClient ? `תור חדש - ${selectedClient.first_name} ${selectedClient.last_name}` : 'תור חדש'}
      className="sm:max-w-[600px] border-none"
    >
      <div className="grid gap-4">
        {selectedClient && (
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-md">
            <div className="text-sm font-medium">פרטי לקוח:</div>
            <div className="text-sm text-muted-foreground">
              {selectedClient.first_name} {selectedClient.last_name} • {selectedClient.phone_mobile}
            </div>
          </div>
        )}
        
        {/* First row - two columns */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="exam_name" className="text-right block">סוג בדיקה</Label>
            <Input
              id="exam_name"
              name="exam_name"
              value={formData.exam_name || ''}
              onChange={onInputChange}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="examiner" className="text-right block">בודק</Label>
            <UserSelect
              value={formData.user_id}
              onValueChange={onUserChange}
              users={users}
              autoDefaultToCurrentUser={!editingAppointment}
            />
          </div>
        </div>

        {/* Second row - two columns */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="time" className="text-right block">שעה</Label>
            <Input
              id="time"
              name="time"
              type="time"
              value={formData.time || ''}
              onChange={onInputChange}
              dir="rtl"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="date" className="text-right block">תאריך</Label>
            <Input
              id="date"
              name="date"
              type="date"
              value={formData.date || ''}
              onChange={onInputChange}
              className="justify-end"
              dir="rtl"
            />
          </div>
        </div>

        {/* Third row - full width */}
        <div className="space-y-2">
          <Label htmlFor="note" className="text-right block">הערות</Label>
          <Textarea
            id="note"
            name="note"
            value={formData.note || ''}
            onChange={onInputChange}
            dir="rtl"
          />
        </div>
      </div>
      <div className="flex justify-center gap-2 mt-4">
        <Button onClick={onSave} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'שמור'}
        </Button>
        <Button 
          variant="destructive" 
          size="icon"
          onClick={() => {
            if (editingAppointment) {
              onDelete(editingAppointment.id!)
            }
            onClose()
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </CustomModal>
  )
}

