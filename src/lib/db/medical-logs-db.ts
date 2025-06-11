/// <reference path="../../types/electron.d.ts" />
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