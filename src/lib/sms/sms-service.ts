import { Client, Settings } from '../db/schema';

export class SmsService {
  async sendSms(phoneNumber: string, message: string): Promise<boolean> {
    try {
      console.log('SMS Service (DUMMY): Sending SMS to:', phoneNumber);
      console.log('SMS Content:', message);
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('SMS Service (DUMMY): SMS sent successfully');
      return true;
    } catch (error) {
      console.error('SMS Service (DUMMY): Error sending SMS:', error);
      return false;
    }
  }

  async sendCampaignSms(
    client: Client,
    campaign: { name: string; sms_content: string },
    settings: Settings
  ): Promise<boolean> {
    if (!client.phone_mobile) {
      console.error('Client phone number not provided');
      return false;
    }

    try {
      console.log('Generating campaign SMS content...');
      const smsContent = this.generateCampaignSmsContent(client, campaign, settings);
      
      return await this.sendSms(client.phone_mobile, smsContent);
    } catch (error) {
      console.error('Error sending campaign SMS:', error);
      return false;
    }
  }

  private generateCampaignSmsContent(
    client: Client,
    campaign: { name: string; sms_content: string },
    settings: Settings
  ): string {
    const content = campaign.sms_content
      .replace(/\{first_name\}/g, client.first_name || '')
      .replace(/\{last_name\}/g, client.last_name || '')
      .replace(/\{clinic_name\}/g, settings.clinic_name || 'מרפאת העיניים')
      .replace(/\{clinic_phone\}/g, settings.clinic_phone || '')
      .replace(/\{clinic_email\}/g, settings.clinic_email || '')
      .replace(/\{clinic_address\}/g, settings.clinic_address || '');
    
    return `שלום ${client.first_name}, ${content} - ${settings.clinic_name || 'מרפאת העיניים'}`;
  }

  async testConnection(): Promise<boolean> {
    console.log('SMS Service (DUMMY): Testing connection...');
    return true;
  }
}

export const smsService = new SmsService(); 