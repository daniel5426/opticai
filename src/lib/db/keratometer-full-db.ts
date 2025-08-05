import { apiClient } from '../api-client';
import { KeratometerFullExam } from './schema-interface';

export async function createKeratometerFullExam(data: Omit<KeratometerFullExam, 'id'>): Promise<KeratometerFullExam | null> {
  const response = await apiClient.createKeratometerFullExam(data, data.layout_instance_id);
  return response.data ?? null;
}

export async function getKeratometerFullExamByLayoutInstanceId(layoutInstanceId: number): Promise<KeratometerFullExam | null> {
  const response = await apiClient.getKeratometerFullExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateKeratometerFullExam(exam: KeratometerFullExam): Promise<KeratometerFullExam | null> {
  if (!exam.id) {
    throw new Error('KeratometerFullExam ID is required for update');
  }
  const response = await apiClient.updateKeratometerFullExam(exam.id, exam);
  return response.data ?? null;
} 