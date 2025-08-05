import { apiClient } from '../api-client';
import { RGExam } from './schema-interface';

export async function createRGExam(data: Omit<RGExam, 'id'>): Promise<RGExam | null> {
  const response = await apiClient.createRGExam(data, data.layout_instance_id);
  return response.data as RGExam | null;
}

export async function getRGExamByLayoutInstanceId(layoutInstanceId: number): Promise<RGExam | null> {
  const response = await apiClient.getRGExam(layoutInstanceId);
  return response.data as RGExam | null;
}

export async function updateRGExam(data: RGExam): Promise<RGExam | null> {
  if (!data.id) {
    throw new Error('RGExam ID is required for update');
  }
  const response = await apiClient.updateRGExam(data.id, data);
  return response.data as RGExam | null;
} 