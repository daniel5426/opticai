import { MedicalLog } from "./schema";

export async function getMedicalLogsByClientId(clientId: number): Promise<MedicalLog[]> {
  try {
    return await window.electronAPI.getMedicalLogsByClient(clientId);
  } catch (error) {
    console.error('Error getting medical logs:', error);
    return [];
  }
}

export async function createMedicalLog(log: Omit<MedicalLog, 'id'>): Promise<MedicalLog | null> {
  try {
    return await window.electronAPI.createMedicalLog(log);
  } catch (error) {
    console.error('Error creating medical log:', error);
    return null;
  }
}

export async function updateMedicalLog(log: MedicalLog): Promise<MedicalLog | null> {
  try {
    return await window.electronAPI.updateMedicalLog(log);
  } catch (error) {
    console.error('Error updating medical log:', error);
    return null;
  }
}

export async function deleteMedicalLog(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.deleteMedicalLog(id);
  } catch (error) {
    console.error('Error deleting medical log:', error);
    return false;
  }
} 