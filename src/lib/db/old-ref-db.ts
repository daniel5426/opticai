import { apiClient } from '../api-client';
import { OldRefExam } from './schema-interface';

export async function createOldRefExam(data: Omit<OldRefExam, 'id'>): Promise<OldRefExam | null> {
  const response = await apiClient.createOldRefExam(data, data.layout_instance_id);
  return response.data ?? null;
}

export async function getOldRefExamByLayoutInstanceId(layoutInstanceId: number): Promise<OldRefExam | null> {
  const response = await apiClient.getOldRefExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateOldRefExam(exam: OldRefExam): Promise<OldRefExam | null> {
  if (!exam.id) {
    throw new Error('OldRefExam ID is required for update');
  }
  const response = await apiClient.updateOldRefExam(exam.id, exam);
  return response.data ?? null;
} 