import { apiClient } from '../api-client';
import { OldRefractionExtensionExam } from './schema-interface';

export async function createOldRefractionExtensionExam(data: Omit<OldRefractionExtensionExam, 'id'>): Promise<OldRefractionExtensionExam | null> {
  const response = await apiClient.createOldRefractionExtensionExam(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getOldRefractionExtensionExamByLayoutInstanceId(layoutInstanceId: number): Promise<OldRefractionExtensionExam | null> {
  const response = await apiClient.getOldRefractionExtensionExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateOldRefractionExtensionExam(exam: OldRefractionExtensionExam): Promise<OldRefractionExtensionExam | null> {
  if (!exam.id) {
    throw new Error('OldRefractionExtensionExam ID is required for update');
  }
  const response = await apiClient.updateOldRefractionExtensionExam(exam.id, exam);
  return response.data ?? null;
} 