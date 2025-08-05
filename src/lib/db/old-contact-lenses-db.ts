import { apiClient } from '../api-client';
import { OldContactLenses } from './schema-interface';

export async function createOldContactLenses(data: Omit<OldContactLenses, 'id'>): Promise<OldContactLenses | null> {
  const response = await apiClient.createOldContactLenses(data, data.layout_instance_id);
  return response.data as OldContactLenses | null;
}

export async function getOldContactLensesById(id: number) {
  // Note: This would need a specific endpoint in the API
  throw new Error('getOldContactLensesById not implemented in API yet');
}

export async function getOldContactLensesByLayoutInstanceId(layoutInstanceId: number): Promise<OldContactLenses | null> {
  const response = await apiClient.getOldContactLenses(layoutInstanceId);
  return response.data as OldContactLenses | null;
}

export async function updateOldContactLenses(data: OldContactLenses): Promise<OldContactLenses | null> {
  if (!data.id) {
    throw new Error('OldContactLenses ID is required for update');
  }
  const response = await apiClient.updateOldContactLenses(data.id, data);
  return response.data as OldContactLenses | null;
} 