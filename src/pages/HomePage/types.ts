import { Appointment, Client } from "@/lib/db/schema-interface"

export type CalendarView = 'day' | 'week' | 'month'

export interface AppointmentBlock extends Appointment {
  client?: Client
  top: number
  height: number
  left: number
  width: number
  zIndex: number
}

export interface DragData {
  appointment: Appointment
  offset: { x: number; y: number }
  originalElement: HTMLElement
}

export interface DragPosition {
  x: number
  y: number
  date: Date
  time: string
}

export interface ResizeData {
  appointmentId: number
  type: 'top' | 'bottom'
  originalStart: string
  originalEnd: string
}

export interface ExistingClientWarning {
  show: boolean
  clients: Client[]
  type: 'name' | 'phone' | 'email' | 'multiple'
}

