import { apiClient } from '../api-client';
import { CornealTopographyExam } from './schema-interface';

export async function createCornealTopographyExam(data: Omit<CornealTopographyExam, 'id'>): Promise<CornealTopographyExam | null> {
  const response = await apiClient.createCornealTopographyExam(data, data.layout_instance_id);
  return response.data ?? null;
}

export async function getCornealTopographyExamByLayoutInstanceId(layoutInstanceId: number): Promise<CornealTopographyExam | null> {
  const response = await apiClient.getCornealTopographyExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateCornealTopographyExam(exam: CornealTopographyExam): Promise<CornealTopographyExam | null> {
  if (!exam.id) {
    throw new Error('CornealTopographyExam ID is required for update');
  }
  const response = await apiClient.updateCornealTopographyExam(exam.id, exam);
  return response.data ?? null;
} 