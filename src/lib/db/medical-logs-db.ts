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
    return await window.electronAPI.db('createMedicalLog', log);
  } catch (error) {
    console.error('Error creating medical log:', error);
    return null;
  }
}

export async function updateMedicalLog(log: MedicalLog): Promise<MedicalLog | null> {
  try {
    return await window.electronAPI.db('updateMedicalLog', log);
  } catch (error) {
    console.error('Error updating medical log:', error);
    return null;
  }
}

export async function deleteMedicalLog(id: number): Promise<boolean> {
  try {
    return await window.electronAPI.db('deleteMedicalLog', id);
  } catch (error) {
    console.error('Error deleting medical log:', error);
    return false;
  }
} 