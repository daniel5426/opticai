import { apiClient } from '../api-client';
import { WorkShift } from './schema-interface';

export async function createWorkShift(data: Omit<WorkShift, 'id' | 'created_at' | 'updated_at'>) {
  const response = await apiClient.createWorkShift(data);
  return response.data;
}

export async function getWorkShiftById(id: number) {
  // Note: apiClient doesn't have a direct getWorkShift method
  // This would need to be implemented in the API or we can get all work shifts and filter
  const response = await apiClient.getWorkShifts(0); // Get all work shifts
  const workShifts = response.data || [];
  return workShifts.find(ws => ws.id === id);
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