import { apiClient } from '../api-client';
import { ContactLensDiameters } from './schema-interface';

export async function createContactLensDiameters(data: Omit<ContactLensDiameters, 'id'>): Promise<ContactLensDiameters | null> {
  const response = await apiClient.createContactLensDiameters(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getContactLensDiametersByLayoutInstanceId(layoutInstanceId: number): Promise<ContactLensDiameters | null> {
  const response = await apiClient.getContactLensDiameters(layoutInstanceId);
  return response.data ?? null;
}

export async function updateContactLensDiameters(exam: ContactLensDiameters): Promise<ContactLensDiameters | null> {
  if (!exam.id) {
    throw new Error('ContactLensDiameters ID is required for update');
  }
  const response = await apiClient.updateContactLensDiameters(exam.id, exam);
  return response.data ?? null;
} 