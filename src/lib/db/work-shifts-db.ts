import { apiClient } from '../api-client';
import { WorkShift } from './schema-interface';

export async function createWorkShift(data: Omit<WorkShift, 'id' | 'created_at' | 'updated_at'>) {
  const response = await apiClient.createWorkShift(data);
  return response.data;
}

export async function getWorkShiftById(id: number) {
  const response = await apiClient.getWorkShift(id);
  return response.data;
}

export async function getActiveWorkShiftByUserId(userId: number) {
  const response = await apiClient.getActiveWorkShift(userId);
  return response.data;
}

export async function getWorkShiftsByUserId(userId: number) {
  const response = await apiClient.getWorkShifts(userId);
  return response.data;
}

export async function getWorkShiftsByUserAndMonth(userId: number, year: number, month: number) {
  const response = await apiClient.getWorkShiftsByUserAndMonth(userId, year, month);
  return response.data;
}

export async function getWorkShiftsByUserAndDate(userId: number, date: string) {
  const response = await apiClient.getWorkShiftsByUserAndDate(userId, date);
  return response.data;
}

export async function updateWorkShift(workShift: WorkShift) {
  if (!workShift.id) {
    throw new Error('WorkShift ID is required for update');
  }
  const response = await apiClient.updateWorkShift(workShift.id, workShift);
  return response.data;
}

export async function deleteWorkShift(id: number) {
  const response = await apiClient.deleteWorkShift(id);
  return response.data;
}

export async function getWorkShiftStats(userId: number, year: number, month: number) {
  const response = await apiClient.getWorkShiftStats(userId, year, month);
  return response.data;
} 
