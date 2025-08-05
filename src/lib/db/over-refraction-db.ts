import { apiClient } from '../api-client';
import { OverRefraction } from './schema-interface';

export async function createOverRefraction(data: Omit<OverRefraction, 'id'>): Promise<OverRefraction | null> {
  const response = await apiClient.createOverRefraction(data, data.layout_instance_id);
  return response.data as OverRefraction | null;
}

export async function getOverRefraction(id: number) {
  // Note: This would need a specific endpoint in the API
  throw new Error('getOverRefraction not implemented in API yet');
}

export async function getOverRefractionByLayoutInstanceId(layout_instance_id: number): Promise<OverRefraction | null> {
  const response = await apiClient.getOverRefraction(layout_instance_id);
  return response.data as OverRefraction | null;
}

export async function updateOverRefraction(data: OverRefraction): Promise<OverRefraction | null> {
  if (!data.id) {
    throw new Error('OverRefraction ID is required for update');
  }
  const response = await apiClient.updateOverRefraction(data.id, data);
  return response.data as OverRefraction | null;
}

export async function deleteOverRefraction(id: number) {
  const response = await apiClient.deleteExamData('over-refraction', id);
  return response.data;
} 