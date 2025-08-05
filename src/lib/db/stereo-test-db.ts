import { apiClient } from '../api-client';
import { StereoTestExam } from './schema-interface';

export async function createStereoTestExam(data: Omit<StereoTestExam, 'id'>): Promise<StereoTestExam | null> {
  const response = await apiClient.createStereoTestExam(data, data.layout_instance_id);
  return response.data as StereoTestExam | null;
}

export async function getStereoTestExamByLayoutInstanceId(layoutInstanceId: number): Promise<StereoTestExam | null> {
  const response = await apiClient.getStereoTestExam(layoutInstanceId);
  return response.data as StereoTestExam | null;
}

export async function updateStereoTestExam(data: StereoTestExam): Promise<StereoTestExam | null> {
  if (!data.id) {
    throw new Error('StereoTestExam ID is required for update');
  }
  const response = await apiClient.updateStereoTestExam(data.id, data);
  return response.data as StereoTestExam | null;
} 