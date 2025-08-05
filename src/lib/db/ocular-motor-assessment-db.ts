import { apiClient } from '../api-client';
import { OcularMotorAssessmentExam } from './schema-interface';

export async function createOcularMotorAssessmentExam(data: Omit<OcularMotorAssessmentExam, 'id'>): Promise<OcularMotorAssessmentExam | null> {
  const response = await apiClient.createOcularMotorAssessmentExam(data, data.layout_instance_id);
  return response.data as OcularMotorAssessmentExam | null;
}

export async function getOcularMotorAssessmentExamByLayoutInstanceId(layoutInstanceId: number): Promise<OcularMotorAssessmentExam | null> {
  const response = await apiClient.getOcularMotorAssessmentExam(layoutInstanceId);
  return response.data as OcularMotorAssessmentExam | null;
}

export async function updateOcularMotorAssessmentExam(data: OcularMotorAssessmentExam): Promise<OcularMotorAssessmentExam | null> {
  if (!data.id) {
    throw new Error('OcularMotorAssessmentExam ID is required for update');
  }
  const response = await apiClient.updateOcularMotorAssessmentExam(data.id, data);
  return response.data as OcularMotorAssessmentExam | null;
} 