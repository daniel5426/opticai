import { connectionManager } from './connection-manager';
import { OverRefraction } from './schema';

export function createOverRefraction(data: Omit<OverRefraction, 'id'>) {
  return connectionManager.createOverRefraction(data);
}

export function getOverRefraction(id: number) {
  return connectionManager.getOverRefraction(id);
}

export function getOverRefractionByLayoutInstanceId(layout_instance_id: number) {
  return connectionManager.getOverRefractionByLayoutInstanceId(layout_instance_id);
}

export function updateOverRefraction(data: OverRefraction) {
  return connectionManager.updateOverRefraction(data);
}

export function deleteOverRefraction(id: number) {
  return connectionManager.deleteOverRefraction(id);
} 