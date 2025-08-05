import { apiClient } from '../api-client';
import { FusionRangeExam } from './schema-interface';

export async function createFusionRangeExam(data: Omit<FusionRangeExam, 'id'>): Promise<FusionRangeExam | null> {
  const response = await apiClient.createFusionRangeExam(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getFusionRangeExamByLayoutInstanceId(layoutInstanceId: number): Promise<FusionRangeExam | null> {
  const response = await apiClient.getFusionRangeExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateFusionRangeExam(exam: FusionRangeExam): Promise<FusionRangeExam | null> {
  if (!exam.id) {
    throw new Error('FusionRangeExam ID is required for update');
  }
  const response = await apiClient.updateFusionRangeExam(exam.id, exam);
  return response.data ?? null;
} 