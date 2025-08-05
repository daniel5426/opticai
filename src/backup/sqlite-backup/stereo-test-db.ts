import { connectionManager } from './connection-manager';
import { StereoTestExam } from './schema-interface';

export function createStereoTestExam(data: Omit<StereoTestExam, 'id'>) {
  return connectionManager.createStereoTestExam(data);
}

export function getStereoTestExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getStereoTestExamByLayoutInstanceId(layoutInstanceId);
}

export function updateStereoTestExam(data: StereoTestExam) {
  return connectionManager.updateStereoTestExam(data);
} 