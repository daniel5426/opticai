import { apiClient } from '../api-client';
import { FinalSubjectiveExam } from './schema-interface';

export async function createFinalSubjectiveExam(data: Omit<FinalSubjectiveExam, 'id'>): Promise<FinalSubjectiveExam | null> {
  const response = await apiClient.createFinalSubjectiveExam(data, data.layout_instance_id);
  return response.data as FinalSubjectiveExam | null;
}

export async function getFinalSubjectiveExamByLayoutInstanceId(layoutInstanceId: number): Promise<FinalSubjectiveExam | null> {
  const response = await apiClient.getFinalSubjectiveExam(layoutInstanceId);
  return response.data as FinalSubjectiveExam | null;
}

export async function updateFinalSubjectiveExam(exam: FinalSubjectiveExam): Promise<FinalSubjectiveExam | null> {
  if (!exam.id) {
    throw new Error('FinalSubjectiveExam ID is required for update');
  }
  const response = await apiClient.updateFinalSubjectiveExam(exam.id, exam);
  return response.data as FinalSubjectiveExam | null;
} 