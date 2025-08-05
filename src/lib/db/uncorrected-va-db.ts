import { apiClient } from '../api-client';
import { UncorrectedVAExam } from './schema-interface';

export async function createUncorrectedVAExam(data: Omit<UncorrectedVAExam, 'id'>): Promise<UncorrectedVAExam | null> {
  const response = await apiClient.createUncorrectedVAExam(data, data.layout_instance_id);
  return response.data as UncorrectedVAExam | null;
}

export async function getUncorrectedVAExamByLayoutInstanceId(layoutInstanceId: number): Promise<UncorrectedVAExam | null> {
  const response = await apiClient.getUncorrectedVAExam(layoutInstanceId);
  return response.data as UncorrectedVAExam | null;
}

export async function updateUncorrectedVAExam(exam: UncorrectedVAExam): Promise<UncorrectedVAExam | null> {
  if (!exam.id) {
    throw new Error('UncorrectedVAExam ID is required for update');
  }
  const response = await apiClient.updateUncorrectedVAExam(exam.id, exam);
  return response.data as UncorrectedVAExam | null;
} 