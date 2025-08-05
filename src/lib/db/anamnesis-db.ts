import { apiClient } from '../api-client';
import { AnamnesisExam } from './schema-interface';

export async function createAnamnesisExam(data: Omit<AnamnesisExam, 'id'>): Promise<AnamnesisExam | null> {
  const response = await apiClient.createAnamnesisExam(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getAnamnesisExamById(id: number) {
  // Note: This would need a specific endpoint in the API
  // For now, we'll need to implement this properly
  throw new Error('getAnamnesisExamById not implemented in API yet');
}

export async function getAnamnesisExamByLayoutInstanceId(layoutInstanceId: number): Promise<AnamnesisExam | null> {
  const response = await apiClient.getAnamnesisExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateAnamnesisExam(exam: AnamnesisExam): Promise<AnamnesisExam | null> {
  if (!exam.id) {
    throw new Error('AnamnesisExam ID is required for update');
  }
  const response = await apiClient.updateAnamnesisExam(exam.id, exam);
  return response.data ?? null;
}

export async function deleteAnamnesisExam(id: number) {
  const response = await apiClient.deleteExamData('anamnesis', id);
  return response.data;
} 