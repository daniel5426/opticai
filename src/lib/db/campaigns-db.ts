import { connectionManager } from './connection-manager';
import { Campaign } from './schema';

export function createCampaign(data: Omit<Campaign, 'id'>) {
  return connectionManager.createCampaign(data);
}

export function getCampaignById(id: number) {
  return connectionManager.getCampaignById(id);
}

export function getAllCampaigns() {
  return connectionManager.getAllCampaigns();
}

export function updateCampaign(campaign: Campaign) {
  return connectionManager.updateCampaign(campaign);
}

export function deleteCampaign(id: number) {
  return connectionManager.deleteCampaign(id);
} 