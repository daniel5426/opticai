import { connectionManager } from './connection-manager';
import { FinalPrescriptionExam } from './schema-interface';

export function createFinalPrescriptionExam(data: Omit<FinalPrescriptionExam, 'id'>) {
  return connectionManager.createFinalPrescriptionExam(data);
}

export function getFinalPrescriptionExamById(id: number) {
  return connectionManager.getFinalPrescriptionExamById(id);
}

export function getFinalPrescriptionExamByOrderId(orderId: number) {
  return connectionManager.getFinalPrescriptionExamByOrderId(orderId);
}

export function getFinalPrescriptionExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getFinalPrescriptionExamByLayoutInstanceId(layoutInstanceId);
}

export function updateFinalPrescriptionExam(data: FinalPrescriptionExam) {
  return connectionManager.updateFinalPrescriptionExam(data);
}

export function deleteFinalPrescriptionExam(id: number) {
  return connectionManager.deleteFinalPrescriptionExam(id);
} 