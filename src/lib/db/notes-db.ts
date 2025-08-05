import { apiClient } from '../api-client';
import { NotesExam } from './schema-interface';

export async function createNotesExam(data: Omit<NotesExam, 'id'>): Promise<NotesExam | null> {
  const response = await apiClient.createNotesExam(data, data.layout_instance_id);
  return response.data ?? null;
}

export async function updateNotesExam(data: NotesExam): Promise<NotesExam | null> {
  if (!data.id) {
    throw new Error('NotesExam ID is required for update');
  }
  const response = await apiClient.updateNotesExam(data.id, data);
  return response.data ?? null;
}

export async function getAllNotesExamsByLayoutInstanceId(layoutInstanceId: number): Promise<NotesExam[]> {
  const response = await apiClient.getNotesExam(layoutInstanceId);
  return response.data ? [response.data] : [];
}

export async function getNotesExamById(id: number): Promise<NotesExam | null> {
  throw new Error('getNotesExamById not implemented in API yet');
}

export async function getNotesExamByLayoutInstanceId(layout_instance_id: number): Promise<NotesExam | null> {
  const response = await apiClient.getNotesExam(layout_instance_id);
  return response.data || null;
}

export async function deleteNotesExam(id: number): Promise<boolean> {
  const response = await apiClient.deleteExamData('notes', id);
  return !response.error;
} 