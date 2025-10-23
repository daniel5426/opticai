import { useMemo, useCallback } from "react"
import { Appointment, Client } from "@/lib/db/schema-interface"
import { AppointmentBlock } from "./types"
import { timeToMinutes } from "./utils"

interface UseAppointmentBlocksProps {
  getAppointmentsForDate: (date: Date) => Appointment[]
  clientsMap: Map<number, Client>
  workStartHour: number
  getAppointmentDuration: (appointment: Appointment) => number
  resizeData: any
}

export function useAppointmentBlocks({
  getAppointmentsForDate,
  clientsMap,
  workStartHour,
  getAppointmentDuration,
  resizeData
}: UseAppointmentBlocksProps) {
  const getAppointmentBlocks = useCallback((date: Date): AppointmentBlock[] => {
    const dayAppointments = getAppointmentsForDate(date)
    if (!dayAppointments.length) return []
    
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

      const client = clientsMap.get(appointment.client_id)

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
  }, [getAppointmentsForDate, resizeData, workStartHour, clientsMap, getAppointmentDuration])

  return { getAppointmentBlocks }
}

