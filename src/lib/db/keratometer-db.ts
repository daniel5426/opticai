import { apiClient } from '../api-client';
import { KeratometerExam } from './schema-interface';

export async function createKeratometerExam(data: Omit<KeratometerExam, 'id'>): Promise<KeratometerExam | null> {
  const response = await apiClient.createKeratometerExam(data, data.layout_instance_id);
  return response.data ?? null;
}

export async function getKeratometerExamByLayoutInstanceId(layoutInstanceId: number): Promise<KeratometerExam | null> {
  const response = await apiClient.getKeratometerExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateKeratometerExam(exam: KeratometerExam): Promise<KeratometerExam | null> {
  if (!exam.id) {
    throw new Error('KeratometerExam ID is required for update');
  }
  const response = await apiClient.updateKeratometerExam(exam.id, exam);
  return response.data ?? null;
} 