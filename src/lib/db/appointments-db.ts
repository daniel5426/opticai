import { Appointment } from './schema-interface';
import { apiClient } from '../api-client';
import i18n from '@/localization/i18n';

interface AppointmentConflict {
  time?: string;
  end_time?: string;
  client_name?: string | null;
  user_name?: string | null;
}

let lastSaveError: unknown = null;

/** Why the last appointment save failed, in words the user can act on; `fallback` for anything but an overlap. */
export function appointmentSaveErrorMessage(fallback: string): string {
  const detail = lastSaveError as { code?: string; conflict?: AppointmentConflict } | string | null;
  const code = typeof detail === 'string' ? detail : detail?.code;
  if (code !== 'agent.slotUnavailable') return fallback;
  const conflict = typeof detail === 'object' ? detail?.conflict : undefined;
  if (!conflict?.time) return i18n.t('appointmentOverlap');
  const values = {
    user: conflict.user_name || i18n.t('appointmentOverlapExaminer'),
    start: conflict.time,
    end: conflict.end_time,
    client: conflict.client_name,
  };
  return conflict.client_name
    ? i18n.t('appointmentOverlapWith', values)
    : i18n.t('appointmentOverlapAt', values);
}

export async function getAppointmentsByClient(clientId: number): Promise<Appointment[]> {
  try {
    const response = await apiClient.getAppointmentsByClient(clientId);
    if (response.error) {
      console.error('Error getting appointments by client:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting appointments by client:', error);
    return [];
  }
}

export async function getAllAppointments(clinicId?: number): Promise<Appointment[]> {
  try {
    const response = await apiClient.getAppointments(clinicId);
    if (response.error) {
      console.error('Error getting all appointments:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting all appointments:', error);
    return [];
  }
}

export async function getAppointmentsByDateRange(
  clinicId?: number,
  startDate?: string,
  endDate?: string
): Promise<Appointment[]> {
  try {
    // Prefer aggregated dashboard endpoint for performance when possible
    if (clinicId) {
      const resp = await apiClient.getDashboardHome(clinicId, startDate, endDate);
      if ((resp as any).error) {
        console.error('Error getting appointments by date range (dashboard):', (resp as any).error);
        return [];
      }
      const data = (resp as any).data as { appointments?: Appointment[] };
      return (data?.appointments as Appointment[]) || [];
    }
    // Fallback: fetch all and filter (should not happen in normal flow)
    const allAppointments = await getAllAppointments(clinicId);
    if (!startDate || !endDate) return allAppointments;
    return allAppointments.filter(a => a.date && a.date >= startDate && a.date <= endDate);
  } catch (error) {
    console.error('Error getting appointments by date range:', error);
    return [];
  }
}

export async function getPaginatedAppointments(
  clinicId?: number,
  options?: { limit?: number; offset?: number; order?: string; q?: string; dateScope?: string; examName?: string; columnFilters?: string; includeTotal?: boolean; countOnly?: boolean }
): Promise<{ items: Appointment[]; total: number | null; hasMore: boolean }> {
  try {
    const effectiveOptions = options ?? { limit: 25, offset: 0, order: 'date_desc' as const };
    const response = await apiClient.getAppointmentsPaginated(clinicId, effectiveOptions);
    if (response.error) {
      console.error('Error getting paginated appointments:', response.error);
      return { items: [], total: null, hasMore: false };
    }
    return {
      items: response.data?.items || [],
      total: response.data?.total ?? null,
      hasMore: response.data?.has_more ?? false,
    };
  } catch (error) {
    console.error('Error getting paginated appointments:', error);
    return { items: [], total: null, hasMore: false };
  }
}

export async function getAppointmentById(id: number): Promise<Appointment | null> {
  try {
    const response = await apiClient.getAppointment(id);
    if (response.error) {
      console.error('Error getting appointment:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error getting appointment:', error);
    return null;
  }
}

export async function createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment | null> {
  lastSaveError = null;
  try {
    if (!appointment.client_id || appointment.client_id <= 0) {
      console.error('Error creating appointment: Invalid client_id');
      return null;
    }
    
    // Build appointment data, only including fields that have values
    const appointmentData: any = {
      client_id: appointment.client_id,
    };
    
    if (appointment.clinic_id) {
      appointmentData.clinic_id = appointment.clinic_id;
    }
    
    if (appointment.user_id && appointment.user_id > 0) {
      appointmentData.user_id = appointment.user_id;
    }
    
    if (appointment.date && appointment.date !== '') {
      appointmentData.date = new Date(appointment.date).toISOString().split('T')[0];
    }
    
    if (appointment.time && appointment.time !== '') {
      appointmentData.time = appointment.time;
    }
    
    if (appointment.duration) {
      appointmentData.duration = appointment.duration;
    }
    
    if (appointment.exam_name && appointment.exam_name !== '') {
      appointmentData.exam_name = appointment.exam_name;
    }

    if (appointment.exam_layout_id) {
      appointmentData.exam_layout_id = appointment.exam_layout_id;
    }
    
    if (appointment.note && appointment.note !== '') {
      appointmentData.note = appointment.note;
    }
    
    if (appointment.google_calendar_event_id && appointment.google_calendar_event_id !== '') {
      appointmentData.google_calendar_event_id = appointment.google_calendar_event_id;
    }
    
    console.log('Creating appointment with data:', appointmentData);
    console.log('Original appointment data:', appointment);
    
    const response = await apiClient.createAppointment(appointmentData);
    lastSaveError = response.error ? response.errorDetail ?? response.error : null;
    if (response.error) {
      console.error('Error creating appointment:', response.error);
      console.error('Full error response:', response);
      return null;
    }
    
    const createdAppointment = response.data;
    return createdAppointment || null;
  } catch (error) {
    console.error('Error creating appointment:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return null;
  }
}

export async function updateAppointment(appointment: Appointment): Promise<Appointment | null> {
  lastSaveError = null;
  try {
    if (!appointment.id) {
      console.error('Error updating appointment: No appointment ID provided');
      return null;
    }
    
    const response = await apiClient.updateAppointment(appointment.id, appointment);
    lastSaveError = response.error ? response.errorDetail ?? response.error : null;
    if (response.error) {
      console.error('Error updating appointment:', response.error);
      return null;
    }
    
    const updatedAppointment = response.data;
    return updatedAppointment || null;
  } catch (error) {
    console.error('Error updating appointment:', error);
    return null;
  }
}

export async function deleteAppointment(id: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteAppointment(id);
    if (response.error) {
      console.error('Error deleting appointment:', response.error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return false;
  }
} 
