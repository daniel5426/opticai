  import { connectionManager } from './connection-manager';
  import { SchirmerTestExam } from './schema-interface';

export function createSchirmerTestExam(data: Omit<SchirmerTestExam, 'id'>) {
  return connectionManager.createSchirmerTestExam(data);
}

export function getSchirmerTestExamById(id: number) {
  return connectionManager.getSchirmerTestExamById(id);
}

export function getSchirmerTestExamByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getSchirmerTestExamByLayoutInstanceId(layoutInstanceId);
}

export function updateSchirmerTestExam(data: SchirmerTestExam) {
  return connectionManager.updateSchirmerTestExam(data);
} 