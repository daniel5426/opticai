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
import { MoreHorizontal, ChevronDown, UserPlus, Users, Plus, Trash2, Edit } from "lucide-react"
import { Appointment, Client, User } from "@/lib/db/schema"
import { toast } from "sonner"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { cleanupModalArtifacts } from "@/lib/utils"
import { CustomModal } from "@/components/ui/custom-modal"
import { ClientWarningModal } from "@/components/ClientWarningModal"
import { UserSelect } from "@/components/ui/user-select"
import { useUser } from "@/contexts/UserContext"
import { Skeleton } from "@/components/ui/skeleton"
import { getClientById, getAllClients, createClient } from "@/lib/db/clients-db"
import { getUserById } from "@/lib/db/users-db"
import { createAppointment, updateAppointment, deleteAppointment } from "@/lib/db/appointments-db"
import { useNavigate } from "@tanstack/react-router"

interface AppointmentsTableProps {
  data: Appointment[]
  clientId: number
  onAppointmentChange: () => void
  onAppointmentDeleted: (appointmentId: number) => void
  onAppointmentDeleteFailed: () => void
  loading: boolean
}

interface AppointmentTableRowProps {
  appointment: Appointment
  onEdit: (appointment: Appointment) => void
  onDelete: (appointment: Appointment) => void
  onSendEmail: (id: number) => void
  clientId: number
}

function AppointmentTableRow({ appointment, onEdit, onDelete, onSendEmail, clientId }: AppointmentTableRowProps) {
  const [client, setClient] = React.useState<Client | null>(null)
  const [user, setUser] = React.useState<User | null>(null)
  const navigate = useNavigate()

  React.useEffect(() => {
    const loadClient = async () => {
      try {
        const clientData = await getClientById(appointment.client_id)
        setClient(clientData || null)
      } catch (error) {
        console.error('Error loading client:', error)
      }
    }
    loadClient()
  }, [appointment.client_id])

  React.useEffect(() => {
    const loadUser = async () => {
      if (appointment.user_id) {
        try {
          const userData = await getUserById(appointment.user_id)
          setUser(userData)
        } catch (error) {
          console.error('Error loading user:', error)
        }
      }
    }
    loadUser()
  }, [appointment.user_id])

  return (
    <TableRow>
      <TableCell
        onClick={() => onEdit(appointment)}
        className="cursor-pointer"
      >
        {appointment.date ? new Date(appointment.date).toLocaleDateString('he-IL') : ''}
      </TableCell>
      <TableCell
        onClick={() => onEdit(appointment)}
        className="cursor-pointer"
      >{appointment.time}</TableCell>
      {clientId === 0 && (
        <TableCell className="cursor-pointer text-blue-600 hover:underline"
          onClick={e => {
            e.stopPropagation();
            if (client) {
              navigate({ to: "/clients/$clientId", params: { clientId: String(client.id) }, search: { tab: 'appointments' } })
            }
          }}
        >{client ? `${client.first_name || ''} ${client.last_name || ''}`.trim() : 'טוען...'}</TableCell>
      )}
      <TableCell
        onClick={() => onEdit(appointment)}
        className="cursor-pointer"
      >{appointment.exam_name}</TableCell>
      <TableCell
        onClick={() => onEdit(appointment)}
        className="cursor-pointer"
      >{user?.username || ''}</TableCell>
      <TableCell
        onClick={() => onEdit(appointment)}
        className="cursor-pointer"
      >{appointment.note}</TableCell>
      <TableCell>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onEdit(appointment)
            }}
            title="עריכה"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation()
              onDelete(appointment)
            }}
            title="מחיקה"
          >
            <Trash2 className="h-4 w-4 text-red-600" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}

