import { apiClient } from '../api-client';
import { CompactPrescriptionExam } from './schema-interface';

export async function createCompactPrescriptionExam(data: Omit<CompactPrescriptionExam, 'id'>): Promise<CompactPrescriptionExam | null> {
  const response = await apiClient.createCompactPrescriptionExam(data, data.layout_instance_id!);
  return response.data ?? null;
}

export async function getCompactPrescriptionExamById(id: number) {
  // Note: This would need a specific endpoint in the API
  throw new Error('getCompactPrescriptionExamById not implemented in API yet');
}

export async function getCompactPrescriptionExamByReferralId(referralId: number) {
  // Note: This would need a specific endpoint in the API
  throw new Error('getCompactPrescriptionExamByReferralId not implemented in API yet');
}

export async function getCompactPrescriptionExamByLayoutInstanceId(layoutInstanceId: number): Promise<CompactPrescriptionExam | null> {
  const response = await apiClient.getCompactPrescriptionExam(layoutInstanceId);
  return response.data ?? null;
}

export async function updateCompactPrescriptionExam(exam: CompactPrescriptionExam): Promise<CompactPrescriptionExam | null> {
  if (!exam.id) {
    throw new Error('CompactPrescriptionExam ID is required for update');
  }
  const response = await apiClient.updateCompactPrescriptionExam(exam.id, exam);
  return response.data ?? null;
}

export async function deleteCompactPrescriptionExam(id: number) {
  const response = await apiClient.deleteExamData('compact-prescription', id);
  return response.data;
} 