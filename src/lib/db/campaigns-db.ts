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

export function getCampaignClientExecution(campaignId: number, clientId: number) {
  return connectionManager.getCampaignClientExecution(campaignId, clientId);
}
export function addCampaignClientExecution(campaignId: number, clientId: number) {
  return connectionManager.addCampaignClientExecution(campaignId, clientId);
}
export function deleteCampaignClientExecutionsForCampaign(campaignId: number) {
  return connectionManager.deleteCampaignClientExecutionsForCampaign(campaignId);
} 