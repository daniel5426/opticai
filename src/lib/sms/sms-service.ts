/** Retired desktop transport. Campaign SMS is sent exclusively by the API adapter. */
export class SmsService {
  async sendSms(_phoneNumber: string, _message: string): Promise<boolean> { return false; }
  async sendCampaignSms(_client: unknown, _campaign: unknown, _settings: unknown): Promise<boolean> { return false; }
  async testConnection(): Promise<boolean> { return false; }
}
export const smsService = new SmsService();
