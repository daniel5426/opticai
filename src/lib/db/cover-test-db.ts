import { connectionManager } from './connection-manager';
import { CoverTestExam } from './schema';

export function createCoverTestExam(data: Omit<CoverTestExam, 'id'>) {
  return connectionManager.createCoverTestExam(data);
}

export function getCoverTestExamById(id: number) {
  return connectionManager.getCoverTestExamById(id);
}

export function getCoverTestExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getCoverTestExamByLayoutInstanceId(layoutInstanceId);
}

export function updateCoverTestExam(data: CoverTestExam) {
  return connectionManager.updateCoverTestExam(data);
} 