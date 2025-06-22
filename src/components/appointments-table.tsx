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
import { MoreHorizontal, ChevronDown, UserPlus, Users } from "lucide-react"
import { Appointment, Client } from "@/lib/db/schema"
import { toast } from "sonner"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { cleanupModalArtifacts } from "@/lib/utils"
import { CustomModal } from "@/components/ui/custom-modal"

interface AppointmentsTableProps {
  data: Appointment[]
  clientId: number
  onAppointmentChange: () => void
}

export function AppointmentsTable({ data, clientId, onAppointmentChange }: AppointmentsTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false)
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false)
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  
  const [appointmentFormData, setAppointmentFormData] = useState<Omit<Appointment, 'id'>>({
    client_id: clientId,
    date: '',
    time: '',
    first_name: '',
    last_name: '',
    phone_mobile: '',
    exam_name: '',
    note: ''
  })

  const [newClientFormData, setNewClientFormData] = useState<{
    first_name: string
    last_name: string
    phone_mobile: string
    date: string
    time: string
    exam_name: string
    note: string
  }>({
    first_name: '',
    last_name: '',
    phone_mobile: '',
    date: '',
    time: '',
    exam_name: '',
    note: ''
  })

  const filteredData = data.filter((appointment) => {
    const searchableFields = [
      appointment.date || '',
      appointment.time || '',
      appointment.first_name || '',
      appointment.last_name || '',
      appointment.phone_mobile || '',
      appointment.exam_name || '',
      appointment.note || '',
    ]

    return searchableFields.some(
      (field) => field.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })

  const resetAllForms = () => {
    setAppointmentFormData({
      client_id: clientId,
      date: '',
      time: '',
      first_name: '',
      last_name: '',
      phone_mobile: '',
      exam_name: '',
      note: ''
    })
    setNewClientFormData({
      first_name: '',
      last_name: '',
      phone_mobile: '',
      date: '',
      time: '',
      exam_name: '',
      note: ''
    })
    setSelectedClient(null)
    setEditingAppointment(null)
  }

  const closeAllDialogs = () => {
    setIsAppointmentDialogOpen(false)
    setIsNewClientDialogOpen(false)
    setIsClientSelectOpen(false)
    resetAllForms()
    setTimeout(() => {
      cleanupModalArtifacts()
    }, 100)
  }

  const handleAppointmentInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setAppointmentFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleNewClientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNewClientFormData(prev => ({ ...prev, [name]: value }))
  }

  const openDirectAppointmentDialog = () => {
    resetAllForms()
    setIsAppointmentDialogOpen(true)
  }

  const openNewClientDialog = () => {
    resetAllForms()
    setIsNewClientDialogOpen(true)
  }

  const openOldClientFlow = () => {
    resetAllForms()
    setIsClientSelectOpen(true)
  }

  const openEditDialog = (appointment: Appointment) => {
    setEditingAppointment(appointment)
    setAppointmentFormData({
      client_id: appointment.client_id,
      date: appointment.date || '',
      time: appointment.time || '',
      first_name: appointment.first_name || '',
      last_name: appointment.last_name || '',
      phone_mobile: appointment.phone_mobile || '',
      exam_name: appointment.exam_name || '',
      note: appointment.note || ''
    })
    setIsAppointmentDialogOpen(true)
  }

  const handleClientSelect = async (selectedClientId: number) => {
    try {
      const client = await window.electronAPI.getClient(selectedClientId)
      if (client) {
        setSelectedClient(client)
        setAppointmentFormData(prev => ({
          ...prev,
          client_id: selectedClientId,
          first_name: client.first_name || '',
          last_name: client.last_name || '',
          phone_mobile: client.phone_mobile || ''
        }))
        setIsClientSelectOpen(false)
        setIsAppointmentDialogOpen(true)
      }
    } catch (error) {
      console.error('Error loading client:', error)
      toast.error("שגיאה בטעינת פרטי הלקוח")
    }
  }

  const handleSaveAppointment = async () => {
    try {
      if (editingAppointment) {
        const result = await window.electronAPI.updateAppointment({ ...appointmentFormData, id: editingAppointment.id })
        if (result) {
          toast.success("התור עודכן בהצלחה")
        } else {
          toast.error("שגיאה בעדכון התור")
        }
      } else {
        const result = await window.electronAPI.createAppointment(appointmentFormData)
        if (result) {
          toast.success("התור נוצר בהצלחה")
        } else {
          toast.error("שגיאה ביצירת התור")
        }
      }
      closeAllDialogs()
      onAppointmentChange()
    } catch (error) {
      console.error('Error saving appointment:', error)
      toast.error("שגיאה בשמירת התור")
    }
  }

  const handleSaveNewClientAndAppointment = async () => {
    try {
      const newClient = await window.electronAPI.createClient({
        first_name: newClientFormData.first_name,
        last_name: newClientFormData.last_name,
        phone_mobile: newClientFormData.phone_mobile
      })

      if (newClient && newClient.id) {
        const appointmentData = {
          client_id: newClient.id,
          date: newClientFormData.date,
          time: newClientFormData.time,
          first_name: newClientFormData.first_name,
          last_name: newClientFormData.last_name,
          phone_mobile: newClientFormData.phone_mobile,
          exam_name: newClientFormData.exam_name,
          note: newClientFormData.note
        }

        const result = await window.electronAPI.createAppointment(appointmentData)
        if (result) {
          toast.success("לקוח חדש ותור נוצרו בהצלחה")
          closeAllDialogs()
          onAppointmentChange()
        } else {
          toast.error("שגיאה ביצירת התור")
        }
      } else {
        toast.error("שגיאה ביצירת הלקוח")
      }
    } catch (error) {
      console.error('Error creating client and appointment:', error)
      toast.error("שגיאה ביצירת לקוח ותור")
    }
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
          <Button onClick={openDirectAppointmentDialog}>תור חדש</Button>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                תור חדש <ChevronDown className="h-4 w-4 mr-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={openNewClientDialog}>
                <UserPlus className="h-4 w-4 ml-2" />
                לקוח חדש
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openOldClientFlow}>
                <Users className="h-4 w-4 ml-2" />
                לקוח קיים
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Client Select Modal */}
      <ClientSelectModal
        isOpen={isClientSelectOpen}
        onClientSelect={handleClientSelect}
        onClose={() => setIsClientSelectOpen(false)}
      />

      {/* New Client Modal */}
      <CustomModal
        isOpen={isNewClientDialogOpen}
        onClose={closeAllDialogs}
        title="לקוח חדש ותור"
        className="sm:max-w-[500px]"
      >
        <div className="grid gap-4 max-h-[60vh] overflow-auto p-1" style={{scrollbarWidth: 'none'}}>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-first-name" className="text-right block">שם פרטי</Label>
              <Input
                id="new-first-name"
                name="first_name"
                value={newClientFormData.first_name}
                onChange={handleNewClientInputChange}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-last-name" className="text-right block">שם משפחה</Label>
              <Input
                id="new-last-name"
                name="last_name"
                value={newClientFormData.last_name}
                onChange={handleNewClientInputChange}
                dir="rtl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-phone" className="text-right block">טלפון נייד</Label>
              <Input
                id="new-phone"
                name="phone_mobile"
                value={newClientFormData.phone_mobile}
                onChange={handleNewClientInputChange}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-exam-name" className="text-right block">סוג בדיקה</Label>
              <Input
                id="new-exam-name"
                name="exam_name"
                value={newClientFormData.exam_name}
                onChange={handleNewClientInputChange}
                dir="rtl"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-time" className="text-right block">שעה</Label>
              <Input
                id="new-time"
                name="time"
                type="time"
                value={newClientFormData.time}
                onChange={handleNewClientInputChange}
                style={{ textAlign: 'right', direction: 'rtl', paddingLeft: '55%' }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-date" className="text-right block">תאריך</Label>
              <Input
                id="new-date"
                name="date"
                type="date"
                value={newClientFormData.date}
                onChange={handleNewClientInputChange}
                style={{ textAlign: 'right', direction: 'rtl', paddingLeft: '25%' }}
              />
            </div>
          </div>
          <div className="space-y-2 pb-2">
            <Label htmlFor="new-note" className="text-right block">הערות</Label>
            <Textarea
              id="new-note"
              name="note"
              value={newClientFormData.note}
              onChange={handleNewClientInputChange}
              dir="rtl"
            />
          </div>
        </div>
        <div className="flex justify-start gap-2 mt-4">
          <Button onClick={handleSaveNewClientAndAppointment}>שמור</Button>
          <Button variant="outline" onClick={closeAllDialogs}>ביטול</Button>
        </div>
      </CustomModal>

      {/* Appointment Modal */}
      <CustomModal
        isOpen={isAppointmentDialogOpen}
        onClose={closeAllDialogs}
        title={editingAppointment ? 'עריכת תור' : selectedClient ? `תור חדש - ${selectedClient.first_name} ${selectedClient.last_name}` : 'תור חדש'}
        className="sm:max-w-[425px]"
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time" className="text-right block">שעה</Label>
              <Input
                id="time"
                name="time"
                type="time"
                value={appointmentFormData.time}
                onChange={handleAppointmentInputChange}
                style={{ textAlign: 'right', direction: 'rtl', paddingLeft: '55%' }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date" className="text-right block">תאריך</Label>
              <Input
                id="date"
                name="date"
                type="date"
                value={appointmentFormData.date}
                onChange={handleAppointmentInputChange}
                style={{ textAlign: 'right', direction: 'rtl', paddingLeft: '25%' }}
              />
            </div>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="exam_name" className="text-right">סוג בדיקה</Label>
            <Input
              id="exam_name"
              name="exam_name"
              value={appointmentFormData.exam_name}
              onChange={handleAppointmentInputChange}
              className="col-span-3"
              dir="rtl"
            />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="note" className="text-right">הערות</Label>
            <Textarea
              id="note"
              name="note"
              value={appointmentFormData.note}
              onChange={handleAppointmentInputChange}
              className="col-span-3"
              dir="rtl"
            />
          </div>
        </div>
        <div className="flex justify-start gap-2 mt-4">
          <Button onClick={handleSaveAppointment}>שמור</Button>
          <Button variant="outline" onClick={closeAllDialogs}>ביטול</Button>
        </div>
      </CustomModal>

      <div className="rounded-md border">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">שעה</TableHead>
              <TableHead className="text-right">שם פרטי</TableHead>
              <TableHead className="text-right">שם משפחה</TableHead>
              <TableHead className="text-right">טלפון</TableHead>
              <TableHead className="text-right">סוג בדיקה</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="text-right w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
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
                    <TableCell>{appointment.first_name}</TableCell>
                    <TableCell>{appointment.last_name}</TableCell>
                    <TableCell>{appointment.phone_mobile}</TableCell>
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
                            openEditDialog(appointment)
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