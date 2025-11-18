import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Loader2 } from "lucide-react"
import { createAppointment, updateAppointment, deleteAppointment } from "@/lib/db/appointments-db"
import { getClientById } from "@/lib/db/clients-db"
import { getDashboardHome } from "@/lib/db/dashboard-db"
import { Appointment, Client, Settings, User } from "@/lib/db/schema-interface"
import {
  format,
  isToday,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
  startOfWeek,
  endOfWeek,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  subDays
} from "date-fns"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { toast } from "sonner"
import { useUser } from "@/contexts/UserContext"
import { CalendarView, AppointmentBlock, DragData, DragPosition, ResizeData } from "./HomePage/types"
import { 
  timeToMinutes, 
  minutesToTime, 
  getAppointmentEndTime, 
  getAppointmentTimeRange,
  createUserColorMap,
  isUserOnVacation as isUserOnVacationUtil
} from "./HomePage/utils"
import { CalendarHeader } from "./HomePage/CalendarHeader"
import { StatisticsSidebar } from "./HomePage/StatisticsSidebar"
import { MonthView } from "./HomePage/MonthView"
import { WeekDayView } from "./HomePage/WeekDayView"
import { AppointmentModal } from "./HomePage/AppointmentModal"
import { useAppointmentBlocks } from "./HomePage/useAppointmentBlocks"
import { useDragAndResize } from "./HomePage/useDragAndResize"


