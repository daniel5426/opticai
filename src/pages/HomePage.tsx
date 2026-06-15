import React, { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CustomModal } from "@/components/ui/custom-modal"
import { Loader2, Clipboard, Copy, Move, Play, Trash2, UserPlus, Users } from "lucide-react"
import { createAppointment, updateAppointment, deleteAppointment } from "@/lib/db/appointments-db"
import { createClient, getClientById } from "@/lib/db/clients-db"
import { getAllExamLayouts } from "@/lib/db/exam-layouts-db"
import { getDashboardHome } from "@/lib/db/dashboard-db"
import { Appointment, Client, ExamLayout, Settings, User } from "@/lib/db/schema-interface"
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
import { useNavigate } from "@tanstack/react-router"
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
import { useSettings } from "@/hooks/useSettings"

function flattenActiveExamLayouts(layouts: ExamLayout[]): ExamLayout[] {
  return layouts.flatMap((layout) => {
    const children = layout.children ? flattenActiveExamLayouts(layout.children) : []
    if (layout.is_group) return layout.is_active !== false ? children : []
    return layout.is_active === false || !layout.id ? [] : [{ ...layout, children: undefined }]
  })
}

export default function HomePage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [view, setView] = useState<CalendarView>('week')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [dashboardSettings, setDashboardSettings] = useState<Settings | null>(null)
  const [activeExamLayouts, setActiveExamLayouts] = useState<ExamLayout[]>([])
  const [loading, setLoading] = useState(true)
  const { currentUser, currentClinic } = useUser()
  const { settings } = useSettings()
  const navigate = useNavigate()

  const [users, setUsers] = useState<User[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{ date: Date; time: string }>({ date: new Date(), time: '' })
  const [formData, setFormData] = useState<Omit<Appointment, 'id'>>({
    client_id: 0,
    user_id: currentUser?.id,
    date: undefined,
    time: undefined,
    duration: 30,
    exam_name: undefined,
    exam_layout_id: null,
    note: undefined
  })

  useEffect(() => {
    if (currentUser?.id) {
      setFormData(prev => ({ ...prev, user_id: currentUser.id }))
      setNewClientFormData(prev => ({ ...prev, user_id: currentUser.id }))
    }
  }, [currentUser?.id])

  useEffect(() => {
    const loadExamLayouts = async () => {
      if (!currentClinic?.id) {
        setActiveExamLayouts([])
        return
      }
      try {
        const layouts = await getAllExamLayouts(currentClinic.id)
        setActiveExamLayouts(flattenActiveExamLayouts(layouts))
      } catch (error) {
        console.error("Error loading exam layouts:", error)
        setActiveExamLayouts([])
      }
    }
    loadExamLayouts()
  }, [currentClinic?.id])

  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false)
  const [isNewClientAppointmentOpen, setIsNewClientAppointmentOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)
  const [copiedAppointment, setCopiedAppointment] = useState<Appointment | null>(null)
  const [movingAppointment, setMovingAppointment] = useState<Appointment | null>(null)
  const [selectedAppointmentForCopy, setSelectedAppointmentForCopy] = useState<Appointment | null>(null)
  const [slotMenu, setSlotMenu] = useState<{ x: number; y: number; date: Date; time: string } | null>(null)
  const [appointmentMenu, setAppointmentMenu] = useState<{ x: number; y: number; appointment: Appointment } | null>(null)
  const [saving, setSaving] = useState(false)
  const [isSavingNewClientAppointment, setIsSavingNewClientAppointment] = useState(false)
  const [newClientFormData, setNewClientFormData] = useState({
    first_name: "",
    last_name: "",
    phone_mobile: "",
    email: "",
    user_id: currentUser?.id,
    date: "",
    time: "",
    duration: 30,
    exam_name: "",
    exam_layout_id: null as number | null,
    note: "",
  })

  const calendarRef = useRef<HTMLDivElement | null>(null)
  const calendarMoveScopeRef = useRef<HTMLDivElement | null>(null)
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
        setDashboardSettings(data.settings)
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
      setFormData(prev => ({ ...prev, user_id: currentUser?.id || prev.user_id }))
      setIsCreateModalOpen(true)
    }
  }, [isClientSelectOpen, selectedClient, currentUser?.id])

  // Ensure the default examiner in the modal is the current user when modal opens without client selection path (e.g., editing or direct open)
  useEffect(() => {
    if (isCreateModalOpen && !formData.user_id && currentUser?.id) {
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

  const activeSettings = settings || dashboardSettings
  const WORK_START = activeSettings?.work_start_time || "08:00"
  const WORK_END = activeSettings?.work_end_time || "18:00"
  const APPOINTMENT_DURATION = activeSettings?.appointment_duration || 30
  const BREAK_START = activeSettings?.break_start_time || ""
  const BREAK_END = activeSettings?.break_end_time || ""

  const workStartMinutes = timeToMinutes(WORK_START)
  const workEndMinutes = timeToMinutes(WORK_END)
  const totalWorkMinutes = Math.max(0, workEndMinutes - workStartMinutes)

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
    workStartMinutes,
    workEndMinutes,
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
    workStartMinutes,
    getAppointmentDuration,
    resizeData
  })

  // Memoized time slots for the grid
  const timeSlots = useMemo(() => {
    const slotCount = Math.ceil(totalWorkMinutes / 60)
    return Array.from({ length: slotCount }, (_, i) => {
      const startMinutes = workStartMinutes + i * 60
      const durationMinutes = Math.min(60, workEndMinutes - startMinutes)
      return {
        time: minutesToTime(startMinutes),
        startMinutes,
        durationMinutes
      }
    }).filter(slot => slot.durationMinutes > 0)
  }, [totalWorkMinutes, workStartMinutes, workEndMinutes])

  // Form and modal handlers
  const resetAllForms = useCallback(() => {
    setFormData({
      client_id: 0,
      user_id: currentUser?.id,
      date: undefined,
      time: undefined,
      duration: APPOINTMENT_DURATION,
      exam_name: undefined,
      exam_layout_id: null,
      note: undefined
    })
    setSelectedClient(null)
  }, [currentUser?.id, APPOINTMENT_DURATION])

  // Handle time slot click for creating appointments
  const moveAppointmentToSlot = useCallback(async (appointment: Appointment, date: Date, time: string) => {
    if (!appointment.id) return
    const dateStr = format(date, 'yyyy-MM-dd')
    const movedAppointment = {
      ...appointment,
      clinic_id: appointment.clinic_id || currentClinic?.id,
      date: dateStr,
      time,
    }
    const originalAppointment = { ...appointment }

    setMovingAppointment(null)
    setAppointments(prev => prev.map(apt => apt.id === appointment.id ? movedAppointment : apt))

    try {
      if (isUserOnVacation(movedAppointment.user_id, dateStr)) {
        toast.error('לא ניתן להעביר תור ליום חופשה של המשתמש')
        setAppointments(prev => prev.map(apt => apt.id === appointment.id ? originalAppointment : apt))
        return
      }

      const result = await updateAppointment(movedAppointment)
      if (result) {
        setAppointments(prev => prev.map(apt => apt.id === appointment.id ? { ...apt, ...result } : apt))
        toast.success("התור הועבר בהצלחה")
      } else {
        toast.error("שגיאה בהעברת התור")
        setAppointments(prev => prev.map(apt => apt.id === appointment.id ? originalAppointment : apt))
      }
    } catch (error) {
      console.error("Error moving appointment:", error)
      toast.error("שגיאה בהעברת התור")
      setAppointments(prev => prev.map(apt => apt.id === appointment.id ? originalAppointment : apt))
    }
  }, [currentClinic?.id, isUserOnVacation])

  const pasteAppointmentToSlot = useCallback(async (date: Date, time: string) => {
    if (!copiedAppointment) return
    const appointmentData = {
      client_id: copiedAppointment.client_id,
      clinic_id: currentClinic?.id || copiedAppointment.clinic_id,
      user_id: copiedAppointment.user_id,
      date: format(date, 'yyyy-MM-dd'),
      time,
      duration: copiedAppointment.duration || APPOINTMENT_DURATION,
      exam_name: copiedAppointment.exam_name,
      exam_layout_id: copiedAppointment.exam_layout_id || null,
      note: copiedAppointment.note,
    }
    try {
      const result = await createAppointment(appointmentData)
      if (result) {
        setAppointments(prev => [...prev, result])
        toast.success("התור הודבק בהצלחה")
      } else {
        toast.error("שגיאה בהדבקת התור")
      }
    } catch (error) {
      console.error("Error pasting appointment:", error)
      toast.error("שגיאה בהדבקת התור")
    }
  }, [APPOINTMENT_DURATION, copiedAppointment, currentClinic?.id])

  const prepareSlotAppointmentData = useCallback((date: Date, time: string) => {
    const dateStr = format(date, 'yyyy-MM-dd')
    setSelectedTimeSlot({ date, time })
    resetAllForms()
    setFormData({
      client_id: 0,
      user_id: currentUser?.id,
      date: dateStr,
      time: time,
      duration: APPOINTMENT_DURATION,
      exam_name: '',
      exam_layout_id: null,
      note: ''
    })
  }, [resetAllForms, currentUser?.id, APPOINTMENT_DURATION])

  const handleTimeSlotClick = useCallback((date: Date, time: string, event?: React.MouseEvent) => {
    event?.preventDefault()
    event?.stopPropagation()
    setAppointmentMenu(null)
    if (movingAppointment) {
      moveAppointmentToSlot(movingAppointment, date, time)
      return
    }
    prepareSlotAppointmentData(date, time)
    setSlotMenu({
      x: event?.clientX ?? window.innerWidth / 2,
      y: event?.clientY ?? window.innerHeight / 2,
      date,
      time,
    })
  }, [movingAppointment, moveAppointmentToSlot, prepareSlotAppointmentData])

  const closeAllDialogs = useCallback(() => {
    setIsCreateModalOpen(false)
    setIsClientSelectOpen(false)
    setIsNewClientAppointmentOpen(false)
    setEditingAppointment(null)
    resetAllForms()
  }, [resetAllForms])

  const openEditDialog = useCallback((appointment: Appointment) => {
    try {
      setEditingAppointment(appointment)
      // Set form immediately and open modal without waiting for network
      setFormData({
        client_id: appointment.client_id,
        user_id: appointment.user_id || currentUser?.id,
        date: appointment.date || '',
        time: appointment.time || '',
        duration: appointment.duration || APPOINTMENT_DURATION,
        exam_name: appointment.exam_name || '',
        exam_layout_id: appointment.exam_layout_id || null,
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
          user_id: currentUser?.id || prev.user_id,
          date: format(selectedTimeSlot.date, 'yyyy-MM-dd'),
          time: selectedTimeSlot.time,
          duration: APPOINTMENT_DURATION,
          exam_name: '',
          exam_layout_id: null,
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
          exam_layout_id: formData.exam_layout_id,
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

  const handleNewClientInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setNewClientFormData(prev => ({ ...prev, [name]: value }))
  }, [])

  const handleExamLayoutChange = useCallback((layoutId: number | null) => {
    const layout = activeExamLayouts.find(item => item.id === layoutId)
    setFormData(prev => ({
      ...prev,
      exam_layout_id: layout?.id || null,
      exam_name: layout?.name || prev.exam_name || '',
    }))
  }, [activeExamLayouts])

  const handleNewClientExamLayoutChange = useCallback((layoutId: number | null) => {
    const layout = activeExamLayouts.find(item => item.id === layoutId)
    setNewClientFormData(prev => ({
      ...prev,
      exam_layout_id: layout?.id || null,
      exam_name: layout?.name || prev.exam_name,
    }))
  }, [activeExamLayouts])

  const openExistingClientFlowFromSlot = useCallback(() => {
    setSlotMenu(null)
    setIsClientSelectOpen(true)
  }, [])

  const openNewClientFlowFromSlot = useCallback(() => {
    setSlotMenu(null)
    setNewClientFormData({
      first_name: "",
      last_name: "",
      phone_mobile: "",
      email: "",
      user_id: currentUser?.id,
      date: formData.date || format(selectedTimeSlot.date, 'yyyy-MM-dd'),
      time: formData.time || selectedTimeSlot.time,
      duration: formData.duration || APPOINTMENT_DURATION,
      exam_name: "",
      exam_layout_id: null,
      note: "",
    })
    setIsNewClientAppointmentOpen(true)
  }, [APPOINTMENT_DURATION, currentUser?.id, formData.date, formData.duration, formData.time, selectedTimeSlot])

  const handleSaveNewClientAndAppointment = useCallback(async () => {
    if (!newClientFormData.first_name.trim() || !newClientFormData.last_name.trim()) {
      toast.error("שם פרטי ושם משפחה הם שדות חובה")
      return
    }
    try {
      setIsSavingNewClientAppointment(true)
      const newClient = await createClient({
        first_name: newClientFormData.first_name,
        last_name: newClientFormData.last_name,
        phone_mobile: newClientFormData.phone_mobile,
        email: newClientFormData.email,
        clinic_id: currentClinic?.id,
      })
      if (!newClient?.id) {
        toast.error("שגיאה ביצירת הלקוח")
        return
      }

      const result = await createAppointment({
        client_id: newClient.id,
        clinic_id: currentClinic?.id,
        user_id: newClientFormData.user_id,
        date: newClientFormData.date,
        time: newClientFormData.time,
        duration: newClientFormData.duration,
        exam_name: newClientFormData.exam_name,
        exam_layout_id: newClientFormData.exam_layout_id,
        note: newClientFormData.note,
      })
      if (result) {
        setClients(prev => [...prev, newClient])
        setAppointments(prev => [...prev, result])
        toast.success("לקוח חדש ותור נוצרו בהצלחה")
        closeAllDialogs()
      } else {
        toast.error("שגיאה ביצירת התור")
      }
    } catch (error) {
      console.error("Error creating client appointment from calendar:", error)
      toast.error("שגיאה ביצירת לקוח ותור")
    } finally {
      setIsSavingNewClientAppointment(false)
    }
  }, [closeAllDialogs, currentClinic?.id, newClientFormData])

  const handleCopyAppointment = useCallback((appointment: Appointment) => {
    setCopiedAppointment(appointment)
    setSelectedAppointmentForCopy(appointment)
    setAppointmentMenu(null)
    toast.success("התור הועתק")
  }, [])

  const handleStartMoveAppointment = useCallback((appointment: Appointment) => {
    setMovingAppointment(appointment)
    setAppointmentMenu(null)
    toast.info("בחר מיקום חדש לתור")
  }, [])

  const handleStartExam = useCallback((appointment?: Appointment | null) => {
    const target = appointment || editingAppointment || formData
    if (!target.client_id || !target.exam_layout_id) {
      toast.error("יש לבחור סוג בדיקה לפני התחלת בדיקה")
      return
    }
    setAppointmentMenu(null)
    navigate({
      to: "/clients/$clientId/exams/new",
      params: { clientId: String(target.client_id) },
      search: { layoutId: String(target.exam_layout_id) },
    })
  }, [editingAppointment, formData, navigate])

  const handleAppointmentContextMenu = useCallback((event: React.MouseEvent, appointment: Appointment) => {
    event.preventDefault()
    event.stopPropagation()
    setSelectedAppointmentForCopy(appointment)
    setSlotMenu(null)
    setAppointmentMenu({
      x: event.clientX,
      y: event.clientY,
      appointment,
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {
        const activeElement = document.activeElement
        const isTyping =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute("contenteditable") === "true"
        if (isTyping || !selectedAppointmentForCopy) return
        event.preventDefault()
        handleCopyAppointment(selectedAppointmentForCopy)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleCopyAppointment, selectedAppointmentForCopy])

  useEffect(() => {
    const handleDocumentMouseDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        movingAppointment &&
        calendarMoveScopeRef.current &&
        !calendarMoveScopeRef.current.contains(target)
      ) {
        setMovingAppointment(null)
      }
      if (slotMenu || appointmentMenu) {
        const menuElement = (target as HTMLElement).closest?.("[data-calendar-menu]")
        if (!menuElement) {
          setSlotMenu(null)
          setAppointmentMenu(null)
        }
      }
    }
    document.addEventListener("mousedown", handleDocumentMouseDown)
    return () => document.removeEventListener("mousedown", handleDocumentMouseDown)
  }, [appointmentMenu, movingAppointment, slotMenu])

  
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
      <div ref={calendarMoveScopeRef} className="flex flex-col bg-muted/50 flex-1" dir="rtl" style={{ scrollbarWidth: 'none' }}>
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
                    totalWorkMinutes={totalWorkMinutes}
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
                    onAppointmentContextMenu={handleAppointmentContextMenu}
                    onAppointmentSelect={setSelectedAppointmentForCopy}
                    isMoveMode={Boolean(movingAppointment)}
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
          examLayouts={activeExamLayouts}
          saving={saving}
          onInputChange={handleInputChange}
          onSave={handleSaveAppointment}
          onDelete={handleDeleteAppointment}
          onUserChange={(userId) => setFormData(prev => ({ ...prev, user_id: userId }))}
          onExamLayoutChange={handleExamLayoutChange}
          onStartExam={() => handleStartExam()}
        />

        {slotMenu && (
          <div
            data-calendar-menu
            className="fixed z-50 min-w-52 rounded-md border bg-card p-1 text-sm shadow-lg"
            style={{ left: slotMenu.x, top: slotMenu.y }}
            dir="rtl"
          >
            {copiedAppointment && (
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right hover:bg-muted"
                onClick={() => {
                  pasteAppointmentToSlot(slotMenu.date, slotMenu.time)
                  setSlotMenu(null)
                }}
              >
                <Clipboard className="h-4 w-4" />
                הדבק תור
              </button>
            )}
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right hover:bg-muted"
              onClick={openExistingClientFlowFromSlot}
            >
              <Users className="h-4 w-4" />
              תור מלקוח קיים
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right hover:bg-muted"
              onClick={openNewClientFlowFromSlot}
            >
              <UserPlus className="h-4 w-4" />
              תור מלקוח חדש
            </button>
          </div>
        )}

        {appointmentMenu && (
          <div
            data-calendar-menu
            className="fixed z-50 min-w-44 rounded-md border bg-card p-1 text-sm shadow-lg"
            style={{ left: appointmentMenu.x, top: appointmentMenu.y }}
            dir="rtl"
          >
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              disabled={!appointmentMenu.appointment.exam_layout_id}
              onClick={() => handleStartExam(appointmentMenu.appointment)}
            >
              <Play className="h-4 w-4" />
              התחל בדיקה
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right hover:bg-muted"
              onClick={() => handleCopyAppointment(appointmentMenu.appointment)}
            >
              <Copy className="h-4 w-4" />
              העתק
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right hover:bg-muted"
              onClick={() => handleStartMoveAppointment(appointmentMenu.appointment)}
            >
              <Move className="h-4 w-4" />
              העבר
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-right text-destructive hover:bg-destructive/10"
              onClick={() => {
                handleDeleteAppointment(appointmentMenu.appointment.id!)
                setAppointmentMenu(null)
              }}
            >
              <Trash2 className="h-4 w-4" />
              מחק
            </button>
          </div>
        )}

        <CustomModal
          isOpen={isNewClientAppointmentOpen}
          onClose={closeAllDialogs}
          title="לקוח חדש ותור"
          className="sm:max-w-[500px]"
        >
          <div className="grid max-h-[60vh] gap-4 overflow-auto p-1" style={{ scrollbarWidth: "none" }}>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-new-first-name" className="block text-right">שם פרטי *</Label>
                <Input id="calendar-new-first-name" name="first_name" value={newClientFormData.first_name} onChange={handleNewClientInputChange} dir="rtl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-new-last-name" className="block text-right">שם משפחה *</Label>
                <Input id="calendar-new-last-name" name="last_name" value={newClientFormData.last_name} onChange={handleNewClientInputChange} dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="calendar-new-email" className="block text-right">אימייל</Label>
                <Input id="calendar-new-email" name="email" type="email" value={newClientFormData.email} onChange={handleNewClientInputChange} dir="rtl" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-new-phone" className="block text-right">טלפון נייד</Label>
                <Input id="calendar-new-phone" name="phone_mobile" value={newClientFormData.phone_mobile} onChange={handleNewClientInputChange} dir="rtl" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="block text-right">תאריך</Label>
                <Input name="date" type="date" value={newClientFormData.date} onChange={handleNewClientInputChange} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-new-time" className="block text-right">שעה</Label>
                <Input id="calendar-new-time" name="time" type="time" value={newClientFormData.time} onChange={handleNewClientInputChange} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="block text-right">סוג בדיקה</Label>
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm"
                  value={newClientFormData.exam_layout_id ? String(newClientFormData.exam_layout_id) : ""}
                  onChange={(event) => handleNewClientExamLayoutChange(event.target.value ? Number(event.target.value) : null)}
                  dir="rtl"
                >
                  <option value="">בחר סוג בדיקה</option>
                  {activeExamLayouts.map(layout => (
                    <option key={layout.id} value={layout.id}>{layout.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="calendar-new-duration" className="block text-right">משך</Label>
                <Input id="calendar-new-duration" name="duration" type="number" value={newClientFormData.duration} onChange={handleNewClientInputChange} />
              </div>
            </div>
            <div className="space-y-2 pb-2">
              <Label htmlFor="calendar-new-note" className="block text-right">הערות</Label>
              <Textarea id="calendar-new-note" name="note" value={newClientFormData.note} onChange={handleNewClientInputChange} dir="rtl" />
            </div>
          </div>
          <div className="mt-4 flex justify-start gap-2">
            <Button onClick={handleSaveNewClientAndAppointment} disabled={isSavingNewClientAppointment}>
              {isSavingNewClientAppointment && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              שמור
            </Button>
            <Button variant="outline" onClick={closeAllDialogs}>ביטול</Button>
          </div>
        </CustomModal>
      </div>
    </>
  )
}
