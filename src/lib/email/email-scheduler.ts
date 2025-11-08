import * as cron from 'node-cron';
import { emailService } from './email-service';
import { apiClient } from '../api-client';
export class EmailScheduler {
  private scheduledJob: cron.ScheduledTask | null = null;
  private isSchedulerRunning = false;

  constructor() {
    this.startScheduler();
  }

  private startScheduler() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
    }

    this.scheduledJob = cron.schedule('0 */15 * * * *', async () => {
      if (this.isSchedulerRunning) {
        console.log('Email scheduler already running, skipping...');
        return;
      }

      this.isSchedulerRunning = true;
      try {
        await this.checkAndSendReminders();
      } catch (error) {
        console.error('Error in email scheduler:', error);
      } finally {
        this.isSchedulerRunning = false;
      }
    });

    this.scheduledJob.start();

    console.log('Email scheduler started - checking every 15 minutes');
  }

  private async checkAndSendReminders() {
    try {
      console.log('Checking for appointments that need reminder emails...');

      const allAppointmentsResponse = await apiClient.getAppointments();
      const allAppointments = allAppointmentsResponse.data || [];

      // Group appointments by clinic_id
      const appointmentsByClinic = allAppointments.reduce((acc, appointment) => {
        if (!appointment.clinic_id) return acc;
        if (!acc[appointment.clinic_id]) {
          acc[appointment.clinic_id] = [];
        }
        acc[appointment.clinic_id].push(appointment);
        return acc;
      }, {} as Record<number, typeof allAppointments>);

      // Process each clinic's appointments
      for (const [clinicIdStr, clinicAppointments] of Object.entries(appointmentsByClinic)) {
        const clinicId = parseInt(clinicIdStr);

        // Get settings for this clinic
        const settingsResponse = await apiClient.getSettings(clinicId);
        const settings = settingsResponse.data;
        if (!settings || !settings.send_email_before_appointment) {
          continue;
        }

        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const emailTimeHour = parseInt(settings.email_time?.split(':')[0] || '10');
        const emailTimeMinute = parseInt(settings.email_time?.split(':')[1] || '0');

        if (currentHour !== emailTimeHour || Math.abs(currentMinute - emailTimeMinute) > 14) {
          continue;
        }

        const daysToCheck = settings.email_days_before || 1;
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + daysToCheck);
        const targetDateString = targetDate.toISOString().split('T')[0];

        const appointmentsNeedingReminders = clinicAppointments.filter(appointment => {
          if (appointment.date !== targetDateString) return false;
          return appointment.client_id;
        });

        console.log(`Found ${appointmentsNeedingReminders.length} appointments needing reminders for clinic ${clinicId} on ${targetDateString}`);

        for (const appointment of appointmentsNeedingReminders) {
          const clientResponse = await apiClient.getClientById(appointment.client_id);
          const client = clientResponse.data;
          if (!client || !client.email) {
            console.log(`Client not found or no email for appointment ${appointment.id}`);
            continue;
          }

          try {
            const sent = await emailService.sendAppointmentReminder(appointment, client, settings);
            if (sent) {
              console.log(`Reminder sent for appointment ${appointment.id} to ${client.email}`);
              this.logEmailSent(appointment.id!, client.email!, true);
            } else {
              console.log(`Failed to send reminder for appointment ${appointment.id}`);
              this.logEmailSent(appointment.id!, client.email!, false, 'Failed to send email');
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
          } catch (error) {
            console.error(`Error sending reminder for appointment ${appointment.id}:`, error);
            this.logEmailSent(appointment.id!, client.email!, false, error instanceof Error ? error.message : 'Unknown error');
          }
        }
      }
    } catch (error) {
      console.error('Error in checkAndSendReminders:', error);
    }
  }

  private logEmailSent(appointmentId: number, email: string, success: boolean, errorMessage?: string) {
    try {
      apiClient.createEmailLog({
        appointment_id: appointmentId,
        email_address: email,
        success: success,
        error_message: errorMessage
      });
      const logEntry = `${new Date().toISOString()}: Email ${success ? 'sent' : 'failed'} for appointment ${appointmentId} to ${email}${errorMessage ? ` - ${errorMessage}` : ''}`;
      console.log(logEntry);
    } catch (error) {
      console.error('Error logging email sent:', error);
    }
  }

  public async sendTestReminder(appointmentId: number): Promise<boolean> {
    try {
      const appointmentResponse = await apiClient.getAppointmentById(appointmentId);
      const appointment = appointmentResponse.data;
      if (!appointment) {
        console.error('Appointment not found:', appointmentId);
        return false;
      }

      const clientResponse = await apiClient.getClientById(appointment.client_id);
      const client = clientResponse.data;
      if (!client) {
        console.error('Client not found for appointment:', appointmentId);
        return false;
      }

      if (!client.email) {
        console.error('Client has no email address:', client.id);
        return false;
      }

      const settingsResponse = await apiClient.getSettings(appointment.clinic_id);
      const settings = settingsResponse.data;
      if (!settings) {
        console.error('Settings not found');
        return false;
      }

      console.log('Sending test reminder to:', client.email);
      return await emailService.sendAppointmentReminder(appointment, client, settings);
    } catch (error) {
      console.error('Error sending test reminder:', error);
      return false;
    }
  }

  public async testEmailConnection(): Promise<boolean> {
    return await emailService.testConnection();
  }

  public updateSchedule() {
    this.startScheduler();
  }

  public stop() {
    if (this.scheduledJob) {
      this.scheduledJob.stop();
      this.scheduledJob = null;
    }
    console.log('Email scheduler stopped');
  }

  public restart() {
    this.stop();
    this.startScheduler();
  }

  public getStatus() {
    return {
      isRunning: this.scheduledJob ? this.scheduledJob.getStatus() === 'scheduled' : false,
      nextRun: this.scheduledJob ? 'Every 15 minutes' : null
    };
  }
}

export const emailScheduler = new EmailScheduler(); 