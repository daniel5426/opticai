import { connectionManager } from './connection-manager';
import { OldContactLenses } from './schema';

export function createOldContactLenses(data: Omit<OldContactLenses, 'id'>) {
  return connectionManager.createOldContactLenses(data);
}

export function getOldContactLensesById(id: number) {
  return connectionManager.getOldContactLensesById(id);
}

export function getOldContactLensesByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getOldContactLensesByLayoutInstanceId(layoutInstanceId);
}

export function updateOldContactLenses(data: OldContactLenses) {
  return connectionManager.updateOldContactLenses(data);
} 