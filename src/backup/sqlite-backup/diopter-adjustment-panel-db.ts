import { connectionManager } from './connection-manager';
import { DiopterAdjustmentPanel } from './schema-interface';

export function createDiopterAdjustmentPanel(data: Omit<DiopterAdjustmentPanel, 'id'>) {
  return connectionManager.createDiopterAdjustmentPanel(data);
}

export function getDiopterAdjustmentPanelByLayoutInstanceId(layoutInstanceId: number) {
  return connectionManager.getDiopterAdjustmentPanelByLayoutInstanceId(layoutInstanceId);
}

export function updateDiopterAdjustmentPanel(data: DiopterAdjustmentPanel) {
  return connectionManager.updateDiopterAdjustmentPanel(data);
} 