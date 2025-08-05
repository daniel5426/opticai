import { apiClient } from '../api-client';
import { Campaign } from './schema-interface';

export async function createCampaign(data: Omit<Campaign, 'id'>) {
  const response = await apiClient.createCampaign(data);
  return response.data;
}

export async function getCampaignById(id: number) {
  const response = await apiClient.getCampaignById(id);
  return response.data;
}

export async function getAllCampaigns(clinicId?: number) {
  const response = await apiClient.getAllCampaigns();
  return response.data;
}

export async function updateCampaign(campaign: Campaign) {
  if (!campaign.id) {
    throw new Error('Campaign ID is required for update');
  }
  const response = await apiClient.updateCampaign(campaign.id, campaign);
  return response.data;
}

export async function deleteCampaign(id: number) {
  const response = await apiClient.deleteCampaign(id);
  return response.data;
}

export async function getCampaignClientExecution(campaignId: number, clientId: number) {
  const response = await apiClient.getCampaignClientExecution(campaignId, clientId);
  return response.data;
}

export async function addCampaignClientExecution(campaignId: number, clientId: number) {
  const response = await apiClient.addCampaignClientExecution(campaignId, clientId);
  return response.data;
}

export async function deleteCampaignClientExecutionsForCampaign(campaignId: number) {
  const response = await apiClient.deleteCampaignClientExecutions(campaignId);
  return response.data;
} 