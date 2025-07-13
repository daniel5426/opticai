import { Appointment } from './schema';

export async function getAppointmentsByClient(clientId: number): Promise<Appointment[]> {
  try {
    return await window.electronAPI.db('getAppointmentsByClientId', clientId);
  } catch (error) {
    console.error('Error getting appointments by client:', error);
    return [];
  }
}

export async function getAllAppointments(): Promise<Appointment[]> {
  try {
    return await window.electronAPI.db('getAllAppointments');
  } catch (error) {
    console.error('Error getting all appointments:', error);
    return [];
  }
}

export async function getAppointmentById(id: number): Promise<Appointment | null> {
  try {
    return await window.electronAPI.db('getAppointmentById', id);
  } catch (error) {
    console.error('Error getting appointment:', error);
    return null;
  }
}

export async function createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment | null> {
  try {
    const result = await window.electronAPI.db('createAppointment', appointment);
    if (result && appointment.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', appointment.client_id);
      await window.electronAPI.db('updateClientPartUpdatedDate', appointment.client_id, 'appointment');
    }
    return result;
  } catch (error) {
    console.error('Error creating appointment:', error);
    return null;
  }
}

export async function updateAppointment(appointment: Appointment): Promise<Appointment | null> {
  try {
    const result = await window.electronAPI.db('updateAppointment', appointment);
    if (result && appointment.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', appointment.client_id);
      await window.electronAPI.db('updateClientPartUpdatedDate', appointment.client_id, 'appointment');
    }
    return result;
  } catch (error) {
    console.error('Error updating appointment:', error);
    return null;
  }
}

export async function deleteAppointment(id: number): Promise<boolean> {
  try {
    const appointment = await window.electronAPI.db('getAppointmentById', id);
    const result = await window.electronAPI.db('deleteAppointment', id);
    if (result && appointment?.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', appointment.client_id);
      await window.electronAPI.db('updateClientPartUpdatedDate', appointment.client_id, 'appointment');
    }
    return result;
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return false;
  }
} 