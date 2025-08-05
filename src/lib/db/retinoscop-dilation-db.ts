import { apiClient } from '../api-client';
import { RetinoscopDilationExam } from './schema-interface';

export async function createRetinoscopDilationExam(data: Omit<RetinoscopDilationExam, 'id'>): Promise<RetinoscopDilationExam | null> {
  const response = await apiClient.createRetinoscopDilationExam(data, data.layout_instance_id);
  return response.data as RetinoscopDilationExam | null;
}

export async function getRetinoscopDilationExamByLayoutInstanceId(layoutInstanceId: number): Promise<RetinoscopDilationExam | null> {
  const response = await apiClient.getRetinoscopDilationExam(layoutInstanceId);
  return response.data as RetinoscopDilationExam | null;
}

export async function updateRetinoscopDilationExam(exam: RetinoscopDilationExam): Promise<RetinoscopDilationExam | null> {
  if (!exam.id) {
    throw new Error('RetinoscopDilationExam ID is required for update');
  }
  const response = await apiClient.updateRetinoscopDilationExam(exam.id, exam);
  return response.data as RetinoscopDilationExam | null;
} 