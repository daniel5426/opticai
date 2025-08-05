import { connectionManager } from './connection-manager';
import { AnamnesisExam } from './schema-interface';

export function createAnamnesisExam(data: Omit<AnamnesisExam, 'id'>) {
  return connectionManager.createAnamnesisExam(data);
}

export function getAnamnesisExamById(id: number) {
  return connectionManager.getAnamnesisExamById(id);
}

export function getAnamnesisExamByLayoutInstanceId(layout_instance_id: number) {
  return connectionManager.getAnamnesisExamByLayoutInstanceId(layout_instance_id);
}

export function updateAnamnesisExam(data: AnamnesisExam) {
  return connectionManager.updateAnamnesisExam(data);
}

export function deleteAnamnesisExam(id: number) {
  return connectionManager.deleteAnamnesisExam(id);
} 