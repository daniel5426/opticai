import { Appointment } from './schema';

export async function getAppointmentsByClient(clientId: number): Promise<Appointment[]> {
  try {
    return await window.electronAPI.getAppointmentsByClient(clientId);
  } catch (error) {
    console.error('Error getting appointments by client:', error);
    return [];
  }
}

export async function getAllAppointments(): Promise<Appointment[]> {
  try {
    return await window.electronAPI.getAllAppointments();
  } catch (error) {
    console.error('Error getting all appointments:', error);
    return [];
  }
}

export async function getAppointmentById(id: number): Promise<Appointment | null> {
  try {
    return await window.electronAPI.getAppointment(id);
  } catch (error) {
    console.error('Error getting appointment:', error);
    return null;
  }
}

export async function createAppointment(appointment: Omit<Appointment, 'id'>): Promise<Appointment | null> {
  try {
    return await window.electronAPI.createAppointment(appointment);
  } catch (error) {
    console.error('Error creating appointment:', error);
    return null;
  }
}

export async function updateAppointment(appointment: Appointment): Promise<Appointment | null> {
  try {
    return await window.electronAPI.updateAppointment(appointment);
  } catch (error) {
    console.error('Error updating appointment:', error);
    return null;
  }
}

export async function deleteAppointment(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteAppointment(id);
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return false;
  }
} 