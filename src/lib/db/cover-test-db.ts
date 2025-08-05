import { apiClient } from '../api-client';
import { CoverTestExam } from './schema-interface';

export async function createCoverTestExam(data: Omit<CoverTestExam, 'id'>, cardInstanceId?: string, cardId?: string, tabIndex?: number): Promise<CoverTestExam | null> {
  const examData = { ...data, card_instance_id: cardInstanceId, card_id: cardId, tab_index: tabIndex };
  const response = await apiClient.createCoverTestExam(examData, examData.layout_instance_id);
  return response.data ?? null;
}

export async function getCoverTestExamById(id: number): Promise<CoverTestExam | null> {
  throw new Error('getCoverTestExamById not implemented in API yet');
}

export async function getCoverTestExamByLayoutInstanceId(layoutInstanceId: number, cardInstanceId?: string): Promise<CoverTestExam | null> {
  const response = await apiClient.getCoverTestExam(layoutInstanceId);
  return response.data ?? null;
}

export async function getAllCoverTestExamsByLayoutInstanceId(layoutInstanceId: number): Promise<CoverTestExam[] | null> {
  const response = await apiClient.getCoverTestExam(layoutInstanceId);
  const data = response.data;
  if (Array.isArray(data)) {
    return data;
  } else if (data) {
    return [data];
  }
  return null;
}

export async function updateCoverTestExam(data: CoverTestExam): Promise<CoverTestExam | null> {
  if (!data.id) {
    throw new Error('CoverTestExam ID is required for update');
  }
  const response = await apiClient.updateCoverTestExam(data.id, data);
  return response.data ?? null;
}

export async function deleteCoverTestExam(id: number): Promise<boolean> {
  const response = await apiClient.deleteExamData('cover-test', id);
  return !!response.data;
} 