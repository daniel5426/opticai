import { Appointment, User, Client } from './schema-interface';
import { apiClient } from '../api-client';
import { googleCalendarSync } from '../google/google-calendar-sync';

/**
 * Get current user from localStorage for sync operations
 */
async function getCurrentUserForSync(): Promise<User | null> {
  try {
    const userStr = localStorage.getItem('currentUser');
    if (!userStr) return null;
    return JSON.parse(userStr) as User;
  } catch (error) {
    console.error('Error getting current user for sync:', error);
    return null;
  }
}

/**
 * Get client data for sync operations
 */
async function getClientForSync(clientId: number): Promise<Client | null> {
  try {
    const response = await apiClient.getClientById(clientId);
    return response.data || null;
  } catch (error) {
    console.error('Error getting client for sync:', error);
    return null;
  }
}

/**
 * Get the appointment owner (assigned examiner) user for calendar sync
 */
async function getOwnerUserForSync(userId?: number | null): Promise<User | null> {
  try {
    if (!userId) return null;
    // Prefer locally stored currentUser if it matches (has tokens)
    const currentUser = await getCurrentUserForSync();
    if (currentUser?.id === userId) {
      return currentUser;
    }
    const response = await apiClient.getUser(userId);
    return response.data || null;
  } catch (error) {
    console.error('Error getting owner user for sync:', error);
    return null;
  }
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
  options?: { limit?: number; offset?: number; order?: 'date_desc' | 'date_asc' | 'id_desc' | 'id_asc'; search?: string }
): Promise<{ items: Appointment[]; total: number }> {
  try {
    const effectiveOptions = options ?? { limit: 25, offset: 0, order: 'date_desc' as const };
    const response = await apiClient.getAppointmentsPaginated(clinicId, effectiveOptions);
    if (response.error) {
      console.error('Error getting paginated appointments:', response.error);
      return { items: [], total: 0 };
    }
    return response.data || { items: [], total: 0 };
  } catch (error) {
    console.error('Error getting paginated appointments:', error);
    return { items: [], total: 0 };
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
    
    if (appointment.note && appointment.note !== '') {
      appointmentData.note = appointment.note;
    }
    
    if (appointment.google_calendar_event_id && appointment.google_calendar_event_id !== '') {
      appointmentData.google_calendar_event_id = appointment.google_calendar_event_id;
    }
    
    console.log('Creating appointment with data:', appointmentData);
    console.log('Original appointment data:', appointment);
    
    const response = await apiClient.createAppointment(appointmentData);
    if (response.error) {
      console.error('Error creating appointment:', response.error);
      console.error('Full error response:', response);
      return null;
    }
    
    const createdAppointment = response.data;
    if (createdAppointment) {
      // Trigger automatic Google Calendar sync
      try {
        // Prefer assigned examiner's calendar; fallback to current user
        let calendarUser: User | null = null;
        if (createdAppointment.user_id) {
          calendarUser = await getOwnerUserForSync(createdAppointment.user_id);
        }
        if (!calendarUser) {
          calendarUser = await getCurrentUserForSync();
        }
        if (calendarUser?.google_account_connected && calendarUser?.google_calendar_sync_enabled) {
          console.log('Auto-syncing new appointment to Google Calendar');
          const client = await getClientForSync(createdAppointment.client_id);
          const eventId = await googleCalendarSync.syncAppointmentCreated(createdAppointment, client, calendarUser);
          
          // Update appointment with Google Calendar event ID if sync was successful
          if (eventId && createdAppointment.id) {
            try {
              await apiClient.updateAppointmentGoogleEventId(createdAppointment.id, eventId);
              createdAppointment.google_calendar_event_id = eventId;
              console.log('Appointment synced to Google Calendar with event ID:', eventId);
            } catch (error) {
              console.error('Failed to save Google Calendar event ID:', error);
            }
          }
        }
      } catch (syncError) {
        console.error('Auto-sync to Google Calendar failed (non-blocking):', syncError);
        // Don't fail the appointment creation if sync fails
      }
    }
    
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
  try {
    if (!appointment.id) {
      console.error('Error updating appointment: No appointment ID provided');
      return null;
    }
    
    // Fetch previous appointment to get existing google event id and owner
    const previous = await getAppointmentById(appointment.id);
    const response = await apiClient.updateAppointment(appointment.id, appointment);
    if (response.error) {
      console.error('Error updating appointment:', response.error);
      return null;
    }
    
    const updatedAppointment = response.data;
    if (updatedAppointment) {
      // Trigger automatic Google Calendar sync
      try {
        // Determine which user's calendar to use: assigned user if present; otherwise current user
        let calendarUser: User | null = null;
        if (updatedAppointment.user_id) {
          calendarUser = await getOwnerUserForSync(updatedAppointment.user_id);
        }
        if (!calendarUser) {
          calendarUser = await getCurrentUserForSync();
        }
        if (calendarUser?.google_account_connected && calendarUser?.google_calendar_sync_enabled) {
          console.log('Auto-syncing updated appointment to Google Calendar');
          const client = await getClientForSync(updatedAppointment.client_id);

          // If the appointment owner changed, delete the old event from previous owner's calendar
          const ownerChanged = previous && previous.user_id !== updatedAppointment.user_id;
          if (ownerChanged && previous?.google_calendar_event_id) {
            const previousOwner = await getOwnerUserForSync(previous.user_id);
            // Even if previous owner is not currently connected, try deleting using current user's tokens if they match previous owner
            const deleterUser = (previousOwner?.google_account_connected ? previousOwner : null)
              || ((await getCurrentUserForSync())?.id === previous.user_id ? await getCurrentUserForSync() : null);
            if (deleterUser?.google_account_connected) {
              try {
                await googleCalendarSync.syncAppointmentDeleted(deleterUser, previous.google_calendar_event_id);
              } catch (e) {
                console.warn('Failed to delete old event on previous owner calendar:', e);
              }
            }
          }

          // If there is no stored event ID (or owner changed), create new event and store id
          if (!updatedAppointment.google_calendar_event_id || ownerChanged) {
            const eventId = await googleCalendarSync.syncAppointmentCreated(updatedAppointment, client, calendarUser);
            if (eventId && updatedAppointment.id) {
              try {
                await apiClient.updateAppointmentGoogleEventId(updatedAppointment.id, eventId);
                updatedAppointment.google_calendar_event_id = eventId;
              } catch (error) {
                console.error('Failed to save Google Calendar event ID on update:', error);
              }
            }
          } else {
            // Update existing event
            const success = await googleCalendarSync.syncAppointmentUpdated(
              updatedAppointment,
              client,
              calendarUser,
              updatedAppointment.google_calendar_event_id
            );
            if (!success) {
              console.warn('Update failed; attempting to recreate event');
              const eventId = await googleCalendarSync.syncAppointmentCreated(updatedAppointment, client, calendarUser);
              if (eventId && updatedAppointment.id) {
                try {
                  await apiClient.updateAppointmentGoogleEventId(updatedAppointment.id, eventId);
                  updatedAppointment.google_calendar_event_id = eventId;
                } catch (error) {
                  console.error('Failed to save recreated Google event ID:', error);
                }
              }
            }
          }
        }
      } catch (syncError) {
        console.error('Auto-sync to Google Calendar failed (non-blocking):', syncError);
        // Don't fail the appointment update if sync fails
      }
    }
    
    return updatedAppointment || null;
  } catch (error) {
    console.error('Error updating appointment:', error);
    return null;
  }
}

export async function deleteAppointment(id: number): Promise<boolean> {
  try {
    // Get appointment data before deletion for sync purposes
    let appointmentToDelete: Appointment | null = null;
    try {
      appointmentToDelete = await getAppointmentById(id);
    } catch (error) {
      console.log('Could not fetch appointment before deletion for sync purposes');
    }
    
    const response = await apiClient.deleteAppointment(id);
    if (response.error) {
      console.error('Error deleting appointment:', response.error);
      return false;
    }
    
    // Trigger automatic Google Calendar sync for deletion
    if (appointmentToDelete) {
      try {
        // Prefer appointment owner calendar if available
        const owner = await getOwnerUserForSync(appointmentToDelete.user_id);
        const calendarUser = owner || await getCurrentUserForSync();
        if (calendarUser?.google_account_connected && calendarUser?.google_calendar_sync_enabled && appointmentToDelete.google_calendar_event_id) {
          console.log('Auto-syncing appointment deletion to Google Calendar');
          const success = await googleCalendarSync.syncAppointmentDeleted(
            calendarUser, 
            appointmentToDelete.google_calendar_event_id
          );
          
          if (success) {
            console.log('Appointment deleted from Google Calendar');
          }
        }
      } catch (syncError) {
        console.error('Auto-sync deletion to Google Calendar failed (non-blocking):', syncError);
        // Don't fail the appointment deletion if sync fails
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return false;
  }
} 