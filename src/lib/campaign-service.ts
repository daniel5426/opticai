/** Retained for older desktop IPC callers; audience authority now belongs to the API. */
import type { Campaign, Client } from './db/schema-interface';
export interface FilterCondition { id:string; field:string; operator:string; value:string; logic?:'AND'|'OR'; }
export class CampaignService {
  async getFilteredClients(_campaign:Campaign):Promise<Client[]> { return []; }
  async getTargetClientsForCampaign(_campaignId:number):Promise<Client[]> { return []; }
  async validateCampaignForExecution(_campaign:Campaign) { return {valid:false,errors:['campaign_upgrade_required'],targetCount:0}; }
}
export const campaignService = new CampaignService();
