import { connectionManager } from './connection-manager';
import { OldRefExam } from './schema-interface';

export function createOldRefExam(data: Omit<OldRefExam, 'id'>) {
  return connectionManager.createOldRefExam(data);
}

export function getOldRefExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getOldRefExamByLayoutInstanceId(layoutInstanceId);
}

export function updateOldRefExam(exam: OldRefExam) {
  return connectionManager.updateOldRefExam(exam);
} 