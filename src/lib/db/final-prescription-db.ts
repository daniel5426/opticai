import { apiClient } from '../api-client';
import { FinalPrescriptionExam } from './schema-interface';

export async function createFinalPrescriptionExam(data: Omit<FinalPrescriptionExam, 'id'>): Promise<FinalPrescriptionExam | null> {
  const response = await apiClient.createFinalPrescriptionExam(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getFinalPrescriptionExamById(id: number) {
  // Note: This would need a specific endpoint in the API
  throw new Error('getFinalPrescriptionExamById not implemented in API yet');
}

export async function getFinalPrescriptionExamByOrderId(orderId: number) {
  // Note: This would need a specific endpoint in the API
  throw new Error('getFinalPrescriptionExamByOrderId not implemented in API yet');
}

export async function getFinalPrescriptionExamByLayoutInstanceId(layoutInstanceId: number): Promise<FinalPrescriptionExam | null> {
  const response = await apiClient.getFinalPrescriptionExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateFinalPrescriptionExam(exam: FinalPrescriptionExam): Promise<FinalPrescriptionExam | null> {
  if (!exam.id) {
    throw new Error('FinalPrescriptionExam ID is required for update');
  }
  const response = await apiClient.updateFinalPrescriptionExam(exam.id, exam);
  return response.data ?? null;
}

export async function deleteFinalPrescriptionExam(id: number) {
  const response = await apiClient.deleteExamData('final-prescription', id);
  return response.data;
} 