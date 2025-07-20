/// <reference path="../../types/electron.d.ts" />
import { MedicalLog } from "./schema";

export async function getMedicalLogsByClientId(clientId: number): Promise<MedicalLog[]> {
  try {
    return await window.electronAPI.db('getMedicalLogsByClientId', clientId);
  } catch (error) {
    console.error('Error getting medical logs:', error);
    return [];
  }
}

export async function getAllMedicalLogs(): Promise<MedicalLog[]> {
  try {
    return await window.electronAPI.db('getAllMedicalLogs');
  } catch (error) {
    console.error('Error getting all medical logs:', error);
    return [];
  }
}

export async function createMedicalLog(log: Omit<MedicalLog, 'id'>): Promise<MedicalLog | null> {
  try {
    const result = await window.electronAPI.db('createMedicalLog', log);
    if (result && log.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', log.client_id);
    }
    return result;
  } catch (error) {
    console.error('Error creating medical log:', error);
    return null;
  }
}

export async function updateMedicalLog(log: MedicalLog): Promise<MedicalLog | null> {
  try {
    const result = await window.electronAPI.db('updateMedicalLog', log);
    if (result && log.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', log.client_id);
    }
    return result;
  } catch (error) {
    console.error('Error updating medical log:', error);
    return null;
  }
}

export async function deleteMedicalLog(id: number): Promise<boolean> {
  try {
    const log = await window.electronAPI.db('getMedicalLogById', id);
    const result = await window.electronAPI.db('deleteMedicalLog', id);
    if (result && log?.client_id) {
      await window.electronAPI.db('updateClientUpdatedDate', log.client_id);
    }
    return result;
  } catch (error) {
    console.error('Error deleting medical log:', error);
    return false;
  }
} 