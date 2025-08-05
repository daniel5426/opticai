import { apiClient } from '../api-client';
import { SubjectiveExam } from './schema-interface';

export async function createSubjectiveExam(data: Omit<SubjectiveExam, 'id'>): Promise<SubjectiveExam | null> {
  const response = await apiClient.createSubjectiveExam(data, data.layout_instance_id);
  return response.data as SubjectiveExam | null;
}

export async function getSubjectiveExamByLayoutInstanceId(layoutInstanceId: number): Promise<SubjectiveExam | null> {
  const response = await apiClient.getSubjectiveExam(layoutInstanceId);
  return response.data as SubjectiveExam | null;
}

export async function updateSubjectiveExam(exam: SubjectiveExam): Promise<SubjectiveExam | null> {
  if (!exam.id) {
    throw new Error('SubjectiveExam ID is required for update');
  }
  const response = await apiClient.updateSubjectiveExam(exam.id, exam);
  return response.data as SubjectiveExam | null;
} 