import { apiClient } from '../api-client';
import { SchirmerTestExam } from './schema-interface';

export async function createSchirmerTestExam(data: Omit<SchirmerTestExam, 'id'>): Promise<SchirmerTestExam | null> {
  const response = await apiClient.createSchirmerTestExam(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getSchirmerTestExamById(id: number) {
  // Note: This would need a specific endpoint in the API
  throw new Error('getSchirmerTestExamById not implemented in API yet');
}

export async function getSchirmerTestExamByLayoutInstanceId(layoutInstanceId: number): Promise<SchirmerTestExam | null> {
  const response = await apiClient.getSchirmerTestExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateSchirmerTestExam(exam: SchirmerTestExam): Promise<SchirmerTestExam | null> {
  if (!exam.id) {
    throw new Error('SchirmerTestExam ID is required for update');
  }
  const response = await apiClient.updateSchirmerTestExam(exam.id, exam);
  return response.data ?? null;
} 