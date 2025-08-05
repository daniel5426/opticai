import { apiClient } from '../api-client';
import { DiopterAdjustmentPanel } from './schema-interface';

export async function createDiopterAdjustmentPanel(data: Omit<DiopterAdjustmentPanel, 'id'>): Promise<DiopterAdjustmentPanel | null> {
  const response = await apiClient.createDiopterAdjustmentPanel(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getDiopterAdjustmentPanelByLayoutInstanceId(layoutInstanceId: number): Promise<DiopterAdjustmentPanel | null> {
  const response = await apiClient.getDiopterAdjustmentPanel(layoutInstanceId);
  return response.data ?? null;
}

export async function updateDiopterAdjustmentPanel(exam: DiopterAdjustmentPanel): Promise<DiopterAdjustmentPanel | null> {
  if (!exam.id) {
    throw new Error('DiopterAdjustmentPanel ID is required for update');
  }
  const response = await apiClient.updateDiopterAdjustmentPanel(exam.id, exam);
  return response.data ?? null;
} 