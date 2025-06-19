import React, { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MoreHorizontal } from "lucide-react"
import { Appointment } from "@/lib/db/schema"
import { toast } from "sonner"
import { ClientSelectModal } from "@/components/ClientSelectModal"

interface AppointmentsTableProps {
  data: Appointment[]
  clientId: number
  onAppointmentChange: () => void
}

export function AppointmentsTable({ data, clientId, onAppointmentChange }: AppointmentsTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [formData, setFormData] = useState<Omit<Appointment, 'id'>>({
    client_id: clientId,
    date: '',
    time: '',
    client_name: '',
    exam_name: '',
    note: ''
  })

  const filteredData = data.filter((appointment) => {
    const searchableFields = [
      appointment.date || '',
      appointment.time || '',
      appointment.client_name || '',
      appointment.exam_name || '',
      appointment.note || '',
    ]

    return searchableFields.some(
      (field) => field.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const openCreateDialog = () => {
    setEditingAppointment(null)
    setFormData({
      client_id: clientId,
      date: '',
      time: '',
      client_name: '',
      exam_name: '',
      note: ''
    })
    setIsDialogOpen(true)
  }

  const openEditDialog = (appointment: Appointment, fromDropdown = false) => {
    setEditingAppointment(appointment)
    setFormData({
      client_id: appointment.client_id,
      date: appointment.date || '',
      time: appointment.time || '',
      client_name: appointment.client_name || '',
      exam_name: appointment.exam_name || '',
      note: appointment.note || ''
    })
    if (fromDropdown) {
      setTimeout(() => setIsDialogOpen(true), 100)
    } else {
      setIsDialogOpen(true)
    }
  }

  const handleSave = async () => {
    try {
      if (editingAppointment) {
        const result = await window.electronAPI.updateAppointment({ ...formData, id: editingAppointment.id })
        if (result) {
          toast.success("התור עודכן בהצלחה")
        } else {
          toast.error("שגיאה בעדכון התור")
        }
      } else {
        console.log('Creating appointment with data:', formData)
        const result = await window.electronAPI.createAppointment(formData)
        if (result) {
          toast.success("התור נוצר בהצלחה")
        } else {
          toast.error("שגיאה ביצירת התור")
        }
      }
      closeDialog()
      onAppointmentChange()
    } catch (error) {
      console.error('Error saving appointment:', error)
      toast.error("שגיאה בשמירת התור")
    }
  }

  const closeDialog = () => {
    setIsDialogOpen(false)
    setTimeout(() => {
      setEditingAppointment(null)
      setFormData({
        client_id: clientId,
        date: '',
        time: '',
        client_name: '',
        exam_name: '',
        note: ''
      })
    }, 100)
  }

  const handleDelete = async (appointmentId: number) => {
    try {
      const result = await window.electronAPI.deleteAppointment(appointmentId)
      if (result) {
        toast.success("התור נמחק בהצלחה")
        onAppointmentChange()
      } else {
        toast.error("שגיאה במחיקת התור")
      }
    } catch (error) {
      toast.error("שגיאה במחיקת התור")
    }
  }

  return (
    <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
      <div className="flex justify-between items-center">        
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש תורים..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px]" 
            dir="rtl"
          />
        </div>
        {clientId > 0 ? (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} >
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>תור חדש</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] [&>button]:left-4 [&>button]:right-auto" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-right">{editingAppointment ? 'עריכת תור' : 'תור חדש'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4" dir="rtl">
                <div className="space-y-2">
                  <Label htmlFor="time" className="text-right block">שעה</Label>
                  <Input
                    id="time"
                    name="time"
                    type="time"
                    value={formData.time}
                    onChange={handleInputChange}
                    style={{ textAlign: 'right', direction: 'rtl', paddingLeft: '55%' }}
                    className="[&::-webkit-datetime-edit]:text-right"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="date" className="text-right block">תאריך</Label>
                  <Input
                    id="date"
                    name="date"
                    type="date"
                    value={formData.date}
                    onChange={handleInputChange}
                    style={{ textAlign: 'right', direction: 'rtl', paddingLeft: '25%' }}
                    className="[&::-webkit-datetime-edit]:text-right"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="client_name" className="text-right">שם לקוח</Label>
                <Input
                  id="client_name"
                  name="client_name"
                  value={formData.client_name}
                  onChange={handleInputChange}
                  className="col-span-3"
                  dir="rtl"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="exam_name" className="text-right">סוג בדיקה</Label>
                <Input
                  id="exam_name"
                  name="exam_name"
                  value={formData.exam_name}
                  onChange={handleInputChange}
                  className="col-span-3"
                  dir="rtl"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="note" className="text-right">הערות</Label>
                <Textarea
                  id="note"
                  name="note"
                  value={formData.note}
                  onChange={handleInputChange}
                  className="col-span-3"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="flex justify-start gap-2">
              <Button onClick={handleSave}>שמור</Button>
              <Button variant="outline" onClick={closeDialog}>
                ביטול
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        ) : (
          <ClientSelectModal
            triggerText="תור חדש"
            onClientSelect={(selectedClientId) => {
              setEditingAppointment(null)
              setFormData({
                client_id: selectedClientId,
                date: '',
                time: '',
                client_name: '',
                exam_name: '',
                note: ''
              })
              setIsDialogOpen(true)
            }}
          />
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen} >
        <DialogContent className="sm:max-w-[425px] [&>button]:left-4 [&>button]:right-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-right">{editingAppointment ? 'עריכת תור' : 'תור חדש'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4" dir="rtl">
              <div className="space-y-2">
                <Label htmlFor="time" className="text-right block">שעה</Label>
                <Input
                  id="time"
                  name="time"
                  type="time"
                  value={formData.time}
                  onChange={handleInputChange}
                  style={{ textAlign: 'right', direction: 'rtl', paddingLeft: '55%' }}
                  className="[&::-webkit-datetime-edit]:text-right"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date" className="text-right block">תאריך</Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={formData.date}
                  onChange={handleInputChange}
                  style={{ textAlign: 'right', direction: 'rtl', paddingLeft: '25%' }}
                  className="[&::-webkit-datetime-edit]:text-right"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="client_name" className="text-right">שם לקוח</Label>
              <Input
                id="client_name"
                name="client_name"
                value={formData.client_name}
                onChange={handleInputChange}
                className="col-span-3"
                dir="rtl"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="exam_name" className="text-right">סוג בדיקה</Label>
              <Input
                id="exam_name"
                name="exam_name"
                value={formData.exam_name}
                onChange={handleInputChange}
                className="col-span-3"
                dir="rtl"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="note" className="text-right">הערות</Label>
              <Textarea
                id="note"
                name="note"
                value={formData.note}
                onChange={handleInputChange}
                className="col-span-3"
                dir="rtl"
              />
            </div>
          </div>
          <div className="flex justify-start gap-2">
            <Button onClick={handleSave}>שמור</Button>
            <Button variant="outline" onClick={closeDialog}>
              ביטול
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-md border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">שעה</TableHead>
              <TableHead className="text-right">שם לקוח</TableHead>
              <TableHead className="text-right">סוג בדיקה</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="text-right w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  לא נמצאו תורים לתצוגה
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((appointment) => {
                return (
                  <TableRow 
                    key={appointment.id}
                    className="cursor-pointer"
                    onClick={() => openEditDialog(appointment)}
                  >
                    <TableCell>
                      {appointment.date ? new Date(appointment.date).toLocaleDateString('he-IL') : ''}
                    </TableCell>
                    <TableCell>{appointment.time}</TableCell>
                    <TableCell>{appointment.client_name}</TableCell>
                    <TableCell>{appointment.exam_name}</TableCell>
                    <TableCell>{appointment.note}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <span className="sr-only">פתח תפריט</span>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation()
                            openEditDialog(appointment, true)
                          }}>
                            עריכה
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={(e) => {
                              e.stopPropagation()
                              appointment.id && handleDelete(appointment.id)
                            }}
                            className="text-red-600"
                          >
                            מחיקה
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 