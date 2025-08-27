import { apiClient } from '../api-client'
import { Appointment, Client, Settings, User } from './schema-interface'

export type DashboardHomeResponse = {
  appointments: Appointment[]
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
    return { appointments: [], clients: [], settings: null, users: [] }
  }
  const data = (resp as any).data as DashboardHomeResponse
  return {
    appointments: data?.appointments || [],
    clients: data?.clients || [],
    settings: data?.settings || null,
    users: data?.users || []
  }
}


