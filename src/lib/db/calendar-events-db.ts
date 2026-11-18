import { apiClient } from '../api-client'
import { CalendarEvent } from './schema-interface'

type Saved = { event?: CalendarEvent; error?: string }

export async function saveCalendarEvent(event: CalendarEvent): Promise<Saved> {
  const { id, ...body } = event
  const response = await apiClient.calendarEventRequest<CalendarEvent>(id ? `/${id}` : '', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(id ? { ...body, clinic_id: undefined } : body),
  })
  return response.error ? { error: response.error } : { event: response.data }
}

export async function deleteCalendarEvent(id: number): Promise<boolean> {
  return !(await apiClient.calendarEventRequest(`/${id}`, { method: 'DELETE' })).error
}
