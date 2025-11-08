import * as cron from 'node-cron';
import { campaignService } from './campaign-service';
import { emailService } from './email/email-service';
import { smsService } from './sms/sms-service';
import { Campaign, Client } from './db/schema-interface';
import { addCampaignClientExecution } from './db/campaigns-db';
import { apiClient } from './api-client';

export class CampaignScheduler {
  private scheduledJob: cron.ScheduledTask | null = null;
  private isSchedulerRunning = false;

  constructor() {
    this.startScheduler();
  }

  private startScheduler() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
    }

    this.scheduledJob = cron.schedule('0 10 * * *', async () => {
      if (this.isSchedulerRunning) {
        console.log('Campaign scheduler already running, skipping...');
        return;
      }

      this.isSchedulerRunning = true;
      try {
        await this.executeActiveCampaigns();
      } catch (error) {
        console.error('Error in campaign scheduler:', error);
      } finally {
        this.isSchedulerRunning = false;
      }
    });

    this.scheduledJob.start();

    console.log('Campaign scheduler started - running daily at 10:00 AM');
  }

  private async executeActiveCampaigns() {
    try {
      console.log('Checking for active campaigns to execute...');
      
      const allCampaignsResponse = await apiClient.getAllCampaigns();
      const allCampaigns = allCampaignsResponse.data || [];
      const activeCampaigns = allCampaigns.filter(campaign =>
        campaign.active && (campaign.email_enabled || campaign.sms_enabled)
      );

      console.log(`Found ${activeCampaigns.length} active campaigns`);

      for (const campaign of activeCampaigns) {
        try {
          if (this.shouldExecuteCampaign(campaign)) {
            console.log(`Campaign ${campaign.id} (${campaign.name}) is due for execution`);
            await this.executeCampaign(campaign);
          } else {
            console.log(`Campaign ${campaign.id} (${campaign.name}) is not due for execution yet`);
          }
        } catch (error) {
          console.error(`Error executing campaign ${campaign.id}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in executeActiveCampaigns:', error);
    }
  }

  private shouldExecuteCampaign(campaign: Campaign): boolean {
    const now = new Date();
    const cycleType = campaign.cycle_type || 'daily';
    const lastExecuted = campaign.last_executed ? new Date(campaign.last_executed) : null;

    // If never executed, execute now
    if (!lastExecuted) {
      return true;
    }

    switch (cycleType) {
      case 'daily':
        // Execute if last execution was on a different day
        const lastExecutedDate = new Date(lastExecuted.getFullYear(), lastExecuted.getMonth(), lastExecuted.getDate());
        const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return todayDate.getTime() > lastExecutedDate.getTime();

      case 'monthly':
        // Execute if it's been at least a month since last execution
        const monthsDiff = (now.getFullYear() - lastExecuted.getFullYear()) * 12 +
                          (now.getMonth() - lastExecuted.getMonth());
        return monthsDiff >= 1;

      case 'yearly':
        // Execute if it's been at least a year since last execution
        const yearsDiff = now.getFullYear() - lastExecuted.getFullYear();
        return yearsDiff >= 1;

      case 'custom':
        // Execute if it's been at least the custom number of days since last execution
        const customDays = campaign.cycle_custom_days || 1;
        const daysDiff = Math.floor((now.getTime() - lastExecuted.getTime()) / (1000 * 60 * 60 * 24));
        return daysDiff >= customDays;

      default:
        // Default to daily if cycle type is unknown
        return true;
    }
  }

  private async executeCampaign(campaign: Campaign) {
    try {
      console.log(`Executing campaign: ${campaign.name} (ID: ${campaign.id})`);
      
      const validation = await campaignService.validateCampaignForExecution(campaign);
      if (!validation.valid) {
        console.log(`Campaign ${campaign.id} validation failed:`, validation.errors);
        return;
      }

      const targetClients = await campaignService.getFilteredClients(campaign);
      console.log(`Found ${targetClients.length} target clients for campaign ${campaign.id}`);

      const settingsResponse = await apiClient.getSettings(campaign.clinic_id);
      const settings = settingsResponse.data;
      if (!settings) {
        console.error('Settings not found, cannot send emails');
        return;
      }

      let emailsSent = 0;
      let smsSent = 0;
      let emailErrors = 0;
      let smsErrors = 0;

      for (const client of targetClients) {
        try {
          if (campaign.email_enabled && client.email && client.email.trim() !== '') {
            await emailService.loadConfigFromSettings(campaign.clinic_id);
            const emailResult = await emailService.sendCampaignEmail(
              client,
              { name: campaign.name, email_content: campaign.email_content },
              settings
            );
            if (emailResult) {
              emailsSent++;
            } else {
              emailErrors++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          if (campaign.sms_enabled && client.phone_mobile && client.phone_mobile.trim() !== '') {
            const smsResult = await smsService.sendCampaignSms(
              client,
              { name: campaign.name, sms_content: campaign.sms_content },
              settings
            );
            if (smsResult) {
              smsSent++;
            } else {
              smsErrors++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Error sending campaign to client ${client.id}:`, error);
        }
      }

      const updatedCampaign = {
        ...campaign,
        mail_sent: campaign.email_enabled && emailsSent > 0,
        sms_sent: campaign.sms_enabled && smsSent > 0,
        emails_sent_count: (campaign.emails_sent_count || 0) + emailsSent,
        sms_sent_count: (campaign.sms_sent_count || 0) + smsSent,
        last_executed: new Date().toISOString(),
      };

      apiClient.updateCampaign(updatedCampaign.id!, updatedCampaign);

      console.log(`Campaign ${campaign.id} execution completed:`);
      console.log(`  - Emails sent: ${emailsSent} (errors: ${emailErrors})`);
      console.log(`  - SMS sent: ${smsSent} (errors: ${smsErrors})`);
      console.log(`  - Total target clients: ${targetClients.length}`);

      this.logCampaignExecution(campaign.id!, targetClients.length, emailsSent, smsSent, emailErrors, smsErrors);

      for (const client of targetClients) {
        if (campaign.execute_once_per_client) {
          addCampaignClientExecution(campaign.id!, client.id!);
        }
      }

    } catch (error) {
      console.error(`Error executing campaign ${campaign.id}:`, error);
    }
  }

  private logCampaignExecution(
    campaignId: number,
    targetCount: number,
    emailsSent: number,
    smsSent: number,
    emailErrors: number,
    smsErrors: number
  ) {
    try {
      const logEntry = {
        campaign_id: campaignId,
        execution_date: new Date().toISOString(),
        target_count: targetCount,
        emails_sent: emailsSent,
        sms_sent: smsSent,
        email_errors: emailErrors,
        sms_errors: smsErrors,
        success: (emailErrors === 0 && smsErrors === 0) || (emailsSent > 0 || smsSent > 0)
      };

      console.log(`Campaign execution log: ${JSON.stringify(logEntry)}`);
      
    } catch (error) {
      console.error('Error logging campaign execution:', error);
    }
  }

  public async executeTestCampaign(campaignId: number): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      const campaignResponse = await apiClient.getCampaignById(campaignId);
      const campaign = campaignResponse.data;
      if (!campaign) {
        return { success: false, message: 'Campaign not found' };
      }

      if (!campaign.active) {
        return { success: false, message: 'Campaign is not active' };
      }

      const validation = await campaignService.validateCampaignForExecution(campaign);
      if (!validation.valid) {
        console.log('Campaign validation failed:', validation.errors);
        return { 
          success: false, 
          message: 'Campaign validation failed', 
          details: validation.errors 
        };
      }

      const targetClients = await campaignService.getFilteredClients(campaign);
      const limitedClients = targetClients.slice(0, 3);

      const settingsResponse = await apiClient.getSettings(campaign.clinic_id);
      const settings = settingsResponse.data;
      if (!settings) {
        return { success: false, message: 'Settings not found' };
      }

      let emailsSent = 0;
      let smsSent = 0;

      for (const client of limitedClients) {
        try {
          if (campaign.email_enabled && client.email && client.email.trim() !== '') {
            await emailService.loadConfigFromSettings(campaign.clinic_id);
            const emailResult = await emailService.sendCampaignEmail(
              client,
              { name: `[TEST] ${campaign.name}`, email_content: campaign.email_content },
              settings
            );
            if (emailResult) emailsSent++;
          }

          if (campaign.sms_enabled && client.phone_mobile && client.phone_mobile.trim() !== '') {
            const smsResult = await smsService.sendCampaignSms(
              client,
              { name: `[TEST] ${campaign.name}`, sms_content: campaign.sms_content },
              settings
            );
            if (smsResult) smsSent++;
          }
        } catch (error) {
          console.error(`Error sending test campaign to client ${client.id}:`, error);
        }
      }

      return {
        success: true,
        message: `Test campaign sent to ${limitedClients.length} clients`,
        details: {
          targetClients: limitedClients.length,
          totalTarget: targetClients.length,
          emailsSent,
          smsSent
        }
      };

    } catch (error) {
      console.error('Error executing test campaign:', error);
      return { 
        success: false, 
        message: 'Error executing test campaign', 
        details: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  public async executeFullCampaign(campaignId: number): Promise<{
    success: boolean;
    message: string;
    details?: any;
  }> {
    try {
      console.log(`Executing full campaign ${campaignId}...`);
      
      const campaignResponse = await apiClient.getCampaignById(campaignId);
      const campaign = campaignResponse.data;
      if (!campaign) {
        console.log('Campaign not found');
        return { success: false, message: 'Campaign not found' };
      }

      if (!campaign.active) {
        console.log('Campaign is not active');
        return { success: false, message: 'Campaign is not active' };
      }

      console.log('Validating campaign...');
      const validation = await campaignService.validateCampaignForExecution(campaign);
      console.log('Validation result:', validation);
      
      if (!validation.valid) {
        console.log('Campaign validation failed:', validation.errors);
        return { 
          success: false, 
          message: 'Campaign validation failed', 
          details: validation.errors 
        };
      }

      const targetClients = await campaignService.getFilteredClients(campaign);
      const settingsResponse = await apiClient.getSettings(campaign.clinic_id);
      const settings = settingsResponse.data;
      if (!settings) {
        return { success: false, message: 'Settings not found' };
      }

      let emailsSent = 0;
      let smsSent = 0;
      let emailErrors = 0;
      let smsErrors = 0;

      for (const client of targetClients) {
        try {
          if (campaign.email_enabled && client.email && client.email.trim() !== '') {
            await emailService.loadConfigFromSettings(campaign.clinic_id);
            const emailResult = await emailService.sendCampaignEmail(
              client,
              { name: campaign.name, email_content: campaign.email_content },
              settings
            );
            if (emailResult) {
              emailsSent++;
            } else {
              emailErrors++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
          }

          if (campaign.sms_enabled && client.phone_mobile && client.phone_mobile.trim() !== '') {
            const smsResult = await smsService.sendCampaignSms(
              client,
              { name: campaign.name, sms_content: campaign.sms_content },
              settings
            );
            if (smsResult) {
              smsSent++;
            } else {
              smsErrors++;
            }
            
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (error) {
          console.error(`Error sending campaign to client ${client.id}:`, error);
          if (campaign.email_enabled && client.email) emailErrors++;
          if (campaign.sms_enabled && client.phone_mobile) smsErrors++;
        }
      }

      const updatedCampaign = {
        ...campaign,
        mail_sent: campaign.email_enabled && emailsSent > 0,
        sms_sent: campaign.sms_enabled && smsSent > 0,
        emails_sent_count: (campaign.emails_sent_count || 0) + emailsSent,
        sms_sent_count: (campaign.sms_sent_count || 0) + smsSent,
        last_executed: new Date().toISOString(),
      };

      apiClient.updateCampaign(updatedCampaign.id!, updatedCampaign);
      
      this.logCampaignExecution(campaign.id!, targetClients.length, emailsSent, smsSent, emailErrors, smsErrors);

      for (const client of targetClients) {
        if (campaign.execute_once_per_client) {
          addCampaignClientExecution(campaign.id!, client.id!);
        }
      }

      return {
        success: true,
        message: `Campaign executed successfully. Sent to ${targetClients.length} clients`,
        details: {
          targetClients: targetClients.length,
          emailsSent,
          smsSent,
          emailErrors,
          smsErrors
        }
      };

    } catch (error) {
      console.error('Error executing full campaign:', error);
      return { 
        success: false, 
        message: 'Error executing campaign', 
        details: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  public getStatus(): { isRunning: boolean; nextRun: string | null } {
    return {
      isRunning: this.isSchedulerRunning,
      nextRun: this.scheduledJob ? 'Daily at 10:00 AM' : null
    };
  }

  public restart() {
    console.log('Restarting campaign scheduler...');
    this.startScheduler();
  }

  public stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
    }
    console.log('Campaign scheduler stopped');
  }
}

export const campaignScheduler = new CampaignScheduler(); 