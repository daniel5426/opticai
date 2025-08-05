import React, { useState, useEffect, useRef } from "react"
import { SiteHeader } from "@/components/site-header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  CalendarDays,
  Users,
  Clock,
  UserPlus,
  ChevronLeft,
  ChevronRight,
  Plus,
  Edit2,
  Trash2
} from "lucide-react"
import { getAllAppointments, createAppointment, updateAppointment, deleteAppointment } from "@/lib/db/appointments-db"
import { getAllClients, getClientById, createClient } from "@/lib/db/clients-db"
import { getSettings } from "@/lib/db/settings-db"
import { getAllUsers } from "@/lib/db/users-db"
import { applyThemeColorsFromSettings } from "@/helpers/theme_helpers"
import { Appointment, Client, Settings } from "@/lib/db/schema-interface"
import {
  format,
  isToday,
  startOfMonth,
  endOfMonth,
  isWithinInterval,
  parseISO,
  addMinutes,
  startOfWeek,
  endOfWeek,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  isSameDay,
  startOfDay,
  endOfDay,
  getHours,
  getMinutes,
  differenceInMinutes
} from "date-fns"
import { he } from "date-fns/locale"
import { ClientSelectModal } from "@/components/ClientSelectModal"
import { toast } from "sonner"
import { CustomModal } from "@/components/ui/custom-modal"
import { ClientWarningModal } from "@/components/ClientWarningModal"
import { UserSelect } from "@/components/ui/user-select"
import { useUser } from "@/contexts/UserContext"
import { OctahedronLoader } from "@/components/ui/octahedron-loader"


type CalendarView = 'day' | 'week' | 'month'

interface AppointmentBlock extends Appointment {
  client?: Client
  top: number
  height: number
  left: number
  width: number
  zIndex: number
}

interface DragData {
  appointment: Appointment
  offset: { x: number; y: number }
  originalElement: HTMLElement
}


