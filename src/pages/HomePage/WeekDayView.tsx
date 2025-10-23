import React from "react"
import { format, isToday, isSameDay, getHours, getMinutes } from "date-fns"
import { he } from "date-fns/locale"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { isJewishHoliday, getJewishHolidayName } from "@/lib/jewish-holidays"
import { User, Client, Appointment } from "@/lib/db/schema-interface"
import { AppointmentBlock, DragPosition, ResizeData, DragData } from "./types"
import { getAppointmentTimeRange } from "./utils"

interface WeekDayViewProps {
  visibleDates: Date[]
  timeSlots: { time: string; hour: number }[]
  totalWorkHours: number
  currentUser: User | null
  clients: Client[]
  getAppointmentBlocks: (date: Date) => AppointmentBlock[]
  getUserColor: (userId?: number) => string
  getAppointmentDuration: (appointment: Appointment) => number
  getDynamicTimeRange: (appointment: Appointment) => string
  handleTimeSlotClick: (date: Date, time: string) => void
  handleMouseDown: (e: React.MouseEvent, appointment: Appointment) => void
  handleResizeStart: (e: React.MouseEvent, appointment: Appointment, type: 'top' | 'bottom') => void
  openEditDialog: (appointment: Appointment) => void
  draggedBlockId: number | null
  dragPosition: DragPosition | null
  resizeData: ResizeData | null
  draggedData: DragData | null
  calendarRef: React.RefObject<HTMLDivElement | null>
  suppressClickRef: React.MutableRefObject<boolean>
}

export function WeekDayView({
  visibleDates,
  timeSlots,
  totalWorkHours,
  currentUser,
  clients,
  getAppointmentBlocks,
  getUserColor,
  getAppointmentDuration,
  getDynamicTimeRange,
  handleTimeSlotClick,
  handleMouseDown,
  handleResizeStart,
  openEditDialog,
  draggedBlockId,
  dragPosition,
  resizeData,
  draggedData,
  calendarRef,
  suppressClickRef
}: WeekDayViewProps) {
  return (
    <div className="flex flex-col rounded-t-xl" style={{ 
      height: 'calc(100vh - 200px)',
      maxHeight: `${50 + (totalWorkHours * 95)}px`
    }} ref={calendarRef}>
      {/* Fixed header */}
      <div className="flex bg-card rounded-t-xl border-b sticky top-0">
        {/* Time column header */}
        <div className="w-16 h-10 border-l bg-transparent"></div>
        {/* Day headers */}
        <div className="flex-1 grid" style={{ gridTemplateColumns: `repeat(${visibleDates.length}, 1fr)` }}>
          {visibleDates.map((date, dateIndex) => {
            const dateStr = format(date, 'yyyy-MM-dd')
            const vacation = [
              ...(currentUser?.system_vacation_dates || []),
              ...(currentUser?.added_vacation_dates || [])
            ].includes(dateStr)
            const holiday = isJewishHoliday(dateStr)
            return (
              <div key={dateIndex} className={`relative h-10 flex items-center justify-center text-sm font-medium bg-transparent ${isToday(date) ? 'bg-primary/10 text-primary' : ''
                } ${dateIndex < visibleDates.length - 1 ? "border-l" : ""} ${dateIndex === visibleDates.length - 1 ? "rounded-tr-md" : ""}`}>
                {format(date, 'EEE d/M', { locale: he })}
                {vacation && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end">יום חופש</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {!vacation && holiday && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end">{getJewishHolidayName(dateStr) || 'חג'}</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            )
          })}
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
            {visibleDates.map((date, dateIndex) => {
              const dayBlocks = getAppointmentBlocks(date)
              return (
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
                    {dayBlocks.map((block) => {
                      const isDragging = draggedBlockId === block.id
                      const isResizing = resizeData?.appointmentId === block.id
                      const isInCurrentColumn = dragPosition && isSameDay(dragPosition.date, date)

                      const userColor = getUserColor(block.user_id)

                      // Determine which specific corners touch neighbors
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
                            topLeftRounded = false
                          }
                          if (otherTop < blockBottom && otherBottom >= blockBottom) {
                            bottomLeftRounded = false
                          }
                        }
                        
                        if (adjacentRight) {
                          // Neighbor on the right - check which corners touch
                          if (otherTop <= blockTop && otherBottom > blockTop) {
                            topRightRounded = false
                          }
                          if (otherTop < blockBottom && otherBottom >= blockBottom) {
                            bottomRightRounded = false
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
                          {/* Top resize handle */}
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
                              // Suppress click if a drag just happened or during resize
                              if (suppressClickRef.current || draggedData || resizeData) {
                                e.preventDefault()
                                e.stopPropagation()
                                suppressClickRef.current = false
                                return
                              }
                              e.preventDefault()
                              e.stopPropagation()
                              openEditDialog(block)
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

                          {/* Bottom resize handle */}
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
                    {dragPosition && draggedData && isSameDay(dragPosition.date, date) && !dayBlocks.some(block => block.id === draggedBlockId) && (
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
                            {(() => {
                              const client = clients.find(c => c.id === draggedData.appointment.client_id);
                              return client && (
                                <span className="text-white/90 mr-2">
                                  • {`${client.first_name || ''} ${client.last_name || ''}`.trim()}
                                </span>
                              );
                            })()}
                          </div>
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
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

