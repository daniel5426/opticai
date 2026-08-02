import React from "react";
import { format, isToday, isSameDay, getHours, getMinutes } from "date-fns";
import { he } from "date-fns/locale";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isJewishHoliday, getJewishHolidayName } from "@/lib/jewish-holidays";
import { User, Client, Appointment } from "@/lib/db/schema-interface";
import { AppointmentBlock, DragPosition, ResizeData, DragData } from "./types";
import { formatAppointmentTime, getAppointmentTimeRange } from "./utils";

const STACKED_APPOINTMENT_CONTENT_MIN_HEIGHT = 36;
const EXAM_NAME_MIN_HEIGHT = 54;

interface AppointmentCardContentProps {
  height: number;
  timeRange: string;
  startTime: string;
  client?: Client;
  examName?: string;
}

function getClientName(client?: Client) {
  return [client?.first_name, client?.last_name].filter(Boolean).join(" ");
}

function AppointmentCardContent({
  height,
  timeRange,
  startTime,
  client,
  examName,
}: AppointmentCardContentProps) {
  const clientName = getClientName(client);
  const secondaryDetail = clientName || examName;
  const hasRoomForStackedContent =
    height >= STACKED_APPOINTMENT_CONTENT_MIN_HEIGHT;
  const showExamName = Boolean(
    clientName && examName && height >= EXAM_NAME_MIN_HEIGHT,
  );

  if (!hasRoomForStackedContent) {
    return (
      <div className="pointer-events-none flex h-full min-w-0 items-center gap-1 px-1 text-[10px] leading-3 font-medium">
        <span className="shrink-0 tabular-nums" dir="ltr">
          {startTime}
        </span>
        {secondaryDetail && (
          <span
            className="min-w-0 flex-1 truncate text-right text-white/90"
            dir="rtl"
          >
            {secondaryDetail}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="pointer-events-none flex h-full min-h-0 flex-col px-1 py-px text-right text-[10px] leading-3">
      <div className="shrink-0 truncate font-medium tabular-nums" dir="ltr">
        {timeRange}
      </div>
      {secondaryDetail && (
        <div className="min-w-0 truncate text-white/90" dir="rtl">
          {secondaryDetail}
        </div>
      )}
      {showExamName && (
        <div className="min-w-0 truncate text-white/80" dir="rtl">
          {examName}
        </div>
      )}
    </div>
  );
}

interface WeekDayViewProps {
  visibleDates: Date[];
  timeSlots: { time: string; startMinutes: number; durationMinutes: number }[];
  totalWorkMinutes: number;
  currentUser: User | null;
  clients: Client[];
  getAppointmentBlocks: (date: Date) => AppointmentBlock[];
  getUserColor: (userId?: number) => string;
  getAppointmentDuration: (appointment: Appointment) => number;
  getDynamicTimeRange: (appointment: Appointment) => string;
  handleTimeSlotClick: (
    date: Date,
    time: string,
    event?: React.MouseEvent,
  ) => void;
  handleMouseDown: (e: React.MouseEvent, appointment: Appointment) => void;
  handleResizeStart: (
    e: React.MouseEvent,
    appointment: Appointment,
    type: "top" | "bottom",
  ) => void;
  openEditDialog: (appointment: Appointment) => void;
  onAppointmentContextMenu: (
    e: React.MouseEvent,
    appointment: Appointment,
  ) => void;
  onAppointmentSelect: (appointment: Appointment) => void;
  isMoveMode: boolean;
  draggedBlockId: number | null;
  dragPosition: DragPosition | null;
  resizeData: ResizeData | null;
  draggedData: DragData | null;
  calendarRef: React.RefObject<HTMLDivElement | null>;
  suppressClickRef: React.MutableRefObject<boolean>;
}

export function WeekDayView({
  visibleDates,
  timeSlots,
  totalWorkMinutes,
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
  onAppointmentContextMenu,
  onAppointmentSelect,
  isMoveMode,
  draggedBlockId,
  dragPosition,
  resizeData,
  draggedData,
  calendarRef,
  suppressClickRef,
}: WeekDayViewProps) {
  const calendarHeight = (totalWorkMinutes / 60) * 95;
  const handleMoveModeColumnClick = (
    event: React.MouseEvent<HTMLDivElement>,
    date: Date,
  ) => {
    if (!isMoveMode) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const y = Math.max(0, event.clientY - rect.top);
    let offset = 0;
    const clickedSlot =
      timeSlots.find((slot) => {
        const height = (slot.durationMinutes / 60) * 95;
        const isMatch = y >= offset && y < offset + height;
        offset += height;
        return isMatch;
      }) || timeSlots[timeSlots.length - 1];

    if (!clickedSlot) return;
    event.preventDefault();
    event.stopPropagation();
    handleTimeSlotClick(date, clickedSlot.time, event);
  };

  return (
    <div
      className={`flex flex-col rounded-t-xl ${isMoveMode ? "ring-offset-background ring-4 ring-yellow-300/70 ring-offset-2" : ""}`}
      style={{
        height: "calc(100vh - 190px)",
        maxHeight: `${50 + calendarHeight}px`,
      }}
      ref={calendarRef}
    >
      {/* Fixed header */}
      <div className="bg-card sticky top-0 flex rounded-t-xl border-b">
        {/* Time column header */}
        <div className="h-10 w-16 border-l bg-transparent"></div>
        {/* Day headers */}
        <div
          className="grid flex-1"
          style={{ gridTemplateColumns: `repeat(${visibleDates.length}, 1fr)` }}
        >
          {visibleDates.map((date, dateIndex) => {
            const dateStr = format(date, "yyyy-MM-dd");
            const vacation = [
              ...(currentUser?.system_vacation_dates || []),
              ...(currentUser?.added_vacation_dates || []),
            ].includes(dateStr);
            const holiday = isJewishHoliday(dateStr);
            return (
              <div
                key={dateIndex}
                className={`relative flex h-10 items-center justify-center bg-transparent text-sm font-medium ${
                  isToday(date) ? "bg-primary/10 text-primary" : ""
                } ${dateIndex < visibleDates.length - 1 ? "border-l" : ""} ${dateIndex === visibleDates.length - 1 ? "rounded-tr-md" : ""}`}
              >
                {format(date, "EEE d/M", { locale: he })}
                {vacation && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-red-500" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end">
                        יום חופש
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {!vacation && holiday && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-blue-500" />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="end">
                        {getJewishHolidayName(dateStr) || "חג"}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable content */}
      <div
        className="flex-1 overflow-y-auto"
        style={{ scrollbarWidth: "none" }}
      >
        <div className="flex" style={{ height: `${calendarHeight}px` }}>
          {/* Time column */}
          <div className="w-16">
            {timeSlots.map((slot, index) => (
              <div
                key={slot.time}
                className={`flex items-start justify-center border-l pt-1 ${
                  index === timeSlots.length - 1 ? "" : "border-b"
                }`}
                style={{ height: `${(slot.durationMinutes / 60) * 95}px` }}
              >
                <span className="text-muted-foreground text-xs">
                  {slot.time}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div
            className="grid flex-1"
            style={{
              gridTemplateColumns: `repeat(${visibleDates.length}, 1fr)`,
            }}
          >
            {visibleDates.map((date, dateIndex) => {
              const dayBlocks = getAppointmentBlocks(date);
              return (
                <div
                  key={dateIndex}
                  className="relative"
                  onClickCapture={(event) =>
                    handleMoveModeColumnClick(event, date)
                  }
                >
                  {/* Time slots */}
                  <div className="relative">
                    {timeSlots.map((slot, slotIndex) => (
                      <div
                        key={`${dateIndex}-${slotIndex}`}
                        className={`hover:bg-muted/30 relative cursor-pointer ${
                          dateIndex < visibleDates.length - 1 ? "border-l" : ""
                        } ${slotIndex === timeSlots.length - 1 ? "" : "border-b"}`}
                        style={{
                          height: `${(slot.durationMinutes / 60) * 95}px`,
                        }}
                        onClick={(e) => handleTimeSlotClick(date, slot.time, e)}
                      >
                        {/* Current time indicator */}
                        {isToday(date) &&
                          (() => {
                            const now = new Date();
                            const currentMinutes =
                              getHours(now) * 60 + getMinutes(now);
                            const slotEndMinutes =
                              slot.startMinutes + slot.durationMinutes;

                            if (
                              currentMinutes >= slot.startMinutes &&
                              currentMinutes < slotEndMinutes
                            ) {
                              const topOffset =
                                ((currentMinutes - slot.startMinutes) / 60) *
                                95;
                              return (
                                <div
                                  className="absolute right-0 left-0 z-10 h-0.5 bg-red-500"
                                  style={{ top: `${topOffset}px` }}
                                >
                                  <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-red-500"></div>
                                </div>
                              );
                            }
                            return null;
                          })()}
                      </div>
                    ))}

                    {/* Appointment blocks */}
                    {dayBlocks.map((block) => {
                      const isDragging = draggedBlockId === block.id;
                      const isResizing = resizeData?.appointmentId === block.id;
                      const isInCurrentColumn =
                        dragPosition && isSameDay(dragPosition.date, date);

                      const userColor = getUserColor(block.user_id);

                      // Determine which specific corners touch neighbors
                      const blockTop = block.top;
                      const blockBottom = block.top + block.height;
                      const blockLeft = block.left;
                      const blockRight = block.left + block.width;

                      let topLeftRounded = true;
                      let topRightRounded = true;
                      let bottomLeftRounded = true;
                      let bottomRightRounded = true;

                      dayBlocks.forEach((otherBlock) => {
                        if (otherBlock.id === block.id) return;

                        const otherTop = otherBlock.top;
                        const otherBottom = otherBlock.top + otherBlock.height;
                        const otherLeft = otherBlock.left;
                        const otherRight = otherBlock.left + otherBlock.width;

                        // Check if blocks are adjacent horizontally
                        const adjacentLeft =
                          Math.abs(otherRight - blockLeft) < 1;
                        const adjacentRight =
                          Math.abs(otherLeft - blockRight) < 1;

                        if (adjacentLeft) {
                          // Neighbor on the left - check which corners touch
                          if (otherTop <= blockTop && otherBottom > blockTop) {
                            topLeftRounded = false;
                          }
                          if (
                            otherTop < blockBottom &&
                            otherBottom >= blockBottom
                          ) {
                            bottomLeftRounded = false;
                          }
                        }

                        if (adjacentRight) {
                          // Neighbor on the right - check which corners touch
                          if (otherTop <= blockTop && otherBottom > blockTop) {
                            topRightRounded = false;
                          }
                          if (
                            otherTop < blockBottom &&
                            otherBottom >= blockBottom
                          ) {
                            bottomRightRounded = false;
                          }
                        }
                      });

                      // If this block is being dragged and is in current column, use drag position
                      let blockStyle = {
                        top: `${block.top}px`,
                        height: `${block.height}px`,
                        left: `${block.left}%`,
                        width: `${block.width}%`,
                        zIndex: isDragging || isResizing ? 45 : block.zIndex,
                        backgroundColor: userColor,
                        borderColor: userColor,
                      };

                      if (
                        isDragging &&
                        isInCurrentColumn &&
                        dragPosition &&
                        draggedData
                      ) {
                        blockStyle.top = `${dragPosition.y}px`;
                      }

                      // Hide the original block if it's being dragged and moved to another column
                      if (
                        isDragging &&
                        dragPosition &&
                        !isSameDay(dragPosition.date, date)
                      ) {
                        return null;
                      }

                      // Create border radius class based on which corners touch neighbors
                      let borderRadiusClass = "";
                      if (topLeftRounded) borderRadiusClass += "rounded-tl-md ";
                      if (topRightRounded)
                        borderRadiusClass += "rounded-tr-md ";
                      if (bottomLeftRounded)
                        borderRadiusClass += "rounded-bl-md ";
                      if (bottomRightRounded)
                        borderRadiusClass += "rounded-br-md ";
                      borderRadiusClass =
                        borderRadiusClass.trim() || "rounded-none";

                      const appointmentDuration = getAppointmentDuration(block);
                      const displayedTimeRange =
                        draggedBlockId === block.id && dragPosition
                          ? getAppointmentTimeRange(
                              dragPosition.time,
                              appointmentDuration,
                            )
                          : resizeData && resizeData.appointmentId === block.id
                            ? getDynamicTimeRange(block)
                            : getAppointmentTimeRange(
                                block.time || "",
                                appointmentDuration,
                              );
                      const displayedStartTime =
                        draggedBlockId === block.id && dragPosition
                          ? dragPosition.time
                          : block.time || "";
                      const client =
                        block.client ??
                        clients.find((item) => item.id === block.client_id);
                      const appointmentTitle = [
                        displayedTimeRange,
                        getClientName(client),
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <div
                          key={block.id}
                          className={`absolute text-white ${borderRadiusClass} group overflow-hidden border text-xs transition-all duration-150 ${
                            isDragging || isResizing
                              ? "shadow-lg"
                              : "hover:shadow-md"
                          }`}
                          style={{
                            ...blockStyle,
                            borderWidth: "1px",
                            borderColor: "rgba(255, 255, 255, 0.3)",
                          }}
                          title={appointmentTitle}
                          onContextMenu={(e) =>
                            onAppointmentContextMenu(e, block)
                          }
                        >
                          {/* Top resize handle */}
                          <div
                            className="absolute top-[-5px] right-0 left-0 z-20"
                            style={{
                              height: "10px",
                              cursor: "ns-resize",
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleResizeStart(e, block, "top");
                            }}
                          />

                          {/* Main content - draggable area */}
                          <div
                            className="relative z-0 flex h-full flex-col justify-start px-1 py-[0.5px]"
                            style={{
                              cursor: resizeData ? "default" : "move",
                              marginTop: "1px",
                              marginBottom: "1px",
                            }}
                            onMouseDown={(e) => {
                              if (!resizeData) {
                                handleMouseDown(e, block);
                              }
                            }}
                            onClick={(e) => {
                              // Suppress click if a drag just happened or during resize
                              if (
                                suppressClickRef.current ||
                                draggedData ||
                                resizeData
                              ) {
                                e.preventDefault();
                                e.stopPropagation();
                                suppressClickRef.current = false;
                                return;
                              }
                              e.preventDefault();
                              e.stopPropagation();
                              onAppointmentSelect(block);
                              openEditDialog(block);
                            }}
                          >
                            <AppointmentCardContent
                              height={block.height}
                              timeRange={displayedTimeRange}
                              startTime={formatAppointmentTime(displayedStartTime)}
                              client={client}
                              examName={block.exam_name}
                            />
                          </div>

                          {/* Bottom resize handle */}
                          <div
                            className="absolute right-0 bottom-[-5px] left-0 z-20"
                            style={{
                              height: "10px",
                              cursor: "ns-resize",
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleResizeStart(e, block, "bottom");
                            }}
                          />
                        </div>
                      );
                    })}

                    {/* Show dragged block in new position if moved to this column */}
                    {dragPosition &&
                      draggedData &&
                      isSameDay(dragPosition.date, date) &&
                      !dayBlocks.some(
                        (block) => block.id === draggedBlockId,
                      ) && (
                        <div
                          className="absolute rounded-md border text-xs text-white shadow-lg"
                          style={{
                            top: `${dragPosition.y}px`,
                            height: `${(getAppointmentDuration(draggedData.appointment) / 60) * 95}px`,
                            left: "0%",
                            width: "100%",
                            zIndex: 45,
                            backgroundColor: getUserColor(
                              draggedData.appointment.user_id,
                            ),
                            borderWidth: "1px",
                            borderColor: "rgba(255, 255, 255, 0.3)",
                          }}
                        >
                          <AppointmentCardContent
                            height={
                              (getAppointmentDuration(draggedData.appointment) /
                                60) *
                              95
                            }
                            timeRange={getAppointmentTimeRange(
                              dragPosition.time,
                              getAppointmentDuration(draggedData.appointment),
                            )}
                            startTime={formatAppointmentTime(dragPosition.time)}
                            client={clients.find(
                              (client) =>
                                client.id === draggedData.appointment.client_id,
                            )}
                            examName={draggedData.appointment.exam_name}
                          />
                        </div>
                      )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
