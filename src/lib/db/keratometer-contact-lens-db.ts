import { apiClient } from '../api-client';
import { KeratometerContactLens } from './schema-interface';

export async function createKeratometerContactLens(data: Omit<KeratometerContactLens, 'id'>): Promise<KeratometerContactLens | null> {
  const response = await apiClient.createKeratometerContactLens(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getKeratometerContactLensByLayoutInstanceId(layoutInstanceId: number): Promise<KeratometerContactLens | null> {
  const response = await apiClient.getKeratometerContactLens(layoutInstanceId);
  return response.data ?? null;
}

export async function updateKeratometerContactLens(exam: KeratometerContactLens): Promise<KeratometerContactLens | null> {
  if (!exam.id) {
    throw new Error('KeratometerContactLens ID is required for update');
  }
  const response = await apiClient.updateKeratometerContactLens(exam.id, exam);
  return response.data ?? null;
} 