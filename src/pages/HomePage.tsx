import React, { useState, useEffect } from "react"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CalendarDays, Users, Clock, UserPlus, Plus, ChevronDown, ChevronUp, GripVertical, Edit } from "lucide-react"
import { getAllAppointments } from "@/lib/db/appointments-db"
import { getAllClients } from "@/lib/db/clients-db"
import { getSettings } from "@/lib/db/settings-db"
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers"
import { Appointment, Client, Settings } from "@/lib/db/schema"
import { format, isToday, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMinutes, isBefore, isAfter } from "date-fns"
import { he } from "date-fns/locale"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { toast } from "sonner"
import { cleanupModalArtifacts } from "@/lib/utils"
import { CustomModal } from "@/components/ui/custom-modal"

interface TimeSlot {
  type: 'appointment' | 'free' | 'free-slot' | 'collapse'
  startTime: string
  endTime: string
  appointment?: Appointment
  duration?: number
  expanded?: boolean
  freeSlots?: TimeSlot[]
}

interface DragData {
  appointment: Appointment
  originalIndex: number
  sourceSlot: TimeSlot
}

export default function HomePage() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)

  const [draggedData, setDraggedData] = useState<DragData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('')
  const [formData, setFormData] = useState<Omit<Appointment, 'id'>>({
    client_id: 0,
    date: '',
    time: '',
    first_name: '',
    last_name: '',
    phone_mobile: '',
    exam_name: '',
    note: ''
  })

  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false)
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  
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

  const loadData = async () => {
    try {
      setLoading(true)
      const [appointmentsData, clientsData, settingsData] = await Promise.all([
        getAllAppointments(),
        getAllClients(),
        getSettings()
      ])
      setAppointments(appointmentsData)
      setClients(clientsData)
      setSettings(settingsData)
      
      if (settingsData) {
        await applyThemeColorsFromSettings(settingsData)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // This effect will safely open the appointment modal after a client is selected
  // and the selection modal has closed.
  useEffect(() => {
    if (!isClientSelectOpen && selectedClient) {
      setIsCreateModalOpen(true)
    }
  }, [isClientSelectOpen, selectedClient])

  // Add focus restoration when all modals are closed
  useEffect(() => {
    if (!isCreateModalOpen && !isNewClientDialogOpen && !isClientSelectOpen) {
      // Force focus back to the document body
      setTimeout(() => {
        document.body.focus()
        // Remove any lingering backdrop elements
        const backdrops = document.querySelectorAll('[data-radix-portal]')
        backdrops.forEach(backdrop => {
          if (backdrop.innerHTML === '') {
            backdrop.remove()
          }
        })
      }, 100)
    }
  }, [isCreateModalOpen, isNewClientDialogOpen, isClientSelectOpen])

  // Refresh data when component mounts or when returning to page
  useEffect(() => {
    const handleFocus = () => {
      loadData()
    }
    
    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Filter appointments for selected date
  const selectedDateAppointments = appointments.filter(appointment => {
    if (!appointment.date) return false
    try {
      const appointmentDate = new Date(appointment.date)
      return appointmentDate.toDateString() === selectedDate.toDateString()
    } catch {
      return false
    }
  })

  // Filter appointments for today
  const todayAppointments = appointments.filter(appointment => {
    if (!appointment.date) return false
    try {
      const appointmentDate = new Date(appointment.date)
      return isToday(appointmentDate)
    } catch {
      return false
    }
  })

  // Filter new clients this month
  const thisMonthNewClients = clients.filter(client => {
    if (!client.file_creation_date) return false
    try {
      const creationDate = new Date(client.file_creation_date)
      const now = new Date()
      return isWithinInterval(creationDate, {
        start: startOfMonth(now),
        end: endOfMonth(now)
      })
    } catch {
      return false
    }
  })

  // Get settings values or use defaults
  const WORK_START = settings?.work_start_time || "08:00"
  const WORK_END = settings?.work_end_time || "18:00"
  const APPOINTMENT_DURATION = settings?.appointment_duration || 30
  const BREAK_START = settings?.break_start_time || ""
  const BREAK_END = settings?.break_end_time || ""
  
  // Calculate work day stats
  const workStartTime = parseISO(`2000-01-01T${WORK_START}`)
  const workEndTime = parseISO(`2000-01-01T${WORK_END}`)
  const WORK_DAY_MINUTES = (workEndTime.getTime() - workStartTime.getTime()) / (1000 * 60)
  const TOTAL_SLOTS = Math.floor(WORK_DAY_MINUTES / APPOINTMENT_DURATION)
  const todayFreeSlots = TOTAL_SLOTS - todayAppointments.length

  // Generate appointment slots from free time (always expanded)
  const generateFreeSlots = (startTime: string, endTime: string): TimeSlot[] => {
    const slots: TimeSlot[] = []
    const start = parseISO(`2000-01-01T${startTime}`)
    const end = parseISO(`2000-01-01T${endTime}`)
    let current = start

    while (current < end) {
      const slotEnd = addMinutes(current, APPOINTMENT_DURATION)
      if (slotEnd <= end) {
        slots.push({
          type: 'free-slot',
          startTime: format(current, 'HH:mm'),
          endTime: format(slotEnd, 'HH:mm'),
          duration: APPOINTMENT_DURATION
        })
      }
      current = slotEnd
    }

    return slots
  }

  // Helper function to check if time is within break
  const isBreakTime = (time: string): boolean => {
    if (!BREAK_START || !BREAK_END) return false
    return time >= BREAK_START && time < BREAK_END
  }

  // Helper function to add break slot if needed
  const addBreakSlotIfNeeded = (currentTime: string, nextTime: string, slots: TimeSlot[]) => {
    if (!BREAK_START || !BREAK_END) return currentTime

    const breakStart = parseISO(`2000-01-01T${BREAK_START}`)
    const breakEnd = parseISO(`2000-01-01T${BREAK_END}`)
    const current = parseISO(`2000-01-01T${currentTime}`)
    const next = parseISO(`2000-01-01T${nextTime}`)

    // Check if break time falls between current and next time
    if (current <= breakStart && breakEnd <= next) {
      // Add free time before break if any
      if (currentTime < BREAK_START) {
        const freeStartTime = parseISO(`2000-01-01T${currentTime}`)
        const freeEndTime = breakStart
        const freeDuration = (freeEndTime.getTime() - freeStartTime.getTime()) / (1000 * 60)
        
        if (freeDuration > 0) {
          slots.push(...generateFreeSlots(currentTime, BREAK_START))
        }
      }

      // Add break slot
              slots.push({
          type: 'appointment',
          startTime: BREAK_START,
          endTime: BREAK_END,
          appointment: {
            id: -1,
            client_id: -1,
            date: format(selectedDate, 'yyyy-MM-dd'),
            time: BREAK_START,
            first_name: 'הפסקה',
            last_name: '',
            phone_mobile: '',
            exam_name: 'זמן הפסקה',
            note: 'הפסקה'
          },
          duration: (breakEnd.getTime() - breakStart.getTime()) / (1000 * 60)
        })

      return BREAK_END
    }

    return currentTime
  }

  // Generate time slots with free time between appointments
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = []

    // Sort appointments by time
    const sortedAppointments = selectedDateAppointments
      .filter(apt => apt.time)
      .sort((a, b) => a.time!.localeCompare(b.time!))

    if (sortedAppointments.length === 0) {
      // No appointments - show full day as free with break if configured
      let currentTime = WORK_START
      
      // Add break time if configured
      currentTime = addBreakSlotIfNeeded(WORK_START, WORK_END, slots)
      
      // Add remaining free time after break (if any)
      if (currentTime < WORK_END) {
        const freeStartTime = parseISO(`2000-01-01T${currentTime}`)
        const freeEndTime = parseISO(`2000-01-01T${WORK_END}`)
        const freeDuration = (freeEndTime.getTime() - freeStartTime.getTime()) / (1000 * 60)
        
        if (freeDuration > 0) {
          slots.push(...generateFreeSlots(currentTime, WORK_END))
        }
      }
      
      // If no break time and no slots added, add full day
      if (slots.length === 0) {
        slots.push(...generateFreeSlots(WORK_START, WORK_END))
      }
      
      return slots
    }

    let currentTime = WORK_START

    sortedAppointments.forEach((appointment, index) => {
      const appointmentTime = appointment.time!
      const appointmentEndTime = format(addMinutes(parseISO(`2000-01-01T${appointmentTime}`), APPOINTMENT_DURATION), 'HH:mm')

      // Check for break time before this appointment
      const nextAppointmentTime = index < sortedAppointments.length - 1 ? sortedAppointments[index + 1].time! : WORK_END
      currentTime = addBreakSlotIfNeeded(currentTime, appointmentTime, slots)

      // Add free time before this appointment
      if (appointmentTime > currentTime) {
        const freeStartTime = parseISO(`2000-01-01T${currentTime}`)
        const freeEndTime = parseISO(`2000-01-01T${appointmentTime}`)
        const freeDuration = (freeEndTime.getTime() - freeStartTime.getTime()) / (1000 * 60)
        
        if (freeDuration > 0) {
          slots.push(...generateFreeSlots(currentTime, appointmentTime))
        }
      }

      // Add the appointment (skip if it's during break time)
      if (!isBreakTime(appointmentTime)) {
        slots.push({
          type: 'appointment',
          startTime: appointmentTime,
          endTime: appointmentEndTime,
          appointment,
          duration: APPOINTMENT_DURATION
        })
      }

      currentTime = appointmentEndTime
    })

    // Check for break time after last appointment
    currentTime = addBreakSlotIfNeeded(currentTime, WORK_END, slots)

    // Add free time after last appointment until end of work day
    if (currentTime < WORK_END) {
      const freeStartTime = parseISO(`2000-01-01T${currentTime}`)
      const freeEndTime = parseISO(`2000-01-01T${WORK_END}`)
      const freeDuration = (freeEndTime.getTime() - freeStartTime.getTime()) / (1000 * 60)
      
      if (freeDuration > 0) {
        slots.push(...generateFreeSlots(currentTime, WORK_END))
      }
    }

    return slots
  }

  const timeSlots = generateTimeSlots()

  const resetAllForms = () => {
    setFormData({
      client_id: 0,
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
  }

  const closeAllDialogs = () => {
    setIsCreateModalOpen(false)
    setIsNewClientDialogOpen(false)
    setIsClientSelectOpen(false)
    setEditingAppointment(null)
    resetAllForms()
  }

  const openDirectAppointmentModal = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot)
    resetAllForms()
    setFormData({
      client_id: 0,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: timeSlot,
      first_name: '',
      last_name: '',
      phone_mobile: '',
      exam_name: '',
      note: ''
    })
    setIsCreateModalOpen(true)
  }

  const openNewClientModal = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot)
    resetAllForms()
    setNewClientFormData(prev => ({
      ...prev,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: timeSlot
    }))
    setIsNewClientDialogOpen(true)
  }

  const openOldClientFlow = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot)
    resetAllForms()
    setIsClientSelectOpen(true)
  }

  const openEditDialog = async (appointment: Appointment) => {
    try {
      setEditingAppointment(appointment)
      const client = await window.electronAPI.getClient(appointment.client_id)
      if (client) {
        setSelectedClient(client)
      }
      setFormData({
        client_id: appointment.client_id,
        date: appointment.date || '',
        time: appointment.time || '',
        first_name: appointment.first_name || '',
        last_name: appointment.last_name || '',
        phone_mobile: appointment.phone_mobile || '',
        exam_name: appointment.exam_name || '',
        note: appointment.note || ''
      })
      setIsCreateModalOpen(true)
    } catch (error) {
      console.error('Error loading appointment for edit:', error)
    }
  }

  const handleClientSelect = async (selectedClientId: number) => {
    try {
      const client = await window.electronAPI.getClient(selectedClientId)
      if (client) {
        setSelectedClient(client)
        setFormData(prev => ({
          ...prev,
          client_id: selectedClientId,
          date: format(selectedDate, 'yyyy-MM-dd'),
          time: selectedTimeSlot,
          first_name: client.first_name || '',
          last_name: client.last_name || '',
          phone_mobile: client.phone_mobile || '',
          exam_name: '',
          note: ''
        }))
        // Just close the current modal. The useEffect will handle opening the next one.
        setIsClientSelectOpen(false)
      }
    } catch (error) {
      console.error('Error loading client:', error)
      toast.error("שגיאה בטעינת פרטי הלקוח")
    }
  }

  // Handle saving new appointment
  const handleSaveAppointment = async () => {
    try {
      if (editingAppointment) {
        const result = await window.electronAPI.updateAppointment({ ...formData, id: editingAppointment.id })
        if (result) {
          toast.success("התור עודכן בהצלחה")
          await loadData()
          closeAllDialogs()
        } else {
          toast.error("שגיאה בעדכון התור")
        }
      } else {
        const result = await window.electronAPI.createAppointment(formData)
        if (result) {
          toast.success("התור נוצר בהצלחה")
          await loadData()
          closeAllDialogs()
        } else {
          toast.error("שגיאה ביצירת התור")
        }
      }
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
          await loadData()
          closeAllDialogs()
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

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleNewClientInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNewClientFormData(prev => ({ ...prev, [name]: value }))
  }

  // Handle drag start
  const handleDragStart = (e: React.DragEvent, appointment: Appointment, slot: TimeSlot, index: number) => {
    const dragData: DragData = {
      appointment,
      originalIndex: index,
      sourceSlot: slot
    }
    setDraggedData(dragData)
    e.dataTransfer.effectAllowed = 'move'
  }

  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  // Handle drop
  const handleDrop = async (e: React.DragEvent, targetSlot: TimeSlot) => {
    e.preventDefault()
    
    if (!draggedData) return

    try {
      if (targetSlot.type === 'appointment' && targetSlot.appointment) {
        // Swapping two appointments
        const draggedAppointment = draggedData.appointment
        const targetAppointment = targetSlot.appointment
        
        // Swap the times
        const updatedDragged = {
          ...draggedAppointment,
          time: targetAppointment.time
        }
        
        const updatedTarget = {
          ...targetAppointment,
          time: draggedAppointment.time
        }
        
        // Update both appointments
        const [result1, result2] = await Promise.all([
          window.electronAPI.updateAppointment(updatedDragged),
          window.electronAPI.updateAppointment(updatedTarget)
        ])
        
        if (result1 && result2) {
          toast.success("התורים הוחלפו בהצלחה")
          await loadData()
        } else {
          toast.error("שגיאה בהחלפת התורים")
        }
      } else if (targetSlot.type === 'free-slot') {
        // Moving appointment to free slot
        const updatedAppointment = {
          ...draggedData.appointment,
          time: targetSlot.startTime
        }
        
        const result = await window.electronAPI.updateAppointment(updatedAppointment)
        if (result) {
          toast.success("התור הועבר בהצלחה")
          await loadData()
        } else {
          toast.error("שגיאה בהעברת התור")
        }
      }
    } catch (error) {
      console.error('Error moving appointment:', error)
      toast.error("שגיאה בהעברת התור")
    } finally {
      setDraggedData(null)
    }
  }

  if (loading) {
    return (
      <>
        <SiteHeader title="דשבורד" />
        <div className="flex flex-col items-center justify-center h-full">
          <div className="text-lg">טוען נתונים...</div>
        </div>
      </>
    )
  }

  return (
    <>

      <SiteHeader title={settings?.clinic_name || "דשבורד"} />
        <div className="flex flex-col flex-1 p-4 lg:p-6 gap-6 overflow-auto pb-16" dir="rtl" style={{scrollbarWidth: 'none'}}>
          
          {/* Top Section: Calendar and Appointments Table */}
          <div className="grid gap-6 md:grid-cols-3 pb-16">
            
            {/* Calendar */}
            <div className="md:col-span-1">
              <h2 className="text-lg font-semibold mb-4">לוח שנה</h2>
              <div className="flex flex-col">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border dark:border-border w-full"
                  locale={he}
                />
                <div className="mt-4 text-sm text-muted-foreground">
                  תאריך נבחר: {format(selectedDate, 'dd/MM/yyyy', { locale: he })}
                </div>

                {/* Statistics Cards under Calendar - 2x2 Grid */}
                <div className="grid gap-4 grid-cols-2 mt-6 w-full">
                <Card className="dark:bg-card dark:border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">תורים היום</CardTitle>
                    <CalendarDays className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{todayAppointments.length}</div>
                    <p className="text-xs text-muted-foreground">
                      מתוך {TOTAL_SLOTS} תורים אפשריים
                    </p>
                  </CardContent>
                </Card>

                <Card className="dark:bg-card dark:border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">מקומות פנויים היום</CardTitle>
                    <Clock className="h-4 w-4 text-secondary-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-secondary-foreground">{todayFreeSlots}</div>
                    <p className="text-xs text-muted-foreground">
                      {todayFreeSlots * APPOINTMENT_DURATION} דקות פנויות
                    </p>
                  </CardContent>
                </Card>

                <Card className="dark:bg-card dark:border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">לקוחות חדשים החודש</CardTitle>
                    <UserPlus className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-primary">{thisMonthNewClients.length}</div>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(), 'MMMM yyyy', { locale: he })}
                    </p>
                  </CardContent>
                </Card>

                <Card className="dark:bg-card dark:border-border">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">סה"כ לקוחות</CardTitle>
                    <Users className="h-4 w-4 text-secondary-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-secondary-foreground">{clients.length}</div>
                    <p className="text-xs text-muted-foreground">
                      לקוחות רשומים במערכת
                    </p>
                  </CardContent>
                </Card>
              </div>
              </div>
            </div>

            {/* Appointments Schedule */}
            <div className="md:col-span-2">
              <h2 className="text-lg font-semibold mb-4">
                לוח זמנים - {format(selectedDate, 'dd/MM/yyyy', { locale: he })}
              </h2>
                <div className="rounded-md border dark:border-border max-h-[1000px] overflow-auto">
                  <Table dir="rtl">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">זמן</TableHead>
                        <TableHead className="text-right">סטטוס</TableHead>
                        <TableHead className="text-right">לקוח</TableHead>
                        <TableHead className="text-right">סוג בדיקה</TableHead>
                        <TableHead className="text-right">הערות</TableHead>
                        <TableHead className="text-right">פעולות</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {timeSlots.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                            אין תורים לתאריך זה
                          </TableCell>
                        </TableRow>
                      ) : (
                        timeSlots.map((slot, index) => (
                          <TableRow 
                            key={`${slot.startTime}-${slot.endTime}-${index}`}
                            className={
                              slot.type === 'free-slot' ? 'hover:bg-gray-50 dark:hover:bg-gray-800' :
                                            slot.appointment?.first_name === 'הפסקה' ? 'bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/20 dark:hover:bg-orange-900/30' :
              'hover:bg-gray-50 dark:hover:bg-gray-800'
            }
            onDragOver={(slot.type === 'free-slot' || (slot.type === 'appointment' && slot.appointment?.first_name !== 'הפסקה')) ? handleDragOver : undefined}
            onDrop={(slot.type === 'free-slot' || (slot.type === 'appointment' && slot.appointment?.first_name !== 'הפסקה')) ? (e) => handleDrop(e, slot) : undefined}
                          >
                                                          <TableCell className="font-medium">
                               {slot.type === 'appointment' && (
                                                    <div 
                    className="flex items-center gap-2"
                    draggable={slot.appointment?.first_name !== 'הפסקה'}
                    onDragStart={(e) => slot.appointment && slot.appointment.first_name !== 'הפסקה' && handleDragStart(e, slot.appointment, slot, index)}
                  >
                    {slot.appointment?.first_name !== 'הפסקה' && (
                      <GripVertical className="h-4 w-4 cursor-grab text-gray-400 dark:text-gray-500" />
                    )}
                    {slot.appointment?.first_name === 'הפסקה' && (
                      <div className="w-4 h-4 flex items-center justify-center">
                        <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                      </div>
                    )}
                                    {slot.startTime}
                                  </div>
                               )}
                               {slot.type === 'free-slot' && (
                                 <div 
                                   className="flex items-center gap-2"
                                   draggable
                                   onDragStart={(e) => handleDragStart(e, { id: -1, client_id: -1, date: format(selectedDate, 'yyyy-MM-dd'), time: slot.startTime, first_name: '', last_name: '', phone_mobile: '', exam_name: '', note: '' }, slot, index)}
                                 >
                                   <GripVertical className="h-4 w-4 cursor-grab text-gray-400 dark:text-gray-500" />
                                   {slot.startTime}
                                 </div>
                               )}
                            </TableCell>
                                        <TableCell>
              {slot.type === 'appointment' ? (
                slot.appointment?.first_name === 'הפסקה' ? (
                  <Badge variant="outline" className="text-orange-600 border-orange-600 dark:text-orange-400 dark:border-orange-400">
                    הפסקה
                  </Badge>
                ) : (
                  <Badge variant="default">תור קבוע</Badge>
                )
              ) : (
                ''
              )}
            </TableCell>
            <TableCell>
              {slot.type === 'appointment' ? `${slot.appointment?.first_name || ''} ${slot.appointment?.last_name || ''}`.trim() : ''}
            </TableCell>
                            <TableCell>
                              {slot.type === 'appointment' ? slot.appointment?.exam_name : ''}
                            </TableCell>
                            <TableCell>
                              {slot.type === 'appointment' ? slot.appointment?.note : ''}
                            </TableCell>
                            <TableCell>
                              {slot.type === 'appointment' && slot.appointment?.first_name !== 'הפסקה' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    if (slot.appointment) {
                                      openEditDialog(slot.appointment)
                                    }
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                                            {slot.type === 'free-slot' && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openNewClientModal(slot.startTime)}>
                      <UserPlus className="h-4 w-4 ml-2" />
                      לקוח חדש
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openOldClientFlow(slot.startTime)}>
                      <Users className="h-4 w-4 ml-2" />
                      לקוח קיים
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
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
            title={`לקוח חדש ותור - ${selectedTimeSlot}`}
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

          {/* Create Appointment Modal */}
          <CustomModal
            isOpen={isCreateModalOpen}
            onClose={closeAllDialogs}
            title={editingAppointment ? 'עריכת תור' : selectedClient ? `תור חדש - ${selectedClient.first_name} ${selectedClient.last_name} - ${selectedTimeSlot}` : `תור חדש - ${selectedTimeSlot}`}
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
            <div className="flex justify-start gap-2 mt-4">
              <Button onClick={handleSaveAppointment}>שמור</Button>
              <Button variant="outline" onClick={closeAllDialogs}>ביטול</Button>
            </div>
          </CustomModal>
      </>
    )
}