export function AppointmentsTable({ data, clientId, onAppointmentChange, onAppointmentDeleted, onAppointmentDeleteFailed, loading }: AppointmentsTableProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isAppointmentDialogOpen, setIsAppointmentDialogOpen] = useState(false)
  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false)
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const { currentUser } = useUser()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null)
  
  const [appointmentFormData, setAppointmentFormData] = useState<Omit<Appointment, 'id'>>({
    client_id: clientId,
    user_id: currentUser?.id,
    date: '',
    time: '',
    duration: 30,
    exam_name: '',
    note: ''
  })

  const [newClientFormData, setNewClientFormData] = useState<{
    first_name: string
    last_name: string
    phone_mobile: string
    email: string
    user_id?: number
    date: string
    time: string
    duration: number
    exam_name: string
    note: string
  }>({
    first_name: '',
    last_name: '',
    phone_mobile: '',
    email: '',
    user_id: currentUser?.id,
    date: '',
    time: '',
    duration: 30,
    exam_name: '',
    note: ''
  })

  const [existingClientWarning, setExistingClientWarning] = useState<{
    show: boolean
    clients: Client[]
    type: 'name' | 'phone' | 'email' | 'multiple'
  }>({
    show: false,
    clients: [],
    type: 'name'
  })

  const filteredData = data.filter((appointment) => {
    const searchableFields = [
      appointment.date || '',
      appointment.time || '',
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
      user_id: currentUser?.id,
      date: '',
      time: '',
      duration: 30,
      exam_name: '',
      note: ''
    })
    setNewClientFormData({
      first_name: '',
      last_name: '',
      phone_mobile: '',
      email: '',
      user_id: currentUser?.id,
      date: '',
      time: '',
      duration: 30,
      exam_name: '',
      note: ''
    })
    setSelectedClient(null)
    setEditingAppointment(null)
    setExistingClientWarning({ show: false, clients: [], type: 'name' })
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
      user_id: appointment.user_id || currentUser?.id,
      date: appointment.date || '',
      time: appointment.time || '',
      duration: appointment.duration || 30,
      exam_name: appointment.exam_name || '',
      note: appointment.note || ''
    })
    setIsAppointmentDialogOpen(true)
  }

  const handleClientSelect = async (selectedClientId: number) => {
    try {
      const client = await getClientById(selectedClientId)
      if (client) {
        setSelectedClient(client)
        setAppointmentFormData(prev => ({
          ...prev,
          client_id: selectedClientId,
          duration: 30
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
        const result = await updateAppointment({ ...appointmentFormData, id: editingAppointment.id })
        if (result) {
          toast.success("התור עודכן בהצלחה")
        } else {
          toast.error("שגיאה בעדכון התור")
        }
      } else {
        const result = await createAppointment(appointmentFormData)
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

  const checkForExistingClients = async () => {
    if (!newClientFormData.first_name.trim() || !newClientFormData.last_name.trim()) {
      toast.error("שם פרטי ושם משפחה הם שדות חובה")
      return false
    }

    try {
      const allClients = await getAllClients()
      const existingClients: Client[] = []
      let warningType: 'name' | 'phone' | 'email' | 'multiple' = 'name'

      const nameMatches = allClients.filter(client => 
        client.first_name?.toLowerCase().trim() === newClientFormData.first_name.toLowerCase().trim() &&
        client.last_name?.toLowerCase().trim() === newClientFormData.last_name.toLowerCase().trim()
      )

      const phoneMatches = newClientFormData.phone_mobile.trim() 
        ? allClients.filter(client => 
            client.phone_mobile?.trim() === newClientFormData.phone_mobile.trim()
          )
        : []

      const emailMatches = newClientFormData.email.trim() 
        ? allClients.filter(client => 
            client.email?.toLowerCase().trim() === newClientFormData.email.toLowerCase().trim()
          )
        : []

      const matchTypes = []
      if (nameMatches.length > 0) {
        existingClients.push(...nameMatches)
        matchTypes.push('name')
      }
      if (phoneMatches.length > 0) {
        existingClients.push(...phoneMatches)
        matchTypes.push('phone')
      }
      if (emailMatches.length > 0) {
        existingClients.push(...emailMatches)
        matchTypes.push('email')
      }

      if (matchTypes.length > 1) {
        warningType = 'multiple'
      } else if (matchTypes.length === 1) {
        warningType = matchTypes[0] as 'name' | 'phone' | 'email'
      }

      if (existingClients.length > 0) {
        const uniqueClients = existingClients.filter((client, index, self) => 
          index === self.findIndex(c => c.id === client.id)
        )
        setExistingClientWarning({
          show: true,
          clients: uniqueClients,
          type: warningType
        })
        return false
      }

      return true
    } catch (error) {
      console.error('Error checking for existing clients:', error)
      toast.error("שגיאה בבדיקת לקוחות קיימים")
      return false
    }
  }

  const handleSaveNewClientAndAppointment = async (forceCreate = false) => {
    try {
      if (!forceCreate) {
        const canProceed = await checkForExistingClients()
        if (!canProceed) return
      }

              const newClient = await createClient({
        first_name: newClientFormData.first_name,
        last_name: newClientFormData.last_name,
        phone_mobile: newClientFormData.phone_mobile,
        email: newClientFormData.email
      })

      if (newClient && newClient.id) {
        const appointmentData = {
          client_id: newClient.id,
          user_id: newClientFormData.user_id,
          date: newClientFormData.date,
          time: newClientFormData.time,
          duration: newClientFormData.duration,
          exam_name: newClientFormData.exam_name,
          note: newClientFormData.note
        }

        const result = await createAppointment(appointmentData)
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

  const handleUseExistingClient = async (existingClient: Client) => {
    try {
      const appointmentData = {
        client_id: existingClient.id!,
        user_id: newClientFormData.user_id,
        date: newClientFormData.date,
        time: newClientFormData.time,
        duration: newClientFormData.duration,
        exam_name: newClientFormData.exam_name,
        note: newClientFormData.note
      }

              const result = await createAppointment(appointmentData)
      if (result) {
        toast.success("תור נוצר עם לקוח קיים בהצלחה")
        closeAllDialogs()
        onAppointmentChange()
      } else {
        toast.error("שגיאה ביצירת התור")
      }
    } catch (error) {
      console.error('Error creating appointment with existing client:', error)
      toast.error("שגיאה ביצירת תור עם לקוח קיים")
    }
  }

  const handleDelete = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setIsDeleteModalOpen(true);
  }

  const handleDeleteConfirm = async () => {
    if (appointmentToDelete && appointmentToDelete.id !== undefined) {
      try {
        const deletedAppointmentId = appointmentToDelete.id;
        onAppointmentDeleted(deletedAppointmentId);
        toast.success("התור נמחק בהצלחה");

        const result = await deleteAppointment(deletedAppointmentId);
        if (result) {
          toast.success("התור נמחק בהצלחה")
          onAppointmentDeleted(deletedAppointmentId)
        } else {
          toast.error("שגיאה במחיקת התור")
          onAppointmentDeleteFailed()
        }
      } catch (error) {
        toast.error("שגיאה במחיקת התור")
        onAppointmentDeleteFailed()
      } finally {
        setAppointmentToDelete(null);
      }
    }
    setIsDeleteModalOpen(false);
  }

  const handleSendTestEmail = async (appointmentId: number) => {
    try {
      toast.info("שולח תזכורת...")
      const result = await window.electronAPI.emailSendTestReminder(appointmentId)
      if (result) {
        toast.success("תזכורת נשלחה בהצלחה")
      } else {
        toast.error("שגיאה בשליחת התזכורת")
      }
    } catch (error) {
      console.error('Error sending test email:', error)
      toast.error("שגיאה בשליחת התזכורת")
    }
  }

  return (
    <div className="space-y-4" style={{scrollbarWidth: 'none'}}>
      <div className="flex justify-between items-center" dir="rtl">        
        <div className="flex gap-2">
          <Input
            placeholder="חיפוש תורים..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-[250px] bg-card dark:bg-card" 
            dir="rtl"
          />
        </div>
        
        {clientId > 0 ? (
          <Button onClick={openDirectAppointmentDialog}
          >תור חדש
              <Plus className="h-4 w-4 mr-2" />
              </Button>
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
              <Label htmlFor="new-first-name" className="text-right block">שם פרטי *</Label>
              <Input
                id="new-first-name"
                name="first_name"
                value={newClientFormData.first_name}
                onChange={handleNewClientInputChange}
                dir="rtl"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-last-name" className="text-right block">שם משפחה *</Label>
              <Input
                id="new-last-name"
                name="last_name"
                value={newClientFormData.last_name}
                onChange={handleNewClientInputChange}
                dir="rtl"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="new-email" className="text-right block">אימייל</Label>
              <Input
                id="new-email"
                name="email"
                type="email"
                value={newClientFormData.email}
                onChange={handleNewClientInputChange}
                dir="rtl"
              />
            </div>
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
          </div>
          <div className="grid grid-cols-2 gap-4">
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
          </div>
          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="new-examiner" className="text-right block">בודק</Label>
              <UserSelect
                value={newClientFormData.user_id}
                onValueChange={(userId) => setNewClientFormData(prev => ({ ...prev, user_id: userId }))}
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
          <Button onClick={() => handleSaveNewClientAndAppointment(false)}>שמור</Button>
          <Button variant="outline" onClick={closeAllDialogs}>ביטול</Button>
        </div>
      </CustomModal>

      {/* Appointment Modal */}
      <CustomModal
        isOpen={isAppointmentDialogOpen}
        onClose={closeAllDialogs}
        title={editingAppointment ? 'עריכת תור' : selectedClient ? `תור חדש - ${selectedClient.first_name} ${selectedClient.last_name}` : 'תור חדש'}
        className="w-md"
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="exam_name" className="text-right block">סוג בדיקה</Label>
              <Input
                id="exam_name"
                name="exam_name"
                value={appointmentFormData.exam_name}
                onChange={handleAppointmentInputChange}
                dir="rtl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="examiner" className="text-right block">בודק</Label>
              <UserSelect
                value={appointmentFormData.user_id}
                onValueChange={(userId) => setAppointmentFormData(prev => ({ ...prev, user_id: userId }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="note" className="text-right block">הערות</Label>
            <Textarea
              id="note"
              name="note"
              value={appointmentFormData.note}
              onChange={handleAppointmentInputChange}
              dir="rtl"
            />
          </div>
        </div>
        <div className="flex justify-start gap-2 mt-4">
          <Button onClick={handleSaveAppointment}>שמור</Button>
          <Button variant="outline" onClick={closeAllDialogs}>ביטול</Button>
        </div>
      </CustomModal>

      {/* Client Warning Modal */}
      <ClientWarningModal
        isOpen={existingClientWarning.show}
        onClose={() => setExistingClientWarning({ show: false, clients: [], type: 'name' })}
        clients={existingClientWarning.clients}
        warningType={existingClientWarning.type}
        onUseExistingClient={handleUseExistingClient}
        onCreateNewAnyway={() => handleSaveNewClientAndAppointment(true)}
      />

      <CustomModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="מחיקת תור"
        description={appointmentToDelete ? `האם אתה בטוח שברצונך למחוק את התור בתאריך ${appointmentToDelete.date ? new Date(appointmentToDelete.date).toLocaleDateString('he-IL') : ''}?` : "האם אתה בטוח שברצונך למחוק את התור?"}
        onConfirm={handleDeleteConfirm}
        confirmText="מחק"
        cancelText="בטל"
      />

      <div className="rounded-md border bg-card">
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">תאריך</TableHead>
              <TableHead className="text-right">שעה</TableHead>
              {clientId === 0 && <TableHead className="text-right">לקוח</TableHead>}
              <TableHead className="text-right">סוג בדיקה</TableHead>
              <TableHead className="text-right">בודק</TableHead>
              <TableHead className="text-right">הערות</TableHead>
              <TableHead className="text-right w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 10 }).map((_, i) => (
                <TableRow key={i}>
                </TableRow>
              ))
            ) : filteredData.length > 0 ? (
              filteredData.map((appointment) => (
                <AppointmentTableRow
                  key={appointment.id}
                  appointment={appointment}
                  onEdit={openEditDialog}
                  onDelete={handleDelete}
                  onSendEmail={handleSendTestEmail}
                  clientId={clientId}
                />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  לא נמצאו תורים
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
} 