import { apiClient } from '../api-client';
import { ObjectiveExam } from './schema-interface';

export async function createObjectiveExam(data: Omit<ObjectiveExam, 'id'>): Promise<ObjectiveExam | null> {
  const response = await apiClient.createObjectiveExam(data, data.layout_instance_id);
  return response.data as ObjectiveExam | null;
}

export async function getObjectiveExamByLayoutInstanceId(layoutInstanceId: number): Promise<ObjectiveExam | null> {
  const response = await apiClient.getObjectiveExam(layoutInstanceId);
  return response.data as ObjectiveExam | null;
}

export async function updateObjectiveExam(exam: ObjectiveExam): Promise<ObjectiveExam | null> {
  if (!exam.id) {
    throw new Error('ObjectiveExam ID is required for update');
  }
  const response = await apiClient.updateObjectiveExam(exam.id, exam);
  return response.data as ObjectiveExam | null;
} 