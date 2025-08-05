import { apiClient } from '../api-client';
import { ContactLensOrder } from './schema-interface';

export async function createContactLensOrder(data: Omit<ContactLensOrder, 'id'>): Promise<ContactLensOrder | null> {
  const response = await apiClient.createContactLensOrder(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getContactLensOrderByLayoutInstanceId(layoutInstanceId: number): Promise<ContactLensOrder | null> {
  const response = await apiClient.getContactLensOrder(layoutInstanceId);
  return response.data ?? null;
}

export async function updateContactLensOrder(exam: ContactLensOrder): Promise<ContactLensOrder | null> {
  if (!exam.id) {
    throw new Error('ContactLensOrder ID is required for update');
  }
  const response = await apiClient.updateContactLensOrder(exam.id, exam);
  return response.data ?? null;
} 