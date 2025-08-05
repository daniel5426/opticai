import { apiClient } from '../api-client';
import { AdditionExam } from './schema-interface';

export async function createAdditionExam(data: Omit<AdditionExam, 'id'>): Promise<AdditionExam | null> {
  const response = await apiClient.createAdditionExam(data, data.layout_instance_id);
  return response.data as AdditionExam | null;
}

export async function getAdditionExamByLayoutInstanceId(layoutInstanceId: number): Promise<AdditionExam | null> {
  const response = await apiClient.getAdditionExam(layoutInstanceId);
  return response.data as AdditionExam | null;
}

export async function updateAdditionExam(exam: AdditionExam): Promise<AdditionExam | null> {
  if (!exam.id) {
    throw new Error('AdditionExam ID is required for update');
  }
  const response = await apiClient.updateAdditionExam(exam.id, exam);
  return response.data as AdditionExam | null;
} 