import React, { useState, useEffect } from "react"
import { SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CalendarDays, Users, Clock, UserPlus, Plus, ChevronDown, ChevronUp, GripVertical } from "lucide-react"
import { getAllAppointments } from "@/lib/db/appointments-db"
import { getAllClients } from "@/lib/db/clients-db"
import { Appointment, Client } from "@/lib/db/schema"
import { format, isToday, startOfMonth, endOfMonth, isWithinInterval, parseISO, addMinutes, isBefore, isAfter } from "date-fns"
import { he } from "date-fns/locale"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { toast } from "sonner"

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
  const [loading, setLoading] = useState(true)
  const [expandedSlots, setExpandedSlots] = useState<Set<string>>(new Set())
  const [draggedData, setDraggedData] = useState<DragData | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>('')
  const [formData, setFormData] = useState<Omit<Appointment, 'id'>>({
    client_id: 0,
    date: '',
    time: '',
    client_name: '',
    exam_name: '',
    note: ''
  })

  const loadData = async () => {
    try {
      setLoading(true)
      const [appointmentsData, clientsData] = await Promise.all([
        getAllAppointments(),
        getAllClients()
      ])
      setAppointments(appointmentsData)
      setClients(clientsData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

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

  // Calculate work day stats (8 hours = 480 minutes, 20 minutes per appointment = 24 slots)
  const WORK_DAY_MINUTES = 8 * 60 // 480 minutes
  const APPOINTMENT_DURATION = 20 // minutes
  const TOTAL_SLOTS = WORK_DAY_MINUTES / APPOINTMENT_DURATION // 24 slots
  const todayFreeSlots = TOTAL_SLOTS - todayAppointments.length

  // Generate 20-minute slots from free time
  const generateFreeSlots = (startTime: string, endTime: string): TimeSlot[] => {
    const slots: TimeSlot[] = []
    const start = parseISO(`2000-01-01T${startTime}`)
    const end = parseISO(`2000-01-01T${endTime}`)
    let current = start

    // Add collapse button as first row
    slots.push({
      type: 'collapse',
      startTime: startTime,
      endTime: endTime,
      duration: 0
    })

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

  // Generate time slots with free time between appointments
  const generateTimeSlots = (): TimeSlot[] => {
    const slots: TimeSlot[] = []
    const WORK_START = "09:00"
    const WORK_END = "17:00"

    // Sort appointments by time
    const sortedAppointments = selectedDateAppointments
      .filter(apt => apt.time)
      .sort((a, b) => a.time!.localeCompare(b.time!))

    if (sortedAppointments.length === 0) {
      // No appointments - show full day as free
      const slotKey = `${WORK_START}-${WORK_END}`
      const isExpanded = expandedSlots.has(slotKey)
      
      if (isExpanded) {
        return generateFreeSlots(WORK_START, WORK_END)
      } else {
        slots.push({
          type: 'free',
          startTime: WORK_START,
          endTime: WORK_END,
          duration: WORK_DAY_MINUTES,
          expanded: false
        })
      }
      return slots
    }

    let currentTime = WORK_START

    sortedAppointments.forEach((appointment, index) => {
      const appointmentTime = appointment.time!
      const appointmentEndTime = format(addMinutes(parseISO(`2000-01-01T${appointmentTime}`), APPOINTMENT_DURATION), 'HH:mm')

      // Add free time before this appointment
      if (appointmentTime > currentTime) {
        const freeStartTime = parseISO(`2000-01-01T${currentTime}`)
        const freeEndTime = parseISO(`2000-01-01T${appointmentTime}`)
        const freeDuration = (freeEndTime.getTime() - freeStartTime.getTime()) / (1000 * 60)
        
        if (freeDuration > 0) {
          const slotKey = `${currentTime}-${appointmentTime}`
          const isExpanded = expandedSlots.has(slotKey)
          
          if (isExpanded) {
            slots.push(...generateFreeSlots(currentTime, appointmentTime))
          } else {
            slots.push({
              type: 'free',
              startTime: currentTime,
              endTime: appointmentTime,
              duration: freeDuration,
              expanded: false
            })
          }
        }
      }

      // Add the appointment
      slots.push({
        type: 'appointment',
        startTime: appointmentTime,
        endTime: appointmentEndTime,
        appointment,
        duration: APPOINTMENT_DURATION
      })

      currentTime = appointmentEndTime
    })

    // Add free time after last appointment until end of work day
    if (currentTime < WORK_END) {
      const freeStartTime = parseISO(`2000-01-01T${currentTime}`)
      const freeEndTime = parseISO(`2000-01-01T${WORK_END}`)
      const freeDuration = (freeEndTime.getTime() - freeStartTime.getTime()) / (1000 * 60)
      
      if (freeDuration > 0) {
        const slotKey = `${currentTime}-${WORK_END}`
        const isExpanded = expandedSlots.has(slotKey)
        
        if (isExpanded) {
          slots.push(...generateFreeSlots(currentTime, WORK_END))
        } else {
          slots.push({
            type: 'free',
            startTime: currentTime,
            endTime: WORK_END,
            duration: freeDuration,
            expanded: false
          })
        }
      }
    }

    return slots
  }

  const timeSlots = generateTimeSlots()

  // Handle expanding/collapsing free time slots
  const toggleFreeSlot = (startTime: string, endTime: string) => {
    const slotKey = `${startTime}-${endTime}`
    const newExpandedSlots = new Set(expandedSlots)
    
    if (expandedSlots.has(slotKey)) {
      newExpandedSlots.delete(slotKey)
    } else {
      newExpandedSlots.add(slotKey)
    }
    
    setExpandedSlots(newExpandedSlots)
  }

  // Handle opening create appointment modal
  const openCreateModal = (timeSlot: string) => {
    setSelectedTimeSlot(timeSlot)
    setFormData({
      client_id: 0,
      date: format(selectedDate, 'yyyy-MM-dd'),
      time: timeSlot,
      client_name: '',
      exam_name: '',
      note: ''
    })
    setIsCreateModalOpen(true)
  }

  // Handle saving new appointment
  const handleSaveAppointment = async () => {
    try {
      const result = await window.electronAPI.createAppointment(formData)
      if (result) {
        toast.success("התור נוצר בהצלחה")
        await loadData()
        setIsCreateModalOpen(false)
      } else {
        toast.error("שגיאה ביצירת התור")
      }
    } catch (error) {
      console.error('Error creating appointment:', error)
      toast.error("שגיאה ביצירת התור")
    }
  }

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
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
      <SidebarProvider dir="rtl">
        <AppSidebar variant="inset" side="right" />
        <SidebarInset>
          <SiteHeader title="דשבורד" />
          <div className="flex flex-col items-center justify-center h-full">
            <div className="text-lg">טוען נתונים...</div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    )
  }

  return (  
    <SidebarProvider dir="rtl">
      <AppSidebar variant="inset" side="right" />
      <SidebarInset className="overflow-auto" style={{scrollbarWidth: 'none'}}>
        <SiteHeader title="דשבורד" />
        <div className="flex flex-col flex-1 p-4 lg:p-6 gap-6" dir="rtl" style={{scrollbarWidth: 'none'}}>
          
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">תורים היום</CardTitle>
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayAppointments.length}</div>
                <p className="text-xs text-muted-foreground">
                  מתוך {TOTAL_SLOTS} תורים אפשריים
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">מקומות פנויים היום</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{todayFreeSlots}</div>
                <p className="text-xs text-muted-foreground">
                  {todayFreeSlots * APPOINTMENT_DURATION} דקות פנויות
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">לקוחות חדשים החודש</CardTitle>
                <UserPlus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{thisMonthNewClients.length}</div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(), 'MMMM yyyy', { locale: he })}
                </p>
              </CardContent>
            </Card>

            <Card className="dark:bg-card dark:border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">סה"כ לקוחות</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{clients.length}</div>
                <p className="text-xs text-muted-foreground">
                  לקוחות רשומים במערכת
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="grid gap-6 md:grid-cols-3">
            
            {/* Calendar */}
            <Card className="md:col-span-1 dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>לוח שנה</CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md border dark:border-border"
                  locale={he}
                />
                <div className="mt-4 text-sm text-muted-foreground">
                  תאריך נבחר: {format(selectedDate, 'dd/MM/yyyy', { locale: he })}
                </div>
              </CardContent>
            </Card>

            {/* Appointments Schedule */}
            <Card className="md:col-span-2 dark:bg-card dark:border-border">
              <CardHeader>
                <CardTitle>
                  לוח זמנים - {format(selectedDate, 'dd/MM/yyyy', { locale: he })}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border dark:border-border">
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
                              slot.type === 'free' ? 'bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/30 cursor-pointer' : 
                              slot.type === 'free-slot' ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 cursor-pointer' :
                              slot.type === 'collapse' ? 'bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 cursor-pointer' :
                              'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }
                            onClick={() => {
                              if (slot.type === 'free') {
                                toggleFreeSlot(slot.startTime, slot.endTime)
                              } else if (slot.type === 'collapse') {
                                toggleFreeSlot(slot.startTime, slot.endTime)
                              }
                            }}
                            onDragOver={(slot.type === 'free-slot' || slot.type === 'appointment') ? handleDragOver : undefined}
                            onDrop={(slot.type === 'free-slot' || slot.type === 'appointment') ? (e) => handleDrop(e, slot) : undefined}
                          >
                                                          <TableCell className="font-medium">
                               {slot.type === 'appointment' && (
                                  <div 
                                    className="flex items-center gap-2"
                                    draggable
                                    onDragStart={(e) => slot.appointment && handleDragStart(e, slot.appointment, slot, index)}
                                  >
                                    <GripVertical className="h-4 w-4 cursor-grab text-gray-400 dark:text-gray-500" />
                                    {slot.startTime} - {slot.endTime}
                                  </div>
                               )}
                               {slot.type === 'collapse' && (
                                 <div className="flex items-center justify-between">
                                   <span className="text-sm text-gray-600 dark:text-gray-400">זמן פנוי: {slot.startTime} - {slot.endTime}</span>
                                   <Button
                                     variant="ghost"
                                     size="sm"
                                     onClick={(e) => {
                                       e.stopPropagation()
                                       toggleFreeSlot(slot.startTime, slot.endTime)
                                     }}
                                   >
                                     <ChevronUp className="h-4 w-4" />
                                   </Button>
                                 </div>
                               )}
                               {(slot.type === 'free' || slot.type === 'free-slot') && (
                                 <div className="flex items-center justify-between">
                                   <span>{slot.startTime} - {slot.endTime}</span>
                                   {slot.type === 'free' && (
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={(e) => {
                                         e.stopPropagation()
                                         toggleFreeSlot(slot.startTime, slot.endTime)
                                       }}
                                     >
                                       {expandedSlots.has(`${slot.startTime}-${slot.endTime}`) ? 
                                         <ChevronUp className="h-4 w-4" /> : 
                                         <ChevronDown className="h-4 w-4" />
                                       }
                                     </Button>
                                   )}
                                   {slot.type === 'free-slot' && (
                                     <Button
                                       variant="ghost"
                                       size="sm"
                                       onClick={(e) => {
                                         e.stopPropagation()
                                         openCreateModal(slot.startTime)
                                       }}
                                     >
                                       <Plus className="h-4 w-4" />
                                     </Button>
                                   )}
                                 </div>
                               )}
                            </TableCell>
                            <TableCell>
                              {slot.type === 'appointment' ? (
                                <Badge variant="default">תור קבוע</Badge>
                              ) : slot.type === 'free' ? (
                                <Badge variant="outline" className="text-green-600 border-green-600 dark:text-green-400 dark:border-green-400">
                                  זמן פנוי ({slot.duration} דק')
                                </Badge>
                              ) : slot.type === 'collapse' ? (
                                <Badge variant="outline" className="text-gray-600 border-gray-600 dark:text-gray-400 dark:border-gray-400">
                                  סגור זמן פנוי
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-blue-600 border-blue-600 dark:text-blue-400 dark:border-blue-400">
                                  זמין לתור
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {slot.type === 'appointment' ? slot.appointment?.client_name : 
                               slot.type === 'collapse' ? '-' : '-'}
                            </TableCell>
                            <TableCell>
                              {slot.type === 'appointment' ? slot.appointment?.exam_name : 
                               slot.type === 'collapse' ? '-' : '-'}
                            </TableCell>
                            <TableCell>
                              {slot.type === 'appointment' ? slot.appointment?.note : 
                               slot.type === 'free' ? `${Math.floor(slot.duration! / APPOINTMENT_DURATION)} תורים אפשריים` : 
                               slot.type === 'free-slot' ? 'לחץ + ליצירת תור' : 
                               slot.type === 'collapse' ? 'לחץ להסתרת הזמנים הפנויים' : '-'}
                            </TableCell>
                            <TableCell>
                              {slot.type === 'appointment' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    // Navigate to appointment edit
                                  }}
                                >
                                  עריכה
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Create Appointment Modal */}
        <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
          <DialogContent className="sm:max-w-[425px] [&>button]:left-4 [&>button]:right-auto" dir="rtl">
            <DialogHeader className="text-right">
              <DialogTitle className="text-right">תור חדש - {selectedTimeSlot}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
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
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">בחירת לקוח</Label>
                <div className="col-span-3">
                  <ClientSelectModal
                    triggerText="בחר לקוח"
                    onClientSelect={(selectedClientId) => {
                      setFormData(prev => ({ ...prev, client_id: selectedClientId }))
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-start gap-2">
              <Button onClick={handleSaveAppointment}>שמור</Button>
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                ביטול
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  )
}