export default function HomePage() {
  const [currentDate, setCurrentDate] = useState<Date>(new Date())
  const [view, setView] = useState<CalendarView>('week')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const { currentUser, currentClinic } = useUser()

  const [draggedData, setDraggedData] = useState<DragData | null>(null)
  const [draggedBlockId, setDraggedBlockId] = useState<number | null>(null)
  const [dragPosition, setDragPosition] = useState<{ x: number; y: number; date: Date; time: string } | null>(null)
  const [resizeData, setResizeData] = useState<{
    appointmentId: number;
    type: 'top' | 'bottom';
    originalStart: string;
    originalEnd: string;
  } | null>(null)
  const [users, setUsers] = useState<any[]>([])
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

  const [isNewClientDialogOpen, setIsNewClientDialogOpen] = useState(false)
  const [isClientSelectOpen, setIsClientSelectOpen] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null)

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

  const calendarRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [appointmentsData, clientsData, settingsData, usersData] = await Promise.all([
        getAllAppointments(currentClinic?.id),
        getAllClients(currentClinic?.id),
        getSettings(currentClinic?.id),
        getAllUsers(currentClinic?.id)
      ])
      setAppointments(appointmentsData)
      setClients(clientsData)
      setSettings(settingsData)
      setUsers(usersData)

      if (currentUser?.id) {
        await applyThemeColorsFromSettings(undefined, currentUser.id)
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (currentClinic) {
      loadData()
    }
  }, [currentUser?.id, currentClinic])

  useEffect(() => {
    if (!isClientSelectOpen && selectedClient) {
      setIsCreateModalOpen(true)
    }
  }, [isClientSelectOpen, selectedClient])

  useEffect(() => {
    if (!isCreateModalOpen && !isNewClientDialogOpen && !isClientSelectOpen) {
      setTimeout(() => {
        document.body.focus()
        const backdrops = document.querySelectorAll('[data-radix-portal]')
        backdrops.forEach(backdrop => {
          if (backdrop.innerHTML === '') {
            backdrop.remove()
          }
        })
      }, 100)
    }
  }, [isCreateModalOpen, isNewClientDialogOpen, isClientSelectOpen])

  const WORK_START = settings?.work_start_time || "08:00"
  const WORK_END = settings?.work_end_time || "18:00"
  const APPOINTMENT_DURATION = settings?.appointment_duration || 30
  const BREAK_START = settings?.break_start_time || ""
  const BREAK_END = settings?.break_end_time || ""

  const workStartHour = parseInt(WORK_START.split(':')[0])
  const workEndHour = parseInt(WORK_END.split(':')[0])
  const totalWorkHours = workEndHour - workStartHour

  // Helper function to get user color with conflict resolution
  const getUserColor = (userId?: number) => {
    if (!userId) return '#3b82f6' // default blue

    const user = users.find(u => u.id === userId)
    if (!user || !user.primary_theme_color) return '#3b82f6'

    // Check for color conflicts
    const colorCount = users.filter(u => u.primary_theme_color === user.primary_theme_color).length
    const userIndex = users.filter(u => u.primary_theme_color === user.primary_theme_color)
      .findIndex(u => u.id === userId)

    if (colorCount > 1 && userIndex > 0) {
      // Generate a variant color by adjusting HSL
      const hex = user.primary_theme_color
      const hsl = hexToHsl(hex)
      const adjustedHue = (hsl[0] + (userIndex * 60)) % 360 // Shift hue
      return hslToHex(adjustedHue, hsl[1], hsl[2])
    }

    return user.primary_theme_color
  }

  // Helper functions for color conversion
  const hexToHsl = (hex: string): [number, number, number] => {
    const r = parseInt(hex.slice(1, 3), 16) / 255
    const g = parseInt(hex.slice(3, 5), 16) / 255
    const b = parseInt(hex.slice(5, 7), 16) / 255

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    let h = 0, s = 0, l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break
        case g: h = (b - r) / d + 2; break
        case b: h = (r - g) / d + 4; break
      }
      h /= 6
    }

    return [h * 360, s * 100, l * 100]
  }

  const hslToHex = (h: number, s: number, l: number): string => {
    h /= 360; s /= 100; l /= 100
    const a = s * Math.min(l, 1 - l)
    const f = (n: number) => {
      const k = (n + h * 12) % 12
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
      return Math.round(255 * color).toString(16).padStart(2, '0')
    }
    return `#${f(0)}${f(8)}${f(4)}`
  }

  // Helper function to format appointment time range
  const getAppointmentTimeRange = (startTime: string, duration: number = APPOINTMENT_DURATION) => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = startMinutes + duration
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60

    return `${startTime} - ${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
  }

  // Get appointment duration (from database or default)
  const getAppointmentDuration = (appointment: Appointment) => {
    return appointment.duration || APPOINTMENT_DURATION
  }

  // Get dynamic appointment time range for resizing
  const getDynamicTimeRange = (appointment: Appointment) => {
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
  }

  // Navigation functions
  const navigateCalendar = (direction: 'prev' | 'next') => {
    if (view === 'day') {
      setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1))
    } else if (view === 'week') {
      setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1))
    } else if (view === 'month') {
      setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1))
    }
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  // Get visible dates based on view
  const getVisibleDates = () => {
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
  }

  const visibleDates = getVisibleDates()

  // Filter appointments for visible dates
  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(appointment => {
      if (!appointment.date) return false
      try {
        const appointmentDate = new Date(appointment.date)
        return isSameDay(appointmentDate, date)
      } catch {
        return false
      }
    })
  }

  // Convert appointments to positioned blocks
  const getAppointmentBlocks = (date: Date): AppointmentBlock[] => {
    const dayAppointments = getAppointmentsForDate(date)
    const HOUR_HEIGHT = 95
    const blocks: AppointmentBlock[] = []

    dayAppointments.forEach(appointment => {
      if (!appointment.time) return

      let startTime = appointment.time

      // During resize, determine the actual start time
      if (resizeData && resizeData.appointmentId === appointment.id) {
        if (resizeData.type === 'bottom') {
          // Bottom resize: use original start time for positioning
          startTime = resizeData.originalStart
        }
        // For top resize, we use the current appointment.time as it represents the new start time
      }

      const [hours, minutes] = startTime.split(':').map(Number)
      const startMinutes = (hours - workStartHour) * 60 + minutes
      const top = (startMinutes / 60) * HOUR_HEIGHT

      // Calculate height based on appointment duration and resize state
      const appointmentDuration = getAppointmentDuration(appointment)
      let height = (appointmentDuration / 60) * HOUR_HEIGHT

      if (resizeData && resizeData.appointmentId === appointment.id) {
        // During resize, use the appointment's current duration (which is updated in real-time)
        const currentDuration = appointment.duration || appointmentDuration
        height = Math.max((currentDuration / 60) * HOUR_HEIGHT, 15) // Minimum height of 15px
      }

      const client = clients.find(c => c.id === appointment.client_id)

      blocks.push({
        ...appointment,
        client,
        top,
        height,
        left: 0,
        width: 100,
        zIndex: 1
      })
    })

    // Handle overlapping appointments
    blocks.sort((a, b) => {
      if (a.top !== b.top) return a.top - b.top
      // If same start time, sort by appointment ID for consistent positioning
      return (a.id || 0) - (b.id || 0)
    })

    // Helper function to check if two appointments should split width
    const shouldSplitWidth = (block1: AppointmentBlock, block2: AppointmentBlock) => {
      // Find the overlap period
      const overlapStart = Math.max(block1.top, block2.top)
      const overlapEnd = Math.min(block1.top + block1.height, block2.top + block2.height)
      
      // If no overlap, don't split
      if (overlapStart >= overlapEnd) return false
      
      // Calculate non-overlapping gaps
      const block1Start = block1.top
      const block1End = block1.top + block1.height
      const block2Start = block2.top
      const block2End = block2.top + block2.height
      
      // Find continuous non-overlapping periods
      const gaps = []
      
      // Gap before overlap (if any)
      const earliestStart = Math.min(block1Start, block2Start)
      if (overlapStart > earliestStart) {
        gaps.push(overlapStart - earliestStart)
      }
      
      // Gap after overlap (if any)
      const latestEnd = Math.max(block1End, block2End)
      if (overlapEnd < latestEnd) {
        gaps.push(latestEnd - overlapEnd)
      }
      
      // Check if any continuous gap is 20 minutes or more (20 minutes = 20px at 1px per minute)
      const TWENTY_MINUTES_HEIGHT = 20
      return !gaps.some(gap => gap >= TWENTY_MINUTES_HEIGHT)
    }

    for (let i = 0; i < blocks.length; i++) {
      const current = blocks[i]
      // Find overlapping appointments that should split width
      const overlappingToSplit = blocks.filter(block =>
        block !== current &&
        shouldSplitWidth(current, block)
      )

      if (overlappingToSplit.length > 0) {
        const totalOverlapping = overlappingToSplit.length + 1
        const width = 100 / totalOverlapping

        current.width = width
        
        // Find all overlapping appointments (including current) and sort them consistently
        const allOverlapping = [current, ...overlappingToSplit].sort((a, b) => {
          if (a.top !== b.top) return a.top - b.top
          // If same start time, sort by appointment ID for consistent positioning
          return (a.id || 0) - (b.id || 0)
        })
        
        // Find the index of current appointment in the sorted overlapping group
        const currentIndex = allOverlapping.findIndex(block => block.id === current.id)
        current.left = currentIndex * width
        current.zIndex = 2
      }
    }

    // Set z-index based on duration - smaller appointments always on top
    blocks.forEach(block => {
      // Calculate how many other appointments this one overlaps with
      const overlappingBlocks = blocks.filter(other => 
        other !== block &&
        other.top < block.top + block.height &&
        other.top + other.height > block.top
      )
      
      if (overlappingBlocks.length > 0) {
        // Base z-index on inverse of duration (smaller duration = higher z-index)
        const appointmentDuration = getAppointmentDuration(block)
        // Use a smaller scale to stay below modal z-index (50)
        // Scale down to keep all values under 40: 15min = ~27, 30min = ~13, 60min = ~7
        let baseZIndex = Math.floor(400 / appointmentDuration)
        
        // Add tie-breaker: if durations are very close, prioritize by start time (later start = higher z-index)
        const startTimeMinutes = timeToMinutes(block.time || '00:00')
        const tieBreaker = Math.floor(startTimeMinutes / 1000) // Very small adjustment based on start time
        
        block.zIndex = baseZIndex + tieBreaker + 10
      } else {
        // Non-overlapping appointments use default z-index
        block.zIndex = block.width < 100 ? 2 : 1
      }
    })

    return blocks
  }

  // Time slots for the grid
  const timeSlots = Array.from({ length: totalWorkHours }, (_, i) => {
    const hour = workStartHour + i
    return {
      time: `${hour.toString().padStart(2, '0')}:00`,
      hour: hour
    }
  })

  // Handle time slot click for creating appointments
  const handleTimeSlotClick = (date: Date, time: string) => {
    setSelectedTimeSlot({ date, time })
    resetAllForms()
    setFormData({
      client_id: 0,
      user_id: currentUser?.id || 0,
      date: format(date, 'yyyy-MM-dd'),
      time: time,
      duration: APPOINTMENT_DURATION,
      exam_name: '',
      note: ''
    })
    setIsClientSelectOpen(true)
  }

  // Resize functionality
  const handleResizeStart = (e: React.MouseEvent, appointment: Appointment, type: 'top' | 'bottom') => {
    e.preventDefault()
    e.stopPropagation()

    const appointmentDuration = getAppointmentDuration(appointment)
    const endTime = getAppointmentEndTime(appointment.time || '', appointmentDuration)
    setResizeData({
      appointmentId: appointment.id!,
      type,
      originalStart: appointment.time || '',
      originalEnd: endTime
    })

    // Prevent dragging when resizing
    document.body.style.userSelect = 'none'
  }

  const getAppointmentEndTime = (startTime: string, duration: number): string => {
    const [hours, minutes] = startTime.split(':').map(Number)
    const startMinutes = hours * 60 + minutes
    const endMinutes = startMinutes + duration
    const endHours = Math.floor(endMinutes / 60)
    const endMins = endMinutes % 60
    return `${endHours.toString().padStart(2, '0')}:${endMins.toString().padStart(2, '0')}`
  }

  const calculateResizePosition = (e: MouseEvent) => {
    if (!calendarRef.current || !resizeData) return null

    const calendarRect = calendarRef.current.getBoundingClientRect()
    const scrollableContainer = calendarRef.current.querySelector('.overflow-y-auto')
    const scrollTop = scrollableContainer ? scrollableContainer.scrollTop : 0
    const timeColumnWidth = 64 // w-16 = 64px
    const headerHeight = 40 // Fixed header height
    
    const gridRect = {
      top: calendarRect.top + headerHeight,
      height: calendarRect.height - headerHeight,
      left: calendarRect.left + timeColumnWidth
    }

    // Add scroll offset to account for scrolled position
    const y = e.clientY - gridRect.top + scrollTop
    const HOUR_HEIGHT = 95
    const totalMinutesFromTop = Math.max(0, (y / HOUR_HEIGHT) * 60)
    const snappedMinutes = Math.round(totalMinutesFromTop / 5) * 5 // 5-minute precision

    const targetHour = Math.floor(snappedMinutes / 60) + workStartHour
    const targetMinute = snappedMinutes % 60

    // Ensure within work hours
    const clampedHour = Math.max(workStartHour, Math.min(workEndHour, targetHour))
    const clampedMinute = clampedHour === workEndHour ? 0 : targetMinute

    const newTime = `${Math.floor(clampedHour).toString().padStart(2, '0')}:${Math.floor(clampedMinute).toString().padStart(2, '0')}`

    if (resizeData.type === 'top') {
      // Resizing from top - change start time, keep end time fixed
      const originalEndMinutes = timeToMinutes(resizeData.originalEnd)
      const newStartMinutes = timeToMinutes(newTime)
      if (newStartMinutes < originalEndMinutes && newStartMinutes >= workStartHour * 60) {
        return { startTime: newTime, endTime: resizeData.originalEnd }
      }
    } else {
      // Resizing from bottom - change end time, keep start time fixed
      const originalStartMinutes = timeToMinutes(resizeData.originalStart)
      const newEndMinutes = timeToMinutes(newTime)
      // Clamp end time to not exceed work hours
      const maxEndMinutes = workEndHour * 60
      const clampedEndMinutes = Math.min(newEndMinutes, maxEndMinutes)
      const clampedEndTime = minutesToTime(clampedEndMinutes)
      
      if (clampedEndMinutes > originalStartMinutes) {
        return { startTime: resizeData.originalStart, endTime: clampedEndTime }
      }
    }

    return null
  }

  const timeToMinutes = (time: string): number => {
    const [hours, minutes] = time.split(':').map(Number)
    return hours * 60 + minutes
  }

  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
  }

  // Drag and drop functionality
  const handleMouseDown = (e: React.MouseEvent, appointment: Appointment) => {
    // Don't start dragging if we're already resizing
    if (resizeData) return

    e.preventDefault()
    e.stopPropagation()

    const rect = e.currentTarget.getBoundingClientRect()
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }

    setDraggedData({
      appointment,
      offset,
      originalElement: e.currentTarget as HTMLElement
    })
    setDraggedBlockId(appointment.id!)
  }

  const calculateDragPosition = (e: MouseEvent) => {
    if (!calendarRef.current || !draggedData) return null

    const calendarRect = calendarRef.current.getBoundingClientRect()
    const scrollableContainer = calendarRef.current.querySelector('.overflow-y-auto')
    const scrollTop = scrollableContainer ? scrollableContainer.scrollTop : 0
    const timeColumnWidth = 64 // w-16 = 64px
    const headerHeight = 40 // Fixed header height
    
    const gridRect = {
      left: 30,
      top: calendarRect.top + headerHeight,
      width: calendarRect.width - timeColumnWidth,
      height: calendarRect.height - headerHeight
    }

    // Use the offset to maintain the relative position where the user clicked
    const x = e.clientX - gridRect.left
    // Add scroll offset to account for scrolled position
    const y = e.clientY - gridRect.top - draggedData.offset.y + scrollTop

    // Calculate which day column (accounting for RTL layout)
    const dayWidth = gridRect.width / visibleDates.length
    const rawDayIndex = Math.floor(x / dayWidth)
    // In RTL, reverse the column index since columns are visually flipped
    const dayIndex = Math.max(0, Math.min(visibleDates.length - 1, visibleDates.length - 1 - rawDayIndex))
    const targetDate = visibleDates[dayIndex]

    // Calculate time with 15-minute precision, accounting for the click offset
    const HOUR_HEIGHT = 95
    const SLOT_HEIGHT = 15 // 15 minutes = 1/4 hour
    const totalMinutesFromTop = Math.max(0, (y / HOUR_HEIGHT) * 60)
    const snappedMinutes = Math.round(totalMinutesFromTop / 15) * 15

    const targetHour = Math.floor(snappedMinutes / 60) + workStartHour
    const targetMinute = snappedMinutes % 60

    // Get appointment duration to ensure it doesn't go beyond work hours
    const appointmentDuration = draggedData ? getAppointmentDuration(draggedData.appointment) : 30
    const appointmentDurationMinutes = appointmentDuration

    // Calculate the maximum allowed start time in minutes from work start
    const workStartMinutes = workStartHour * 60
    const workEndMinutes = workEndHour * 60
    const maxAllowedStartMinutes = workEndMinutes - appointmentDurationMinutes
    
    // Convert target time to minutes from work start
    const targetMinutesFromWorkStart = (targetHour - workStartHour) * 60 + targetMinute
    
    // Clamp to valid range
    const clampedMinutesFromWorkStart = Math.max(0, Math.min(maxAllowedStartMinutes - workStartMinutes, targetMinutesFromWorkStart))
    
    // Convert back to hour and minute
    const clampedHour = Math.floor(clampedMinutesFromWorkStart / 60) + workStartHour
    const clampedMinute = clampedMinutesFromWorkStart % 60

    const newTime = `${Math.floor(clampedHour).toString().padStart(2, '0')}:${Math.floor(clampedMinute).toString().padStart(2, '0')}`

    // Calculate the visual position based on the clamped time
    const visualY = (clampedMinutesFromWorkStart / 60) * HOUR_HEIGHT

    return {
      x: dayIndex * dayWidth,
      y: visualY,
      date: targetDate,
      time: newTime
    }
  }

  const handleMouseMove = (e: MouseEvent) => {
    if (draggedData && calendarRef.current && !resizeData) {
      const position = calculateDragPosition(e)
      if (position) {
        setDragPosition(position)
      }
    }

    if (resizeData && calendarRef.current) {
      // Handle resize mode - prevent other interactions
      e.preventDefault()
      const resizePosition = calculateResizePosition(e)
      if (resizePosition) {
        // Update the appointment temporarily for visual feedback
        if (resizeData.type === 'top') {
          // Dragging top handle - update start time and calculate new duration
          const originalEndMinutes = timeToMinutes(resizeData.originalEnd)
          const newStartMinutes = timeToMinutes(resizePosition.startTime)
          const newDuration = originalEndMinutes - newStartMinutes

          setAppointments(prev => prev.map(apt =>
            apt.id === resizeData.appointmentId
              ? { ...apt, time: resizePosition.startTime, duration: newDuration }
              : apt
          ))
        } else {
          // Dragging bottom handle - keep start time, update duration
          const startMinutes = timeToMinutes(resizeData.originalStart)
          const newEndMinutes = timeToMinutes(resizePosition.endTime)
          const newDuration = newEndMinutes - startMinutes

          setAppointments(prev => prev.map(apt =>
            apt.id === resizeData.appointmentId
              ? { ...apt, time: resizeData.originalStart, duration: newDuration }
              : apt
          ))
        }
      }
    }
  }

  const handleMouseUp = async (e: MouseEvent) => {
    // Reset body style
    document.body.style.userSelect = ''

    if (draggedData && dragPosition && !resizeData) {
      // Optimistic update - immediately update UI
      const updatedAppointment = {
        ...draggedData.appointment,
        date: format(dragPosition.date, 'yyyy-MM-dd'),
        time: dragPosition.time
      }

      // Store original appointment for rollback
      const originalAppointment = { ...draggedData.appointment }

      // Clear drag state immediately to stop cursor following
      setDraggedData(null)
      setDraggedBlockId(null)
      setDragPosition(null)

      // Optimistically update the UI
      setAppointments(prev => prev.map(apt =>
        apt.id === updatedAppointment.id ? updatedAppointment : apt
      ))

      try {
        const result = await updateAppointment(updatedAppointment)
        if (result) {
          toast.success("התור הועבר בהצלחה")
        } else {
          toast.error("שגיאה בהעברת התור")
          // Rollback on error
          setAppointments(prev => prev.map(apt =>
            apt.id === originalAppointment.id ? originalAppointment : apt
          ))
        }
      } catch (error) {
        console.error('Error moving appointment:', error)
        toast.error("שגיאה בהעברת התור")
        // Rollback on error
        setAppointments(prev => prev.map(apt =>
          apt.id === originalAppointment.id ? originalAppointment : apt
        ))
      }
    }

    if (resizeData) {
      const resizePosition = calculateResizePosition(e)
      if (resizePosition) {
        const originalAppointment = appointments.find(a => a.id === resizeData.appointmentId)
        if (originalAppointment) {
          let updatedAppointment: Appointment | null = null

          if (resizeData.type === 'top') {
            // Top resize: change start time, calculate new duration
            const originalEndMinutes = timeToMinutes(resizeData.originalEnd)
            const newStartMinutes = timeToMinutes(resizePosition.startTime)
            const newDuration = originalEndMinutes - newStartMinutes

            updatedAppointment = {
              ...originalAppointment,
              time: resizePosition.startTime,
              duration: newDuration
            }
          } else {
            // Bottom resize: keep start time, change duration
            const startMinutes = timeToMinutes(resizeData.originalStart)
            const newEndMinutes = timeToMinutes(resizePosition.endTime)
            const newDuration = newEndMinutes - startMinutes

            updatedAppointment = {
              ...originalAppointment,
              time: resizeData.originalStart,
              duration: newDuration
            }
          }

          // Store original appointment for rollback
          const originalAppointmentCopy = { ...originalAppointment }

          // Clear resize state immediately to stop cursor following
          setResizeData(null)

          // Optimistically update the UI
          setAppointments(prev => prev.map(apt =>
            apt.id === updatedAppointment?.id ? updatedAppointment! : apt
          ))

          try {
            const result = await updateAppointment(updatedAppointment)
            if (result) {
              toast.success("התור עודכן בהצלחה")
            } else {
              toast.error("שגיאה בעדכון התור")
              // Rollback on error
              setAppointments(prev => prev.map(apt =>
                apt.id === originalAppointmentCopy.id ? originalAppointmentCopy : apt
              ))
            }
          } catch (error) {
            console.error('Error resizing appointment:', error)
            toast.error("שגיאה בעדכון התור")
            // Rollback on error
            setAppointments(prev => prev.map(apt =>
              apt.id === originalAppointmentCopy.id ? originalAppointmentCopy : apt
            ))
          }
        }
      } else {
        // Invalid resize position, restore original state
        setResizeData(null)
        await loadData()
      }
    }

    // Reset remaining states
    setDraggedData(null)
    setDraggedBlockId(null)
    setDragPosition(null)
    setResizeData(null)
  }

  useEffect(() => {
    if (draggedData || resizeData) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [draggedData, dragPosition, resizeData])

  // Form and modal handlers (keeping existing functionality)
  const resetAllForms = () => {
    setFormData({
      client_id: 0,
      user_id: currentUser?.id || 0,
      date: undefined,
      time: undefined,
      duration: APPOINTMENT_DURATION,
      exam_name: undefined,
      note: undefined
    })
    setNewClientFormData({
      first_name: '',
      last_name: '',
      phone_mobile: '',
      email: '',
      user_id: currentUser?.id || 0,
      date: '',
      time: '',
      duration: APPOINTMENT_DURATION,
      exam_name: '',
      note: ''
    })
    setSelectedClient(null)
    setExistingClientWarning({ show: false, clients: [], type: 'name' })
  }

  const closeAllDialogs = () => {
    setIsCreateModalOpen(false)
    setIsNewClientDialogOpen(false)
    setIsClientSelectOpen(false)
    setEditingAppointment(null)
    resetAllForms()
  }

  const openEditDialog = async (appointment: Appointment) => {
    try {
      setEditingAppointment(appointment)
      const client = await getClientById(appointment.client_id)
      if (client) {
        setSelectedClient(client)
      }
      setFormData({
        client_id: appointment.client_id,
        user_id: appointment.user_id || currentUser?.id || 0,
        date: appointment.date || undefined,
        time: appointment.time || undefined,
        duration: appointment.duration || APPOINTMENT_DURATION,
        exam_name: appointment.exam_name || undefined,
        note: appointment.note || undefined
      })
      setIsCreateModalOpen(true)
    } catch (error) {
      console.error('Error loading appointment for edit:', error)
    }
  }

  const handleClientSelect = async (selectedClientId: number) => {
    try {
      const client = await getClientById(selectedClientId)
      if (client) {
        setSelectedClient(client)
        setFormData(prev => ({
          ...prev,
          client_id: selectedClientId,
          user_id: currentUser?.id || 0,
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
  }

  const handleSaveAppointment = async () => {
    try {
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
    }
  }

  const handleDeleteAppointment = async (appointmentId: number) => {
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
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  // Get display title for current view
  const getDisplayTitle = () => {
    if (view === 'day') {
      return format(currentDate, 'dd/MM/yyyy - EEEE', { locale: he })
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 })
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 })
      return `${format(weekStart, 'dd/MM', { locale: he })} - ${format(weekEnd, 'dd/MM/yyyy', { locale: he })}`
    } else {
      return format(currentDate, 'MMMM yyyy', { locale: he })
    }
  }

  // Calculate statistics
  const todayAppointments = appointments.filter(appointment => {
    if (!appointment.date) return false
    try {
      const appointmentDate = new Date(appointment.date)
      return isToday(appointmentDate)
    } catch {
      return false
    }
  })

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

  const workStartTime = parseISO(`2000-01-01T${WORK_START}`)
  const workEndTime = parseISO(`2000-01-01T${WORK_END}`)
  const WORK_DAY_MINUTES = (workEndTime.getTime() - workStartTime.getTime()) / (1000 * 60)
  const TOTAL_SLOTS = Math.floor(WORK_DAY_MINUTES / APPOINTMENT_DURATION)
  const todayFreeSlots = TOTAL_SLOTS - todayAppointments.length

  if (loading) {
    return (
      <>
        <SiteHeader title={ "לוח זמנים"} />
        <div className="flex items-center justify-center h-full">
          <OctahedronLoader size="3xl" />
        </div>
      </>
    )
  }

  return (
    <>
      <SiteHeader title={ "לוח זמנים"} />
      <div className="flex flex-col bg-muted/50 flex-1 gap-6" dir="rtl" style={{ scrollbarWidth: 'none' }}>

        {/* Calendar Header */}
        <div className="flex items-center justify-between p-4 lg:p-6 pb-0">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={goToToday} className="bg-card shadow-md border-none dark:bg-card">
              היום
            </Button>
            <div className="flex items-center gap-2">
              <Button className="bg-card shadow-md border-none dark:bg-card" variant="outline" size="icon" onClick={() => navigateCalendar('prev')}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button className="bg-card shadow-md border-none dark:bg-card" variant="outline" size="icon" onClick={() => navigateCalendar('next')}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
            <h1 className="text-xl font-semibold">{getDisplayTitle()}</h1>
          </div>

          <div className="flex items-center gap-2 bg-card shadow-md rounded-md" >
            <div className="flex rounded-md ">
              <Button
                variant={view === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('day')}
                className=" rounded-l-none"
              >
                יום
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('week')}
                className="rounded-none"
              >
                שבוע
              </Button>
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('month')}
                className=" rounded-r-none"
              >
                חודש
              </Button>
            </div>
          </div>
        </div>

        <div className="flex gap-6 px-4 lg:px-6 flex-1">
          {/* Statistics Sidebar */}
          <div className="w-72 space-y-4">
            {/* Mini Calendar */}
            <Card className="bg-card shadow-md border-none p-2 justify-center">
              <CardContent className="p-0 justify-center">
                <Calendar
                  mode="single"
                  selected={currentDate}
                  onSelect={(date) => date && setCurrentDate(date)}
                  className="w-full justify-center"
                  locale={he}
                />
              </CardContent>
            </Card>

            <div className="grid gap-4 grid-cols-2">
              <Card className="bg-card border-none shadow-md py-4">
                <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0 ">
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

              <Card className="bg-card border-none shadow-md ">
                <CardHeader className="flex flex-row items-center mb-[-10px] justify-between space-y-0">
                  <CardTitle className="text-sm font-medium">מקומות פנויים</CardTitle>
                  <Clock className="h-4 w-4 text-secondary-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-secondary-foreground">{todayFreeSlots}</div>
                  <p className="text-xs text-muted-foreground">
                    {todayFreeSlots * APPOINTMENT_DURATION} דקות פנויות
                  </p>
                </CardContent>
              </Card>

            </div>

          </div>

          {/* Main Calendar View */}
          <div className="flex-1 flex flex-col justify-end rounded-xl">
            <Card className="bg-card rounded-t-xl shadow-md border-none p-0">
              <CardContent className="p-0 pt-0 rounded-xl">
                {view === 'month' ? (
                  // Month View
                  <div className="grid grid-cols-7 gap-0 ">
                    {/* Day headers */}
                    {['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'].map((day) => (
                      <div key={day} className="p-2 text-center text-sm font-medium border-b">
                        {day}
                      </div>
                    ))}

                    {/* Month grid */}
                    {visibleDates.map((date, index) => {
                      const dayAppointments = getAppointmentsForDate(date)
                      const isCurrentMonth = date.getMonth() === currentDate.getMonth()
                      const isCurrentDay = isToday(date)

                      return (
                        <div
                          key={index}
                          className={`min-h-[120px] p-1 border-b border-r relative ${!isCurrentMonth ? 'bg-muted/30 text-muted-foreground' : ''
                            } ${isCurrentDay ? 'bg-primary/5' : ''} hover:bg-muted/50 cursor-pointer`}
                          onClick={() => {
                            setCurrentDate(date)
                            setView('day')
                          }}
                        >
                          <div className={`text-sm ${isCurrentDay ? 'font-bold text-primary' : ''}`}>
                            {format(date, 'd')}
                          </div>
                          <div className="mt-1 space-y-1">
                            {dayAppointments.slice(0, 3).map((appointment) => (
                              <div
                                key={appointment.id}
                                className="text-xs p-1 bg-primary/20 text-primary rounded truncate"
                                title={`${appointment.time} - ${appointment.exam_name}`}
                              >
                                {appointment.time} {appointment.exam_name}
                              </div>
                            ))}
                            {dayAppointments.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayAppointments.length - 3} נוספים
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  // Day/Week View
                  <div className="flex flex-col rounded-t-xl" style={{ 
                    height: 'calc(100vh - 200px)',
                    maxHeight: `${50 + (totalWorkHours * 95)}px` // 50px for header + actual calendar content
                  }} ref={calendarRef}>
                                          {/* Fixed header */}
                      <div className="flex bg-card rounded-t-xl border-b sticky top-0">
                        {/* Time column header */}
                        <div className="w-16 h-10 border-l bg-transparent"></div>
                        {/* Day headers */}
                        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleDates.length}, 1fr)` }}>
                          {visibleDates.map((date, dateIndex) => (
                            <div key={dateIndex} className={`h-10 flex items-center justify-center text-sm font-medium bg-transparent ${isToday(date) && view === 'week' ? 'bg-primary/10 text-primary' : ''
                              } ${dateIndex < visibleDates.length - 1 ? "border-l" : ""} ${dateIndex === visibleDates.length - 1 ? "rounded-tr-md" : ""}`}>
                              {view === 'week' ? format(date, 'EEE d/M', { locale: he }) : format(date, 'EEE d/M', { locale: he })}
                            </div>
                          ))}
                        </div>
                      </div>

                    {/* Scrollable content */}
                    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
                      <div className="flex" style={{ height: `${totalWorkHours * 95}px` }}>
                        {/* Time column */}
                        <div className="w-16">
                          {timeSlots.map((slot, index) => (
                            <div key={slot.time} className={`h-[95px] border-l flex items-start justify-center pt-1 ${index === timeSlots.length - 1 ? '' : 'border-b'
                              }`}>
                              <span className="text-xs text-muted-foreground">{slot.time}</span>
                            </div>
                          ))}
                        </div>

                        {/* Day columns */}
                        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleDates.length}, 1fr)` }}>
                      {visibleDates.map((date, dateIndex) => (
                        <div key={dateIndex} className="relative">

                          {/* Time slots */}
                          <div className="relative">
                            {timeSlots.map((slot, slotIndex) => (
                              <div
                                key={`${dateIndex}-${slotIndex}`}
                                className={`h-[95px] hover:bg-muted/30 cursor-pointer relative ${dateIndex < visibleDates.length - 1 ? "border-l" : ""
                                  } ${slotIndex === timeSlots.length - 1 ? '' : 'border-b'}`}
                                onClick={() => handleTimeSlotClick(date, slot.time)}
                              >
                                {/* Current time indicator */}
                                {isToday(date) && (
                                  (() => {
                                    const now = new Date()
                                    const currentHour = getHours(now)
                                    const currentMinute = getMinutes(now)

                                    if (currentHour === slot.hour) {
                                      const topOffset = (currentMinute / 60) * 95
                                      return (
                                        <div
                                          className="absolute left-0 right-0 h-0.5 bg-red-500 z-10"
                                          style={{ top: `${topOffset}px` }}
                                        >
                                          <div className="absolute -left-1 -top-1 w-2 h-2 bg-red-500 rounded-full"></div>
                                        </div>
                                      )
                                    }
                                    return null
                                  })()
                                )}
                              </div>
                            ))}

                            {/* Appointment blocks */}
                            {getAppointmentBlocks(date).map((block) => {
                              const isDragging = draggedBlockId === block.id
                              const isResizing = resizeData?.appointmentId === block.id
                              const isInCurrentColumn = dragPosition && isSameDay(dragPosition.date, date)

                              const userColor = getUserColor(block.user_id)
                              const timeRange = getAppointmentTimeRange(block.time || '')

                              // Determine which specific corners touch neighbors
                              const dayBlocks = getAppointmentBlocks(date)
                              
                              // Check each corner individually
                              const blockTop = block.top
                              const blockBottom = block.top + block.height
                              const blockLeft = block.left
                              const blockRight = block.left + block.width
                              
                              let topLeftRounded = true
                              let topRightRounded = true
                              let bottomLeftRounded = true
                              let bottomRightRounded = true
                              
                              dayBlocks.forEach(otherBlock => {
                                if (otherBlock.id === block.id) return
                                
                                const otherTop = otherBlock.top
                                const otherBottom = otherBlock.top + otherBlock.height
                                const otherLeft = otherBlock.left
                                const otherRight = otherBlock.left + otherBlock.width
                                
                                // Check if blocks are adjacent horizontally
                                const adjacentLeft = Math.abs(otherRight - blockLeft) < 1
                                const adjacentRight = Math.abs(otherLeft - blockRight) < 1
                                
                                if (adjacentLeft) {
                                  // Neighbor on the left - check which corners touch
                                  if (otherTop <= blockTop && otherBottom > blockTop) {
                                    topLeftRounded = false // Top-left corner touches
                                  }
                                  if (otherTop < blockBottom && otherBottom >= blockBottom) {
                                    bottomLeftRounded = false // Bottom-left corner touches
                                  }
                                }
                                
                                if (adjacentRight) {
                                  // Neighbor on the right - check which corners touch
                                  if (otherTop <= blockTop && otherBottom > blockTop) {
                                    topRightRounded = false // Top-right corner touches
                                  }
                                  if (otherTop < blockBottom && otherBottom >= blockBottom) {
                                    bottomRightRounded = false // Bottom-right corner touches
                                  }
                                }
                              })

                              // If this block is being dragged and is in current column, use drag position
                              let blockStyle = {
                                top: `${block.top}px`,
                                height: `${block.height}px`,
                                left: `${block.left}%`,
                                width: `${block.width}%`,
                                zIndex: isDragging || isResizing ? 45 : block.zIndex,
                                backgroundColor: userColor,
                                borderColor: userColor
                              }

                              if (isDragging && isInCurrentColumn && dragPosition && draggedData) {
                                // Use the clamped position from dragPosition
                                blockStyle.top = `${dragPosition.y}px`
                              }

                              // Hide the original block if it's being dragged and moved to another column
                              if (isDragging && dragPosition && !isSameDay(dragPosition.date, date)) {
                                return null
                              }

                              // Create border radius class based on which corners touch neighbors
                              let borderRadiusClass = ''
                              if (topLeftRounded) borderRadiusClass += 'rounded-tl-md '
                              if (topRightRounded) borderRadiusClass += 'rounded-tr-md '
                              if (bottomLeftRounded) borderRadiusClass += 'rounded-bl-md '
                              if (bottomRightRounded) borderRadiusClass += 'rounded-br-md '
                              borderRadiusClass = borderRadiusClass.trim() || 'rounded-none'

                              return (
                                <div
                                  key={block.id}
                                  className={`absolute text-white ${borderRadiusClass} text-xs transition-all duration-150 border group overflow-hidden ${isDragging || isResizing ? 'shadow-lg' : 'hover:shadow-md'
                                    }`}
                                  style={{
                                    ...blockStyle,
                                    borderWidth: '1px',
                                    borderColor: 'rgba(255, 255, 255, 0.3)'
                                  }}
                                  title={getDynamicTimeRange(block)}
                                >
                                  {/* Top resize handle - extends 2px outside */}
                                  <div
                                    className="absolute top-[-5px] left-0 right-0 z-20"
                                    style={{
                                      height: '10px',
                                      cursor: 'ns-resize'
                                    }}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleResizeStart(e, block, 'top')
                                    }}
                                  />

                                  {/* Main content - draggable area */}
                                  <div
                                    className="py-[0.5px] px-1 h-full flex flex-col justify-start relative z-0"
                                    style={{
                                      cursor: resizeData ? 'default' : 'move',
                                      marginTop: '1px',
                                      marginBottom: '1px'
                                    }}
                                    onMouseDown={(e) => {
                                      if (!resizeData) {
                                        handleMouseDown(e, block)
                                      }
                                    }}
                                    onClick={(e) => {
                                      // Only open edit dialog if not dragging
                                      if (!draggedData && !resizeData) {
                                        e.preventDefault()
                                        e.stopPropagation()
                                        openEditDialog(block)
                                      }
                                    }}
                                  >
                                    <div className="font-medium text-right truncate text-[10px] pointer-events-none">
                                      {draggedBlockId === block.id && dragPosition ?
                                        getAppointmentTimeRange(dragPosition.time, getAppointmentDuration(block)) :
                                        (resizeData && resizeData.appointmentId === block.id ?
                                          getDynamicTimeRange(block) :
                                          getAppointmentTimeRange(block.time || '', getAppointmentDuration(block))
                                        )
                                      }
                                      {/* Client name on same line */}
                                      {block.client && (
                                        <span className="text-white/90 mr-1">
                                          • {`${block.client.first_name || ''} ${block.client.last_name || ''}`.trim()}
                                        </span>
                                      )}
                                    </div>
                                    {/* Exam name */}
                                    {block.exam_name && (
                                      <div className="text-right truncate text-[10px] text-white/80 pointer-events-none">
                                        {block.exam_name}
                                      </div>
                                    )}
                                  </div>

                                  {/* Bottom resize handle - extends 2px outside */}
                                  <div
                                    className="absolute bottom-[-5px] left-0 right-0 z-20"
                                    style={{
                                      height: '10px',
                                      cursor: 'ns-resize'
                                    }}
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      handleResizeStart(e, block, 'bottom')
                                    }}
                                  />


                                </div>
                              )
                            })}

                            {/* Show dragged block in new position if moved to this column */}
                            {dragPosition && draggedData && isSameDay(dragPosition.date, date) && !getAppointmentBlocks(date).some(block => block.id === draggedBlockId) && (
                              <div
                                className="absolute text-white rounded-md text-xs shadow-lg border"
                                style={{
                                  top: `${dragPosition.y}px`,
                                  height: `${(getAppointmentDuration(draggedData.appointment) / 60) * 95}px`,
                                  left: '0%',
                                  width: '100%',
                                  zIndex: 45,
                                  backgroundColor: getUserColor(draggedData.appointment.user_id),
                                  borderWidth: '1px',
                                  borderColor: 'rgba(255, 255, 255, 0.3)'
                                }}
                              >
                                <div className="py-[0.5px] px-1 h-full flex flex-col justify-start" style={{ marginTop: '5px', marginBottom: '5px' }}>
                                  <div className="font-medium text-right truncate text-[10px]">
                                    {getAppointmentTimeRange(dragPosition.time, getAppointmentDuration(draggedData.appointment))}
                                    {/* Client name on same line during drag */}
                                    {(() => {
                                      const client = clients.find(c => c.id === draggedData.appointment.client_id);
                                      return client && (
                                        <span className="text-white/90 mr-2">
                                          • {`${client.first_name || ''} ${client.last_name || ''}`.trim()}
                                        </span>
                                      );
                                    })()}
                                  </div>
                                  {/* Exam name during drag */}
                                  {draggedData.appointment.exam_name && (
                                    <div className="text-right truncate text-[10px] text-white/80">
                                      {draggedData.appointment.exam_name}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Existing Modals */}
        <ClientSelectModal
          isOpen={isClientSelectOpen}
          onClientSelect={handleClientSelect}
          onClose={() => setIsClientSelectOpen(false)}
        />

        <CustomModal
          isOpen={isCreateModalOpen}
          onClose={closeAllDialogs}
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
                  onChange={handleInputChange}
                  dir="rtl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="examiner" className="text-right block">בודק</Label>
                <UserSelect
                  value={formData.user_id}
                  onValueChange={(userId) => setFormData(prev => ({ ...prev, user_id: userId }))}
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
                  onChange={handleInputChange}
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
                  onChange={handleInputChange}
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
                onChange={handleInputChange}
                dir="rtl"
              />
            </div>
          </div>
          <div className="flex justify-center gap-2 mt-4">
            <Button onClick={handleSaveAppointment}>שמור</Button>
            <Button 
              variant="destructive" 
              size="icon"
              onClick={() => {
                if (editingAppointment) {
                  handleDeleteAppointment(editingAppointment.id!)
                }
                closeAllDialogs()
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CustomModal>
      </div>
    </>
  )
}

