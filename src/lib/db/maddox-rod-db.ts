import { apiClient } from '../api-client';
import { MaddoxRodExam } from './schema-interface';

export async function createMaddoxRodExam(data: Omit<MaddoxRodExam, 'id'>): Promise<MaddoxRodExam | null> {
  const response = await apiClient.createMaddoxRodExam(data, data.layout_instance_id);
  return response.data as MaddoxRodExam | null;
}

export async function getMaddoxRodExamByLayoutInstanceId(layoutInstanceId: number): Promise<MaddoxRodExam | null> {
  const response = await apiClient.getMaddoxRodExam(layoutInstanceId);
  return response.data as MaddoxRodExam | null;
}

export async function updateMaddoxRodExam(data: MaddoxRodExam): Promise<MaddoxRodExam | null> {
  if (!data.id) {
    throw new Error('MaddoxRodExam ID is required for update');
  }
  const response = await apiClient.updateMaddoxRodExam(data.id, data);
  return response.data as MaddoxRodExam | null;
} 