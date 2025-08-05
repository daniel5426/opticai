import { connectionManager } from './connection-manager';
import { MaddoxRodExam } from './schema-interface';

export function createMaddoxRodExam(data: Omit<MaddoxRodExam, 'id'>) {
  return connectionManager.createMaddoxRodExam(data);
}

export function getMaddoxRodExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getMaddoxRodExamByLayoutInstanceId(layoutInstanceId);
}

export function updateMaddoxRodExam(data: MaddoxRodExam) {
  return connectionManager.updateMaddoxRodExam(data);
} 