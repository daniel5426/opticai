import { connectionManager } from './connection-manager';
import { RGExam } from './schema-interface';

export function createRGExam(data: Omit<RGExam, 'id'>) {
  return connectionManager.createRGExam(data);
}

export function getRGExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getRGExamByLayoutInstanceId(layoutInstanceId);
}

export function updateRGExam(data: RGExam) {
  return connectionManager.updateRGExam(data);
} 