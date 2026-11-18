import { apiClient } from '../api-client'
import { Appointment, CalendarEvent, Client, Settings, User } from './schema-interface'

export type DashboardHomeResponse = {
  calendar_revision?: number
  appointments: Appointment[]
  events: CalendarEvent[]
  clients: Client[]
  settings: Settings | null
  users: User[]
}

export async function getDashboardHome(
  clinicId: number,
  startDate?: string,
  endDate?: string
): Promise<DashboardHomeResponse> {
  const resp = await apiClient.getDashboardHome(clinicId, startDate, endDate)
  if ((resp as any).error) {
    console.error('Error fetching dashboard home:', (resp as any).error)
    return { appointments: [], events: [], clients: [], settings: null, users: [] }
  }
  const data = (resp as any).data as DashboardHomeResponse
  return {
    calendar_revision: data?.calendar_revision,
    appointments: data?.appointments || [],
    events: data?.events || [],
    clients: data?.clients || [],
    settings: data?.settings || null,
    users: data?.users || []
  }
}


