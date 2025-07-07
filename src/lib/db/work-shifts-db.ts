import { connectionManager } from './connection-manager';
import { WorkShift } from './schema';

export function createWorkShift(data: Omit<WorkShift, 'id' | 'created_at' | 'updated_at'>) {
  return connectionManager.createWorkShift(data);
}

export function getWorkShiftById(id: number) {
  return connectionManager.getWorkShiftById(id);
}

export function getActiveWorkShiftByUserId(userId: number) {
  return connectionManager.getActiveWorkShiftByUserId(userId);
}

export function getWorkShiftsByUserId(userId: number) {
  return connectionManager.getWorkShiftsByUserId(userId);
}

export function getWorkShiftsByUserAndMonth(userId: number, year: number, month: number) {
  return connectionManager.getWorkShiftsByUserAndMonth(userId, year, month);
}

export function getWorkShiftsByUserAndDate(userId: number, date: string) {
  return connectionManager.getWorkShiftsByUserAndDate(userId, date);
}

export function updateWorkShift(workShift: WorkShift) {
  return connectionManager.updateWorkShift(workShift);
}

export function deleteWorkShift(id: number) {
  return connectionManager.deleteWorkShift(id);
}

export function getWorkShiftStats(userId: number, year: number, month: number) {
  return connectionManager.getWorkShiftStats(userId, year, month);
} 