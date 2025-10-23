import { useState, useRef, useEffect, useCallback } from "react"
import { format, isSameDay } from "date-fns"
import { Appointment } from "@/lib/db/schema-interface"
import { DragData, DragPosition, ResizeData } from "./types"
import { timeToMinutes, minutesToTime, getAppointmentEndTime } from "./utils"
import { toast } from "sonner"

interface UseDragAndResizeProps {
  calendarRef: React.RefObject<HTMLDivElement | null>
  workStartHour: number
  workEndHour: number
  getAppointmentDuration: (appointment: Appointment) => number
  isUserOnVacation: (userId?: number, dateStr?: string) => boolean
  visibleDates: Date[]
  updateAppointment: (appointment: Appointment) => Promise<Appointment | null>
  setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>
}

export function useDragAndResize({
  calendarRef,
  workStartHour,
  workEndHour,
  getAppointmentDuration,
  isUserOnVacation,
  visibleDates,
  updateAppointment,
  setAppointments
}: UseDragAndResizeProps) {
  const [draggedData, setDraggedData] = useState<DragData | null>(null)
  const [draggedBlockId, setDraggedBlockId] = useState<number | null>(null)
  const [dragPosition, setDragPosition] = useState<DragPosition | null>(null)
  const [resizeData, setResizeData] = useState<ResizeData | null>(null)
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null)
  const isDraggingRef = useRef(false)
  const suppressClickRef = useRef(false)
  const pendingDragDataRef = useRef<DragData | null>(null)
  const [isPointerDown, setIsPointerDown] = useState(false)
  const lastDragSigRef = useRef<string | null>(null)

  const handleMouseDown = useCallback((e: React.MouseEvent, appointment: Appointment) => {
    if (resizeData) return

    e.preventDefault()
    e.stopPropagation()

    const rect = e.currentTarget.getBoundingClientRect()
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }

    pendingDragDataRef.current = {
      appointment,
      offset,
      originalElement: e.currentTarget as HTMLElement
    }
    mouseDownPosRef.current = { x: e.clientX, y: e.clientY }
    isDraggingRef.current = false
    suppressClickRef.current = false
    setIsPointerDown(true)
  }, [resizeData])

  const handleResizeStart = useCallback((e: React.MouseEvent, appointment: Appointment, type: 'top' | 'bottom') => {
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

    document.body.style.userSelect = 'none'
  }, [getAppointmentDuration])

  const calculateDragPosition = useCallback((e: MouseEvent) => {
    if (!calendarRef.current || !draggedData) return null

    const calendarRect = calendarRef.current.getBoundingClientRect()
    const scrollableContainer = calendarRef.current.querySelector('.overflow-y-auto')
    const scrollTop = scrollableContainer ? scrollableContainer.scrollTop : 0
    const timeColumnWidth = 64
    const headerHeight = 40
    
    const gridRect = {
      left: 30,
      top: calendarRect.top + headerHeight,
      width: calendarRect.width - timeColumnWidth,
      height: calendarRect.height - headerHeight
    }

    const x = e.clientX - gridRect.left
    const y = e.clientY - gridRect.top - draggedData.offset.y + scrollTop

    const dayWidth = gridRect.width / visibleDates.length
    const rawDayIndex = Math.floor(x / dayWidth)
    const dayIndex = Math.max(0, Math.min(visibleDates.length - 1, visibleDates.length - 1 - rawDayIndex))
    const targetDate = visibleDates[dayIndex]

    const HOUR_HEIGHT = 95
    const totalMinutesFromTop = Math.max(0, (y / HOUR_HEIGHT) * 60)
    const snappedMinutes = Math.round(totalMinutesFromTop / 15) * 15

    const targetHour = Math.floor(snappedMinutes / 60) + workStartHour
    const targetMinute = snappedMinutes % 60

    const appointmentDuration = draggedData ? getAppointmentDuration(draggedData.appointment) : 30
    const appointmentDurationMinutes = appointmentDuration

    const workStartMinutes = workStartHour * 60
    const workEndMinutes = workEndHour * 60
    const maxAllowedStartMinutes = workEndMinutes - appointmentDurationMinutes
    
    const targetMinutesFromWorkStart = (targetHour - workStartHour) * 60 + targetMinute
    
    const clampedMinutesFromWorkStart = Math.max(0, Math.min(maxAllowedStartMinutes - workStartMinutes, targetMinutesFromWorkStart))
    
    const clampedHour = Math.floor(clampedMinutesFromWorkStart / 60) + workStartHour
    const clampedMinute = clampedMinutesFromWorkStart % 60

    const newTime = `${Math.floor(clampedHour).toString().padStart(2, '0')}:${Math.floor(clampedMinute).toString().padStart(2, '0')}`

    const visualY = (clampedMinutesFromWorkStart / 60) * HOUR_HEIGHT

    return {
      x: dayIndex * dayWidth,
      y: visualY,
      date: targetDate,
      time: newTime
    }
  }, [calendarRef, draggedData, visibleDates, workStartHour, workEndHour, getAppointmentDuration])

  const calculateResizePosition = useCallback((e: MouseEvent) => {
    if (!calendarRef.current || !resizeData) return null

    const calendarRect = calendarRef.current.getBoundingClientRect()
    const scrollableContainer = calendarRef.current.querySelector('.overflow-y-auto')
    const scrollTop = scrollableContainer ? scrollableContainer.scrollTop : 0
    const timeColumnWidth = 64
    const headerHeight = 40
    
    const gridRect = {
      top: calendarRect.top + headerHeight,
      height: calendarRect.height - headerHeight,
      left: calendarRect.left + timeColumnWidth
    }

    const y = e.clientY - gridRect.top + scrollTop
    const HOUR_HEIGHT = 95
    const totalMinutesFromTop = Math.max(0, (y / HOUR_HEIGHT) * 60)
    const snappedMinutes = Math.round(totalMinutesFromTop / 5) * 5

    const targetHour = Math.floor(snappedMinutes / 60) + workStartHour
    const targetMinute = snappedMinutes % 60

    const clampedHour = Math.max(workStartHour, Math.min(workEndHour, targetHour))
    const clampedMinute = clampedHour === workEndHour ? 0 : targetMinute

    const newTime = `${Math.floor(clampedHour).toString().padStart(2, '0')}:${Math.floor(clampedMinute).toString().padStart(2, '0')}`

    if (resizeData.type === 'top') {
      const originalEndMinutes = timeToMinutes(resizeData.originalEnd)
      const newStartMinutes = timeToMinutes(newTime)
      if (newStartMinutes < originalEndMinutes && newStartMinutes >= workStartHour * 60) {
        return { startTime: newTime, endTime: resizeData.originalEnd }
      }
    } else {
      const originalStartMinutes = timeToMinutes(resizeData.originalStart)
      const newEndMinutes = timeToMinutes(newTime)
      const maxEndMinutes = workEndHour * 60
      const clampedEndMinutes = Math.min(newEndMinutes, maxEndMinutes)
      const clampedEndTime = minutesToTime(clampedEndMinutes)
      
      if (clampedEndMinutes > originalStartMinutes) {
        return { startTime: resizeData.originalStart, endTime: clampedEndTime }
      }
    }

    return null
  }, [calendarRef, resizeData, workStartHour, workEndHour])

  const handleMouseMove = (e: MouseEvent) => {
    if (calendarRef.current && !resizeData) {
      if (!isDraggingRef.current && pendingDragDataRef.current && mouseDownPosRef.current) {
        const dx = e.clientX - mouseDownPosRef.current.x
        const dy = e.clientY - mouseDownPosRef.current.y
        const manhattan = Math.abs(dx) + Math.abs(dy)
        if (manhattan >= 4) {
          const startData = pendingDragDataRef.current
          setDraggedData(startData)
          setDraggedBlockId(startData.appointment.id!)
          isDraggingRef.current = true
          suppressClickRef.current = true
        }
      }

      if (isDraggingRef.current && draggedData) {
        const position = calculateDragPosition(e)
        if (position) {
          const sig = `${position.date.toDateString()}|${position.time}|${Math.round(position.y)}`
          if (lastDragSigRef.current !== sig) {
            lastDragSigRef.current = sig
            setDragPosition(position)
          }
        }
      }
    }

    if (resizeData && calendarRef.current) {
      e.preventDefault()
      const resizePosition = calculateResizePosition(e)
      if (resizePosition) {
        if (resizeData.type === 'top') {
          const originalEndMinutes = timeToMinutes(resizeData.originalEnd)
          const newStartMinutes = timeToMinutes(resizePosition.startTime)
          const newDuration = originalEndMinutes - newStartMinutes

          setAppointments(prev => prev.map(apt => {
            if (apt.id !== resizeData.appointmentId) return apt
            if (apt.time === resizePosition.startTime && apt.duration === newDuration) return apt
            return { ...apt, time: resizePosition.startTime, duration: newDuration }
          }))
        } else {
          const startMinutes = timeToMinutes(resizeData.originalStart)
          const newEndMinutes = timeToMinutes(resizePosition.endTime)
          const newDuration = newEndMinutes - startMinutes

          setAppointments(prev => prev.map(apt => {
            if (apt.id !== resizeData.appointmentId) return apt
            if (apt.time === resizeData.originalStart && apt.duration === newDuration) return apt
            return { ...apt, time: resizeData.originalStart, duration: newDuration }
          }))
        }
      }
    }
  }

  const handleMouseUp = async (e: MouseEvent) => {
    document.body.style.userSelect = ''

    if (isDraggingRef.current && draggedData && !resizeData) {
      const finalPosition = calculateDragPosition(e) || dragPosition
      if (!finalPosition) {
        pendingDragDataRef.current = null
        mouseDownPosRef.current = null
        isDraggingRef.current = false
        setIsPointerDown(false)
        setDraggedData(null)
        setDraggedBlockId(null)
        setDragPosition(null)
        setResizeData(null)
        lastDragSigRef.current = null
        return
      }

      const updatedAppointment = {
        ...draggedData.appointment,
        date: format(finalPosition.date, 'yyyy-MM-dd'),
        time: finalPosition.time
      }

      const originalAppointment = { ...draggedData.appointment }

      setDraggedData(null)
      setDraggedBlockId(null)
      setDragPosition(null)

      setAppointments(prev => prev.map(apt =>
        apt.id === updatedAppointment.id ? updatedAppointment : apt
      ))

      try {
        if (updatedAppointment.date && isUserOnVacation(updatedAppointment.user_id, updatedAppointment.date)) {
          toast.error('לא ניתן להעביר תור ליום חופשה של המשתמש')
          setAppointments(prev => prev.map(apt =>
            apt.id === originalAppointment.id ? originalAppointment : apt
          ))
          return
        }
        const result = await updateAppointment(updatedAppointment)
        if (result) {
          toast.success("התור הועבר בהצלחה")
        } else {
          toast.error("שגיאה בהעברת התור")
          setAppointments(prev => prev.map(apt =>
            apt.id === originalAppointment.id ? originalAppointment : apt
          ))
        }
      } catch (error) {
        console.error('Error moving appointment:', error)
        toast.error("שגיאה בהעברת התור")
        setAppointments(prev => prev.map(apt =>
          apt.id === originalAppointment.id ? originalAppointment : apt
        ))
      }
    }

    if (resizeData) {
      const resizePosition = calculateResizePosition(e)
      if (resizePosition) {
        const originalAppointment = await (async () => {
          const apt = await Promise.resolve(
            setAppointments(prev => {
              const found = prev.find(a => a.id === resizeData.appointmentId)
              return prev
            })
          )
          return null as any
        })()

        let updatedAppointment: Appointment | null = null

        setAppointments(prev => {
          const original = prev.find(a => a.id === resizeData.appointmentId)
          if (!original) return prev

          if (resizeData.type === 'top') {
            const originalEndMinutes = timeToMinutes(resizeData.originalEnd)
            const newStartMinutes = timeToMinutes(resizePosition.startTime)
            const newDuration = originalEndMinutes - newStartMinutes

            updatedAppointment = {
              ...original,
              time: resizePosition.startTime,
              duration: newDuration
            }
          } else {
            const startMinutes = timeToMinutes(resizeData.originalStart)
            const newEndMinutes = timeToMinutes(resizePosition.endTime)
            const newDuration = newEndMinutes - startMinutes

            updatedAppointment = {
              ...original,
              time: resizeData.originalStart,
              duration: newDuration
            }
          }

          return prev.map(apt =>
            apt.id === updatedAppointment?.id ? updatedAppointment! : apt
          )
        })

        setResizeData(null)

        if (updatedAppointment) {
          try {
            const result = await updateAppointment(updatedAppointment)
            if (result) {
              toast.success("התור עודכן בהצלחה")
            } else {
              toast.error("שגיאה בעדכון התור")
            }
          } catch (error) {
            console.error('Error resizing appointment:', error)
            toast.error("שגיאה בעדכון התור")
          }
        }
      } else {
        setResizeData(null)
      }
    }

    pendingDragDataRef.current = null
    mouseDownPosRef.current = null
    isDraggingRef.current = false
    setIsPointerDown(false)
    setDraggedData(null)
    setDraggedBlockId(null)
    setDragPosition(null)
    setResizeData(null)
    lastDragSigRef.current = null
  }

  useEffect(() => {
    if (isPointerDown || draggedData || resizeData) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      return () => {
        document.removeEventListener('mousemove', handleMouseMove)
        document.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isPointerDown, draggedData, resizeData])

  return {
    draggedData,
    draggedBlockId,
    dragPosition,
    resizeData,
    suppressClickRef,
    handleMouseDown,
    handleResizeStart
  }
}

