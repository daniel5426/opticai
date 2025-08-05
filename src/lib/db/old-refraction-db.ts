import { apiClient } from '../api-client';
import { OldRefractionExam } from './schema-interface';

export async function createOldRefractionExam(data: Omit<OldRefractionExam, 'id'>): Promise<OldRefractionExam | null> {
  const response = await apiClient.createOldRefractionExam(data, data.layout_instance_id);
  return response.data as OldRefractionExam | null;
}

export async function getOldRefractionExamByLayoutInstanceId(layoutInstanceId: number): Promise<OldRefractionExam | null> {
  const response = await apiClient.getOldRefractionExam(layoutInstanceId);
  return response.data as OldRefractionExam | null;
}

export async function updateOldRefractionExam(exam: OldRefractionExam): Promise<OldRefractionExam | null> {
  if (!exam.id) {
    throw new Error('OldRefractionExam ID is required for update');
  }
  const response = await apiClient.updateOldRefractionExam(exam.id, exam);
  return response.data as OldRefractionExam | null;
} 