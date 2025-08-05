import nodemailer from 'nodemailer';
import { Settings, Appointment, Client } from '../db/schema-interface';
import { getEmailProviderConfig } from './email-providers';
import { apiClient } from '../api-client';
//vpkm ywaf vveo juyk
export interface EmailConfig {
  service?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  requireTLS?: boolean;
  tls?: {
    ciphers?: string;
    rejectUnauthorized?: boolean;
    minVersion?: string;
    maxVersion?: string;
  };
  auth?: {
    user: string;
    pass: string;
  };
}

export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private config: EmailConfig | null = null;

  constructor() {
    this.initializeTransporter().catch(error => {
      console.error('Failed to initialize email service:', error);
    });
  }

  async initializeTransporter() {
    try {
      await this.loadConfigFromSettings();
    } catch (error) {
      console.error('Error initializing email transporter:', error);
    }
  }

  async loadConfigFromSettings() {
    try {
      const settingsResponse = await apiClient.getSettings();
      const settings = settingsResponse.data;
      
      if (!settings || !settings.email_username || !settings.email_password) {
        console.warn('Email settings not configured');
        this.transporter = null;
        return;
      }

      const providerConfig = getEmailProviderConfig(settings.email_provider || 'gmail');
      
      this.config = {
        host: settings.email_smtp_host || providerConfig?.host,
        port: settings.email_smtp_port || providerConfig?.port || 587,
        secure: settings.email_smtp_port === 465 ? true : false,
        tls: {
          rejectUnauthorized: false
        },
        auth: {
          user: settings.email_username,
          pass: settings.email_password
        }
      };

      this.transporter = nodemailer.createTransport(this.config as any);
      console.log('Email service initialized from settings');
    } catch (error) {
      console.error('Error loading email config from settings:', error);
      this.transporter = null;
    }
  }

  async updateConfig(config: EmailConfig) {
    this.config = {
      ...config,
      secure: config.port === 465 ? true : false,
      tls: {
        rejectUnauthorized: false
      }
    };
    if (config.auth?.user && config.auth?.pass) {
      this.transporter = nodemailer.createTransport(this.config as any);
    } else {
      this.transporter = null;
    }
  }

  async updateFromSettings() {
    await this.loadConfigFromSettings();
  }

  async testConnection(): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Email connection test failed:', error);
      return false;
    }
  }

  async sendAppointmentReminder(
    appointment: Appointment,
    client: Client,
    settings: Settings
  ): Promise<boolean> {
    if (!this.transporter) {
      console.error('Email transporter not initialized');
      return false;
    }

    if (!client.email) {
      console.error('Client email not provided');
      return false;
    }

    try {
      console.log('Generating email content...');
      const emailHtml = this.generateReminderEmailHtml(appointment, client, settings);
      const emailText = this.generateReminderEmailText(appointment, client, settings);

      const mailOptions = {
        from: settings.clinic_email || this.config?.auth?.user,
        to: client.email,
        subject: `תזכורת לתור במרפאת ${settings.clinic_name || 'העיניים'}`,
        text: emailText,
        html: emailHtml
      };

      console.log('Sending email from:', mailOptions.from, 'to:', mailOptions.to);
      await this.transporter.sendMail(mailOptions);
      console.log(`Reminder email sent successfully to ${client.email}`);
      return true;
    } catch (error) {
      console.error('Error sending reminder email:', error);
      return false;
    }
  }

  async sendCampaignEmail(
    client: Client,
    campaign: { name: string; email_content: string },
    settings: Settings
  ): Promise<boolean> {
    if (!this.transporter) {
      console.error('Email transporter not initialized');
      return false;
    }

    if (!client.email) {
      console.error('Client email not provided');
      return false;
    }

    try {
      console.log('Generating campaign email content...');
      const emailHtml = this.generateCampaignEmailHtml(client, campaign, settings);
      const emailText = this.generateCampaignEmailText(client, campaign, settings);

      const mailOptions = {
        from: settings.clinic_email || this.config?.auth?.user,
        to: client.email,
        subject: `${campaign.name} - ${settings.clinic_name || 'מרפאת העיניים'}`,
        text: emailText,
        html: emailHtml
      };

      console.log('Sending campaign email from:', mailOptions.from, 'to:', mailOptions.to);
      await this.transporter.sendMail(mailOptions);
      console.log(`Campaign email sent successfully to ${client.email}`);
      return true;
    } catch (error) {
      console.error('Error sending campaign email:', error);
      return false;
    }
  }

  private generateReminderEmailText(
    appointment: Appointment,
    client: Client,
    settings: Settings
  ): string {
    const appointmentDate = new Date(appointment.date || '').toLocaleDateString('he-IL');
    const appointmentTime = appointment.time || '';
    
    return `שלום ${client.first_name} ${client.last_name},

זוהי תזכורת לתור שלך במרפאת ${settings.clinic_name || 'העיניים'}.

פרטי התור:
תאריך: ${appointmentDate}
שעה: ${appointmentTime}
סוג בדיקה: ${appointment.exam_name || 'בדיקת עיניים'}

כתובת המרפאה:
${settings.clinic_address ? `${settings.clinic_address}, ` : ''}${settings.clinic_city || ''}
${settings.clinic_directions ? `הוראות הגעה: ${settings.clinic_directions}` : ''}

לפרטים נוספים או לביטול התור, אנא צרו קשר:
טלפון: ${settings.clinic_phone || ''}
אימייל: ${settings.clinic_email || ''}

בברכה,
צוות ${settings.clinic_name || 'מרפאת העיניים'}`;
  }

  private generateCampaignEmailText(
    client: Client,
    campaign: { name: string; email_content: string },
    settings: Settings
  ): string {
    const content = campaign.email_content
      .replace(/\{first_name\}/g, client.first_name || '')
      .replace(/\{last_name\}/g, client.last_name || '')
      .replace(/\{clinic_name\}/g, settings.clinic_name || 'מרפאת העיניים')
      .replace(/\{clinic_phone\}/g, settings.clinic_phone || '')
      .replace(/\{clinic_email\}/g, settings.clinic_email || '')
      .replace(/\{clinic_address\}/g, settings.clinic_address || '');
    
    return `שלום ${client.first_name} ${client.last_name},

${content}

לפרטים נוספים, אנא צרו קשר:
טלפון: ${settings.clinic_phone || ''}
אימייל: ${settings.clinic_email || ''}

בברכה,
צוות ${settings.clinic_name || 'מרפאת העיניים'}`;
  }

  private generateReminderEmailHtml(
    appointment: Appointment,
    client: Client,
    settings: Settings
  ): string {
    const appointmentDate = new Date(appointment.date || '').toLocaleDateString('he-IL');
    const appointmentTime = appointment.time || '';
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>תזכורת לתור</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
            background-color: #f5f5f5; 
            margin: 0; 
            padding: 20px; 
            direction: rtl; 
            text-align: right;
            unicode-bidi: embed;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            direction: rtl;
        }
        .header { 
            background-color: #3b82f6; 
            color: white; 
            padding: 30px; 
            text-align: center; 
            direction: rtl;
        }
        .content { 
            padding: 30px; 
            direction: rtl; 
            text-align: right; 
        }
        .appointment-details { 
            background-color: #f8fafc; 
            border-radius: 8px; 
            padding: 20px; 
            margin: 20px 0; 
            border-right: 4px solid #3b82f6;
            direction: rtl;
            text-align: right;
        }
        .detail-row { 
            margin: 10px 0; 
            font-size: 16px; 
            direction: rtl; 
            text-align: right;
            line-height: 1.6;
        }
        .label { 
            font-weight: bold; 
            color: #374151; 
            margin-left: 8px;
        }
        .footer { 
            background-color: #f8fafc; 
            padding: 20px; 
            text-align: center; 
            color: #6b7280; 
            direction: rtl;
        }
        .contact-info { 
            margin: 15px 0; 
            direction: rtl; 
            text-align: center;
        }
        h1, h2, h3, h4, h5, h6 { 
            direction: rtl; 
            text-align: right; 
        }
        p { 
            direction: rtl; 
            text-align: right; 
            line-height: 1.6;
        }
        br { 
            direction: rtl; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">תזכורת לתור</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${settings.clinic_name || 'מרפאת העיניים'}</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px; margin-bottom: 20px;">שלום ${client.first_name} ${client.last_name},</p>
            
            <p>זוהי תזכורת לתור שלך במרפאתנו.</p>
            
            <div class="appointment-details">
                <h3 style="margin-top: 0; color: #3b82f6;">פרטי התור</h3>
                <div class="detail-row">
                    <span class="label">תאריך:</span> ${appointmentDate}
                </div>
                <div class="detail-row">
                    <span class="label">שעה:</span> ${appointmentTime}
                </div>
                <div class="detail-row">
                    <span class="label">סוג בדיקה:</span> ${appointment.exam_name || 'בדיקת עיניים'}
                </div>
                ${appointment.note ? `<div class="detail-row"><span class="label">הערות:</span> ${appointment.note}</div>` : ''}
            </div>
            
            ${settings.clinic_address || settings.clinic_city ? `
            <div class="appointment-details">
                <h3 style="margin-top: 0; color: #3b82f6;">כתובת המרפאה</h3>
                ${settings.clinic_address ? `<div class="detail-row">${settings.clinic_address}</div>` : ''}
                ${settings.clinic_city ? `<div class="detail-row">${settings.clinic_city}</div>` : ''}
                ${settings.clinic_directions ? `<div class="detail-row"><span class="label">הוראות הגעה:</span> ${settings.clinic_directions}</div>` : ''}
            </div>
            ` : ''}
            
            <p>אנא הגיעו 10 דקות לפני השעה שנקבעה.</p>
            <p>לביטול או שינוי התור, אנא צרו קשר מראש.</p>
        </div>
        
        <div class="footer">
            <div class="contact-info">
                <strong>פרטי יצירת קשר:</strong><br>
                ${settings.clinic_phone ? `טלפון: ${settings.clinic_phone}<br>` : ''}
                ${settings.clinic_email ? `אימייל: ${settings.clinic_email}<br>` : ''}
                ${settings.clinic_website ? `אתר: ${settings.clinic_website}` : ''}
            </div>
            <p style="margin-top: 20px; font-size: 14px;">
                בברכה,<br>
                צוות ${settings.clinic_name || 'מרפאת העיניים'}
            </p>
        </div>
    </div>
</body>
</html>`;
  }

  private generateCampaignEmailHtml(
    client: Client,
    campaign: { name: string; email_content: string },
    settings: Settings
  ): string {
    const content = campaign.email_content
      .replace(/\{first_name\}/g, client.first_name || '')
      .replace(/\{last_name\}/g, client.last_name || '')
      .replace(/\{clinic_name\}/g, settings.clinic_name || 'מרפאת העיניים')
      .replace(/\{clinic_phone\}/g, settings.clinic_phone || '')
      .replace(/\{clinic_email\}/g, settings.clinic_email || '')
      .replace(/\{clinic_address\}/g, settings.clinic_address || '');
    
    return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${campaign.name}</title>
    <style>
        * { box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif; 
            background-color: #f5f5f5; 
            margin: 0; 
            padding: 20px; 
            direction: rtl; 
            text-align: right;
            unicode-bidi: embed;
        }
        .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 10px; 
            overflow: hidden; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            direction: rtl;
        }
        .header { 
            background-color: #3b82f6; 
            color: white; 
            padding: 30px; 
            text-align: center; 
            direction: rtl;
        }
        .content { 
            padding: 30px; 
            direction: rtl; 
            text-align: right; 
            line-height: 1.6;
        }
        .footer { 
            background-color: #f8fafc; 
            padding: 20px; 
            text-align: center; 
            color: #6b7280; 
            direction: rtl;
        }
        .contact-info { 
            margin: 15px 0; 
            direction: rtl; 
            text-align: center;
        }
        h1, h2, h3, h4, h5, h6 { 
            direction: rtl; 
            text-align: right; 
        }
        p { 
            direction: rtl; 
            text-align: right; 
            line-height: 1.6;
        }
        br { 
            direction: rtl; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 style="margin: 0; font-size: 24px;">${campaign.name}</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">${settings.clinic_name || 'מרפאת העיניים'}</p>
        </div>
        
        <div class="content">
            <p style="font-size: 18px; margin-bottom: 20px;">שלום ${client.first_name} ${client.last_name},</p>
            
            <div style="white-space: pre-wrap;">${content}</div>
        </div>
        
        <div class="footer">
            <div class="contact-info">
                <strong>פרטי יצירת קשר:</strong><br>
                ${settings.clinic_phone ? `טלפון: ${settings.clinic_phone}<br>` : ''}
                ${settings.clinic_email ? `אימייל: ${settings.clinic_email}<br>` : ''}
                ${settings.clinic_website ? `אתר: ${settings.clinic_website}` : ''}
            </div>
            <p style="margin-top: 20px; font-size: 14px;">
                בברכה,<br>
                צוות ${settings.clinic_name || 'מרפאת העיניים'}
            </p>
        </div>
    </div>
</body>
</html>`;
  }
}

export const emailService = new EmailService(); 