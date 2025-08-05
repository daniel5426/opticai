import { connectionManager } from './connection-manager';
import { CompactPrescriptionExam } from './schema-interface';

export function createCompactPrescriptionExam(data: Omit<CompactPrescriptionExam, 'id'>) {
  return connectionManager.createCompactPrescriptionExam(data);
}

export function getCompactPrescriptionExamById(id: number) {
  return connectionManager.getCompactPrescriptionExamById(id);
}

export function getCompactPrescriptionExamByReferralId(referralId: number) {
  return connectionManager.getCompactPrescriptionExamByReferralId(referralId);
}

export function getCompactPrescriptionExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getCompactPrescriptionExamByLayoutInstanceId(layoutInstanceId);
}

export function updateCompactPrescriptionExam(data: CompactPrescriptionExam) {
  return connectionManager.updateCompactPrescriptionExam(data);
}

export function deleteCompactPrescriptionExam(id: number) {
  return connectionManager.deleteCompactPrescriptionExam(id);
} 