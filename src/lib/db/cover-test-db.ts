import { connectionManager } from './connection-manager';
import { CoverTestExam } from './schema';

export function createCoverTestExam(data: Omit<CoverTestExam, 'id'>, cardInstanceId?: string, cardId?: string, tabIndex?: number) {
  return connectionManager.createCoverTestExam({ ...data, card_instance_id: cardInstanceId, card_id: cardId, tab_index: tabIndex });
}

export function getCoverTestExamById(id: number) {
  return connectionManager.getCoverTestExamById(id);
}

export function getCoverTestExamByLayoutInstanceId(layoutInstanceId: number, cardInstanceId?: string, cardId?: string) {
  return connectionManager.getCoverTestExamByLayoutInstanceId(layoutInstanceId, cardInstanceId, cardId);
}

export function getAllCoverTestExamsByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getAllCoverTestExamsByLayoutInstanceId(layoutInstanceId);
}

export function updateCoverTestExam(data: CoverTestExam) {
  return connectionManager.updateCoverTestExam(data);
}

export function deleteCoverTestExam(id: number) {
  return connectionManager.deleteCoverTestExam(id);
} 