import { apiClient } from '../api-client';
import { SensationVisionStabilityExam } from './schema-interface';

export async function createSensationVisionStabilityExam(data: Omit<SensationVisionStabilityExam, 'id'>): Promise<SensationVisionStabilityExam | null> {
  const response = await apiClient.createSensationVisionStabilityExam(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getSensationVisionStabilityExamByLayoutInstanceId(layoutInstanceId: number): Promise<SensationVisionStabilityExam | null> {
  const response = await apiClient.getSensationVisionStabilityExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateSensationVisionStabilityExam(exam: SensationVisionStabilityExam): Promise<SensationVisionStabilityExam | null> {
  if (!exam.id) {
    throw new Error('SensationVisionStabilityExam ID is required for update');
  }
  const response = await apiClient.updateSensationVisionStabilityExam(exam.id, exam);
  return response.data ?? null;
} 