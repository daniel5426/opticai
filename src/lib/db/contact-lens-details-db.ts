import { apiClient } from '../api-client';
import { ContactLensDetails } from './schema-interface';

export async function createContactLensDetails(data: Omit<ContactLensDetails, 'id'>): Promise<ContactLensDetails | null> {
  const response = await apiClient.createContactLensDetails(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getContactLensDetailsByLayoutInstanceId(layoutInstanceId: number): Promise<ContactLensDetails | null> {
  const response = await apiClient.getContactLensDetails(layoutInstanceId);
  return response.data ?? null;
}

export async function updateContactLensDetails(exam: ContactLensDetails): Promise<ContactLensDetails | null> {
  if (!exam.id) {
    throw new Error('ContactLensDetails ID is required for update');
  }
  const response = await apiClient.updateContactLensDetails(exam.id, exam);
  return response.data ?? null;
} 