export default function HomePage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [view, setView] = useState<CalendarView>('week')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const { currentUser, currentClinic } = useUser()

  const [users, setUsers] = useState<User[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; time: string }>({ date: new Date(), time: '' })
  const [formData, setFormData] = useState<Omit<Appointment, 'id'>>({
    client_id: 0,
    user_id: currentUser?.id || 0,
    date: undefined,
    time: undefined,
    duration: 30,
    exam_name: undefined,
    note: undefined
  })

  useEffect(() => {
    if (currentUser?.id) {
      setFormData(prev => ({ ...prev, user_id: currentUser.id }))
    }
  }, [currentUser?.id])

  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [saving, setSaving] = useState(false)

  const calendarRef = useRef<HTMLDivElement | null>(null)
  const loadedStartRef = useRef<Date | null>(null)
  const loadedEndRef = useRef<Date | null>(null)
  const loadedClinicIdRef = useRef<number | null>(null)
  

  const loadData = useCallback(async (startDate: Date, endDate: Date) => {
    try {
      setLoading(true)
      
      if (currentClinic?.id) {
        const s = format(startDate, 'yyyy-MM-dd')
        const e = format(endDate, 'yyyy-MM-dd')
        
        const data = await getDashboardHome(currentClinic.id, s, e)
        setAppointments(data.appointments)
        setClients(data.clients)
        setSettings(data.settings)
        const mergedUsers = (() => {
          const list = data.users || []
          if (currentUser?.id && !list.some(u => u.id === currentUser.id)) {
            return [...list, currentUser as User]
          }
          return list
        })()
        setUsers(mergedUsers)
        loadedStartRef.current = startDate
        loadedEndRef.current = endDate
        loadedClinicIdRef.current = currentClinic.id
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }, [currentClinic?.id, currentUser])

  useEffect(() => {
    if (!currentClinic?.id) return

    const desiredStart = startOfMonth(subMonths(currentDate, 6))
    const desiredEnd = endOfMonth(addMonths(currentDate, 6))

    const needsLoad =
      loadedClinicIdRef.current !== currentClinic.id ||
      !loadedStartRef.current ||
      !loadedEndRef.current ||
      currentDate < loadedStartRef.current ||
      currentDate > loadedEndRef.current

    if (needsLoad) {
      loadData(desiredStart, desiredEnd)
    }
  }, [currentClinic?.id, currentDate, loadData])

  useEffect(() => {
    if (!isClientSelectOpen && selectedClient) {
      // Ensure default examiner is current user when opening create modal
      setFormData(prev => ({ ...prev, user_id: currentUser?.id || prev.user_id || 0 }))
      setIsCreateModalOpen(true)
    }
  }, [isClientSelectOpen, selectedClient, currentUser?.id])

  // Ensure the default examiner in the modal is the current user when modal opens without client selection path (e.g., editing or direct open)
  useEffect(() => {
    if (isCreateModalOpen && (!formData.user_id || formData.user_id === 0) && currentUser?.id) {
      setFormData(prev => ({ ...prev, user_id: currentUser.id }))
    }
  }, [isCreateModalOpen, currentUser?.id])

  useEffect(() => {
    if (!isCreateModalOpen && !isClientSelectOpen) {
      // Use requestAnimationFrame instead of setTimeout for smoother cleanup
      requestAnimationFrame(() => {
        document.body.focus()
        const backdrops = document.querySelectorAll('[data-radix-portal]')
        backdrops.forEach(backdrop => {
          if (backdrop.innerHTML === '') {
            backdrop.remove()
          }
        })
      })
    }
  }, [isCreateModalOpen, isClientSelectOpen])

  const WORK_START = settings?.work_start_time || "08:00"
  const WORK_END = settings?.work_end_time || "18:00"
  const APPOINTMENT_DURATION = settings?.appointment_duration || 30
  const BREAK_START = settings?.break_start_time || ""
  const BREAK_END = settings?.break_end_time || ""

  const workStartHour = parseInt(WORK_START.split(':')[0])
  const workEndHour = parseInt(WORK_END.split(':')[0])
  const totalWorkHours = workEndHour - workStartHour

  // Memoized user color mapping with conflict resolution
  const userColorMap = useMemo(() => {
    return createUserColorMap(users)
  }, [users])

  // Helper function to get user color (now memoized)
  const getUserColor = useCallback((userId?: number) => {
    if (!userId) return '#3b82f6'
    return userColorMap.get(userId) || '#3b82f6'
  }, [userColorMap])

  // Get appointment duration (from database or default)
  const getAppointmentDuration = useCallback((appointment: Appointment) => {
    return appointment.duration || APPOINTMENT_DURATION
  }, [APPOINTMENT_DURATION])

  // Navigation functions
  const navigateCalendar = useCallback((direction: 'prev' | 'next') => {
    if (view === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1))
    } else if (view === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
    } else if (view === 'month') {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
    }
  }, [view, currentDate])

  const goToToday = useCallback(() => {
    setCurrentDate(new Date())
  }, [])

  // Memoized visible dates to prevent recalculation on every render
  const visibleDates = useMemo(() => {
    if (view === 'day') {
      return [currentDate]
    } else if (view === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 })
      return Array.from({ length: 7 }, (_, i) => addDays(start, i))
    } else {
      const start = startOfMonth(currentDate)
      const end = endOfMonth(currentDate)
      const startWeek = startOfWeek(start, { weekStartsOn: 0 })
      const endWeek = endOfWeek(end, { weekStartsOn: 0 })
      const days = []
      let current = startWeek
      while (current <= endWeek) {
        days.push(current)
        current = addDays(current, 1)
      }
      return days
    }
  }, [currentDate, view])

  // Vacation helper
  const isUserOnVacation = useCallback((userId?: number, dateStr?: string) => {
    return isUserOnVacationUtil(users, userId, dateStr)
  }, [users])

  // Memoized appointments grouped by date for performance
  const appointmentsByDate = useMemo(() => {
    if (!appointments.length) return new Map<string, Appointment[]>()
    
    const dateMap = new Map<string, Appointment[]>()
    
    appointments.forEach(appointment => {
      if (!appointment.date) return
      try {
        const dateStr = format(new Date(appointment.date), 'yyyy-MM-dd')
        if (!dateMap.has(dateStr)) {
          dateMap.set(dateStr, [])
        }
        dateMap.get(dateStr)!.push(appointment)
      } catch {
        // Invalid date, skip
      }
    })
    
    return dateMap
  }, [appointments])

  // Optimized function to get appointments for a specific date
  const getAppointmentsForDate = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    return appointmentsByDate.get(dateStr) || []
  }, [appointmentsByDate])

  // Memoized client lookup for performance
  const clientsMap = useMemo(() => {
    if (!clients.length) return new Map<number, Client>()
    
    const map = new Map<number, Client>()
    clients.forEach(client => {
      if (client.id) {
        map.set(client.id, client)
      }
    })
    return map
  }, [clients])

  // Drag and resize functionality
  const {
    draggedData,
    draggedBlockId,
    dragPosition,
    resizeData,
    suppressClickRef,
    handleMouseDown,
    handleResizeStart
  } = useDragAndResize({
    calendarRef,
    workStartHour,
    workEndHour,
    getAppointmentDuration,
    isUserOnVacation,
    visibleDates,
    updateAppointment,
    setAppointments
  })

  // Get dynamic appointment time range for resizing (must be after useDragAndResize)
  const getDynamicTimeRange = useCallback((appointment: Appointment) => {
    if (resizeData && resizeData.appointmentId === appointment.id) {
      // Show current resize state
      const currentAppointment = appointments.find(a => a.id === appointment.id)
      if (currentAppointment) {
        // Calculate time range based on resize type and current duration
        if (resizeData.type === 'top') {
          // Top resize: start time changed, end time stays the same
          return `${currentAppointment.time} - ${resizeData.originalEnd}`
        } else {
          // Bottom resize: start time stays the same, calculate end time from duration
          const startTime = resizeData.originalStart
          const duration = currentAppointment.duration || getAppointmentDuration(currentAppointment)
          const endTime = getAppointmentEndTime(startTime, duration)
          return `${startTime} - ${endTime}`
        }
      }
    }

    // Normal display using appointment's actual duration
    const duration = getAppointmentDuration(appointment)
    return getAppointmentTimeRange(appointment.time || '', duration)
  }, [resizeData, appointments, getAppointmentDuration])

  // Optimized appointment blocks calculation with custom hook
  const { getAppointmentBlocks } = useAppointmentBlocks({
    getAppointmentsForDate,
    clientsMap,
    workStartHour,
    getAppointmentDuration,
    resizeData
  })

  // Memoized time slots for the grid
  const timeSlots = useMemo(() => {
    return Array.from({ length: totalWorkHours }, (_, i) => {
      const hour = workStartHour + i
      return {
        time: `${hour.toString().padStart(2, '0')}:00`,
        hour: hour
      }
    })
  }, [totalWorkHours, workStartHour])

  // Form and modal handlers
  const resetAllForms = useCallback(() => {
    setFormData({
      client_id: 0,
      user_id: currentUser?.id || 0,
      date: undefined,
      time: undefined,
      duration: APPOINTMENT_DURATION,
      exam_name: undefined,
      note: undefined
    })
    setSelectedClient(null)
  }, [currentUser?.id, APPOINTMENT_DURATION])

  // Handle time slot click for creating appointments
  const handleTimeSlotClick = useCallback((date: Date, time: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    setSelectedTimeSlot({ date, time })
    resetAllForms()
    setFormData({
      client_id: 0,
      user_id: currentUser?.id || 0,
      date: dateStr,
      time: time,
      duration: APPOINTMENT_DURATION,
      exam_name: '',
      note: ''
    })
    setIsClientSelectOpen(true)
  }, [resetAllForms, currentUser?.id, APPOINTMENT_DURATION])

  const closeAllDialogs = useCallback(() => {
    setIsCreateModalOpen(false)
    setIsClientSelectOpen(false)
    setEditingAppointment(null)
    resetAllForms()
  }, [resetAllForms])

  const openEditDialog = useCallback((appointment: Appointment) => {
    try {
      setEditingAppointment(appointment)
      // Set form immediately and open modal without waiting for network
      setFormData({
        client_id: appointment.client_id,
        user_id: appointment.user_id || currentUser?.id || 0,
        date: appointment.date || '',
        time: appointment.time || '',
        duration: appointment.duration || APPOINTMENT_DURATION,
        exam_name: appointment.exam_name || '',
        note: appointment.note || ''
      })
      // Try to resolve client from local map first
      const localClient = clientsMap.get(appointment.client_id)
      if (localClient) {
        setSelectedClient(localClient)
      } else {
        // Background fetch if not available locally
        getClientById(appointment.client_id)
          .then((client) => client && setSelectedClient(client))
          .catch((error) => console.error('Error loading client (background):', error))
      }
      setIsCreateModalOpen(true)
    } catch (error) {
      console.error('Error preparing appointment for edit:', error)
      setIsCreateModalOpen(true)
    }
  }, [currentUser?.id, APPOINTMENT_DURATION, clientsMap])

  const handleClientSelect = useCallback(async (selectedClientId: number) => {
    try {
      const client = await getClientById(selectedClientId)
      if (client) {
        setSelectedClient(client)
        setFormData(prev => ({
          ...prev,
          client_id: selectedClientId,
          user_id: currentUser?.id || prev.user_id || 0,
          date: format(selectedTimeSlot.date, 'yyyy-MM-dd'),
          time: selectedTimeSlot.time,
          duration: APPOINTMENT_DURATION,
          exam_name: '',
          note: ''
        }))
        setIsClientSelectOpen(false)
      }
    } catch (error) {
      console.error('Error loading client:', error)
      toast.error("שגיאה בטעינת פרטי הלקוח")
    }
  }, [currentUser?.id, selectedTimeSlot, APPOINTMENT_DURATION])

  const handleSaveAppointment = useCallback(async () => {
    try {
      setSaving(true)
      if (formData.date && isUserOnVacation(formData.user_id, formData.date)) {
        toast.error('לא ניתן לקבוע תור ביום חופשה של המשתמש')
        return
      }
      if (!formData.client_id || formData.client_id <= 0) {
        toast.error("יש לבחור לקוח")
        return
      }

      if (editingAppointment) {
        const updatedAppointment = { ...formData, id: editingAppointment.id }
        const result = await updateAppointment(updatedAppointment)
        if (result) {
          toast.success("התור עודכן בהצלחה")
          setAppointments(prev => prev.map(apt =>
            apt.id === updatedAppointment.id ? updatedAppointment : apt
          ))
          closeAllDialogs()
        } else {
          toast.error("שגיאה בעדכון התור")
        }
      } else {
        // Filter out undefined values before sending to backend
        const appointmentData = {
          client_id: formData.client_id,
          clinic_id: currentClinic?.id,
          user_id: formData.user_id,
          date: formData.date,
          time: formData.time,
          duration: formData.duration,
          exam_name: formData.exam_name,
          note: formData.note
        }
        
        console.log('Sending appointment data from HomePage:', appointmentData);
        
        const result = await createAppointment(appointmentData)
        if (result) {
          toast.success("התור נוצר בהצלחה")
          setAppointments(prev => [...prev, result])
          closeAllDialogs()
        } else {
          toast.error("שגיאה ביצירת התור")
        }
      }
    } catch (error) {
      console.error('Error saving appointment:', error)
      toast.error("שגיאה בשמירת התור")
    } finally {
      setSaving(false)
    }
  }, [formData, isUserOnVacation, editingAppointment, closeAllDialogs, currentClinic?.id])

  const handleDeleteAppointment = useCallback(async (appointmentId: number) => {
    if (!confirm('האם אתה בטוח שברצונך למחוק את התור?')) return

    try {
      const result = await deleteAppointment(appointmentId)
      if (result) {
        toast.success("התור נמחק בהצלחה")
        // Remove from local state instead of reloading all data
        setAppointments(prev => prev.filter(apt => apt.id !== appointmentId))
      } else {
        toast.error("שגיאה במחיקת התור")
      }
    } catch (error) {
      console.error('Error deleting appointment:', error)
      toast.error("שגיאה במחיקת התור")
    }
  }, [])

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }, [])

  
  // Memoized statistics calculations
  const todayAppointments = useMemo(() => {
    return appointments.filter(appointment => {
      if (!appointment.date) return false
      try {
        const appointmentDate = new Date(appointment.date)
        return isToday(appointmentDate)
      } catch {
        return false
      }
    })
  }, [appointments])

  const thisMonthNewClients = useMemo(() => {
    return clients.filter(client => {
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
  }, [clients])

  // Memoized work schedule calculations
  const workScheduleInfo = useMemo(() => {
    const workStartTime = parseISO(`2000-01-01T${WORK_START}`)
    const workEndTime = parseISO(`2000-01-01T${WORK_END}`)
    const WORK_DAY_MINUTES = (workEndTime.getTime() - workStartTime.getTime()) / (1000 * 60)
    const TOTAL_SLOTS = Math.floor(WORK_DAY_MINUTES / APPOINTMENT_DURATION)
    
    return {
      workStartTime,
      workEndTime, 
      WORK_DAY_MINUTES,
      TOTAL_SLOTS
    }
  }, [WORK_START, WORK_END, APPOINTMENT_DURATION])

  const todayFreeSlots = useMemo(() => {
    return workScheduleInfo.TOTAL_SLOTS - todayAppointments.length
  }, [workScheduleInfo.TOTAL_SLOTS, todayAppointments.length])

  if (loading) {
    return (
      <>
        <SiteHeader title={ "לוח זמנים"} />
        <div className="flex flex-col bg-muted/50 flex-1 gap-6" dir="rtl" style={{ scrollbarWidth: 'none' }}>
          <div className="flex items-center justify-between p-6 pb-5">
            <div className="flex items-center gap-4">
              <Skeleton className="h-9 w-16" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-md" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
              <Skeleton className="h-6 w-44" />
            </div>
            <div className="flex items-center gap-2 bg-card shadow-md rounded-md p-1">
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-14" />
              <Skeleton className="h-8 w-14" />
            </div>
          </div>

          <div className="flex gap-6 px-4 lg:px-6 flex-1">
            <div className="w-72 space-y-4">
              <Card className="bg-card  p-2 justify-center">
                <CardContent className="p-0 justify-center">
                  <Skeleton className="w-full h-[350px]" />
                </CardContent>
              </Card>

              <div className="grid gap-4 grid-cols-2">
                <Card className="bg-card  py-4">
                  <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0 ">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-28 mt-2" />
                  </CardContent>
                </Card>

                <Card className="bg-card  py-4">
                  <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0 ">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-4 rounded-full" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-7 w-16" />
                    <Skeleton className="h-3 w-24 mt-2" />
                  </CardContent>
                </Card>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-end rounded-xl">
              <Card className="bg-card rounded-t-xl  p-0">
                <CardContent className="p-2 pt-2 rounded-xl">
                  <Skeleton className="w-full rounded-t-xl" style={{ height: 'calc(100vh - 200px)' }} />
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader title={ "לוח זמנים"} />
      <div className="flex flex-col bg-muted/50 flex-1 gap-6" dir="rtl" style={{ scrollbarWidth: 'none' }}>
        {/* Calendar Header */}
        <CalendarHeader
          currentDate={currentDate}
          view={view}
          onNavigate={navigateCalendar}
          onToday={goToToday}
          onViewChange={setView}
        />

        <div className="flex gap-6 px-4 lg:px-6 flex-1">
          {/* Statistics Sidebar */}
          <StatisticsSidebar
            currentDate={currentDate}
            onDateSelect={setCurrentDate}
            todayAppointmentsCount={todayAppointments.length}
            todayFreeSlots={todayFreeSlots}
            totalSlots={workScheduleInfo.TOTAL_SLOTS}
            appointmentDuration={APPOINTMENT_DURATION}
            currentUser={currentUser}
          />

          {/* Main Calendar View */}
          <div className="flex-1 flex flex-col justify-end rounded-xl">
            <Card className="bg-card rounded-t-xl  p-0">
              <CardContent className="p-0 pt-0 rounded-xl">
                {view === 'month' ? (
                  <MonthView
                    visibleDates={visibleDates}
                    currentDate={currentDate}
                    getAppointmentsForDate={getAppointmentsForDate}
                    currentUser={currentUser}
                    onDateClick={setCurrentDate}
                    onViewChange={setView}
                  />
                ) : (
                  <WeekDayView
                    visibleDates={visibleDates}
                    timeSlots={timeSlots}
                    totalWorkHours={totalWorkHours}
                    currentUser={currentUser}
                    clients={clients}
                    getAppointmentBlocks={getAppointmentBlocks}
                    getUserColor={getUserColor}
                    getAppointmentDuration={getAppointmentDuration}
                    getDynamicTimeRange={getDynamicTimeRange}
                    handleTimeSlotClick={handleTimeSlotClick}
                    handleMouseDown={handleMouseDown}
                    handleResizeStart={handleResizeStart}
                    openEditDialog={openEditDialog}
                    draggedBlockId={draggedBlockId}
                    dragPosition={dragPosition}
                    resizeData={resizeData}
                    draggedData={draggedData}
                    calendarRef={calendarRef}
                    suppressClickRef={suppressClickRef}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Modals */}
        <ClientSelectModal
          isOpen={isClientSelectOpen}
          onClientSelect={handleClientSelect}
          onClose={() => setIsClientSelectOpen(false)}
        />

        <AppointmentModal
          isOpen={isCreateModalOpen}
          onClose={closeAllDialogs}
          editingAppointment={editingAppointment}
          selectedClient={selectedClient}
          formData={formData}
                users={users}
          saving={saving}
          onInputChange={handleInputChange}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          onUserChange={(userId) => setFormData(prev => ({ ...prev, user_id: userId }))}
        />
      </div>
    </>
  )
}

