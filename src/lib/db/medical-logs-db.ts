/// <reference path="../../types/electron.d.ts" />
import { MedicalLog } from './schema-interface';
import { apiClient } from '../api-client';

export async function getMedicalLogsByClientId(clientId: number): Promise<MedicalLog[]> {
  try {
    const response = await apiClient.getMedicalLogsByClient(clientId);
    if (response.error) {
      console.error('Error getting medical logs by client:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting medical logs by client:', error);
    return [];
  }
}

export async function getAllMedicalLogs(clinicId?: number): Promise<MedicalLog[]> {
  try {
    const response = await apiClient.getMedicalLogs(clinicId);
    if (response.error) {
      console.error('Error getting all medical logs:', response.error);
      return [];
    }
    return response.data || [];
  } catch (error) {
    console.error('Error getting all medical logs:', error);
    return [];
  }
}

export async function createMedicalLog(log: Omit<MedicalLog, 'id'>): Promise<MedicalLog | null> {
  try {
    const response = await apiClient.createMedicalLog(log);
    if (response.error) {
      console.error('Error creating medical log:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error creating medical log:', error);
    return null;
  }
}

export async function updateMedicalLog(log: MedicalLog): Promise<MedicalLog | null> {
  try {
    if (!log.id) {
      console.error('Error updating medical log: No log ID provided');
      return null;
    }
    const response = await apiClient.updateMedicalLog(log.id, log);
    if (response.error) {
      console.error('Error updating medical log:', response.error);
      return null;
    }
    return response.data || null;
  } catch (error) {
    console.error('Error updating medical log:', error);
    return null;
  }
}

export async function deleteMedicalLog(id: number): Promise<boolean> {
  try {
    const response = await apiClient.deleteMedicalLog(id);
    if (response.error) {
      console.error('Error deleting medical log:', response.error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error deleting medical log:', error);
    return false;
  }
} 