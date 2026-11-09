/** Compatibility surface only. Durable campaign scheduling is owned by the API. */
export class CampaignScheduler {
  getStatus() { return { isRunning: false, nextRun: null }; }
  restart() {}
  stop() {}
  async executeTestCampaign(_campaignId: number) { return {success:false,message:'campaign_upgrade_required'}; }
  async executeFullCampaign(_campaignId: number) { return {success:false,message:'campaign_upgrade_required'}; }
}
export const campaignScheduler = new CampaignScheduler();
