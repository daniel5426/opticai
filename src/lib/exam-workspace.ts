import type { OpticalExam } from './db/schema-interface';
import { apiClient } from './api-client';

export interface ExamWorkspaceInstance {
  instance: { id: number; layout_id: number | null; layout_data?: string | null; order: number; is_active: boolean };
  exam_data: Record<string, any>;
}
export interface ExamWorkspaceResponse {
  exam: OpticalExam;
  instances: ExamWorkspaceInstance[];
  removed_instance_ids: number[];
  client_keys: Record<string, number>;
  save_token: string;
}
export interface ExamWorkspacePayload {
  exam: Partial<OpticalExam>;
  save_token?: string;
  instances: Array<{ id?: number; client_key: string; layout_id?: number; layout_data?: string; exam_data: Record<string, any> }>;
  removed_instance_ids: number[];
  instance_order?: string[];
  active_client_key?: string;
}
export const stableSaveJson = (value: unknown): string => JSON.stringify(value, (_key, item) =>
  item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);

export async function saveExamWorkspace(id: number | undefined, payload: ExamWorkspacePayload, creationKey: string) {
  const response = await apiClient.saveExamWorkspace(id, payload, creationKey);
  if (response.error || !response.data) {
    const error = new Error(response.error || 'save_failed') as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return response.data as unknown as ExamWorkspaceResponse;
}
