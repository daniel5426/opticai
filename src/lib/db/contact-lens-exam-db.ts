import { apiClient } from '../api-client';
import { ContactLensExam } from './schema-interface';

export async function createContactLensExam(data: Omit<ContactLensExam, 'id'>): Promise<ContactLensExam | null> {
  const response = await apiClient.createContactLensExam(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getContactLensExamByLayoutInstanceId(layoutInstanceId: number): Promise<ContactLensExam | null> {
  const response = await apiClient.getContactLensExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateContactLensExam(exam: ContactLensExam): Promise<ContactLensExam | null> {
  if (!exam.id) {
    throw new Error('ContactLensExam ID is required for update');
  }
  const response = await apiClient.updateContactLensExam(exam.id, exam);
  return response.data ?? null;
} 