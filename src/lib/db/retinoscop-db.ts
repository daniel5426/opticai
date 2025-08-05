import { apiClient } from '../api-client';
import { RetinoscopExam } from './schema-interface';

export async function createRetinoscopExam(data: Omit<RetinoscopExam, 'id'>): Promise<RetinoscopExam | null> {
  const response = await apiClient.createRetinoscopExam(data, data.layout_instance_id);
  return response.data as RetinoscopExam | null;
}

export async function getRetinoscopExamByLayoutInstanceId(layoutInstanceId: number): Promise<RetinoscopExam | null> {
  const response = await apiClient.getRetinoscopExam(layoutInstanceId);
  return response.data as RetinoscopExam | null;
}

export async function updateRetinoscopExam(exam: RetinoscopExam): Promise<RetinoscopExam | null> {
  if (!exam.id) {
    throw new Error('RetinoscopExam ID is required for update');
  }
  const response = await apiClient.updateRetinoscopExam(exam.id, exam);
  return response.data as RetinoscopExam | null;
} 