
import { authenticateGoogleWeb, refreshGoogleWebToken } from './google-web-oauth';

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
  id_token?: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface GoogleUserInfo {
  email: string;
  name?: string;
  picture?: string;
}

export const googleWebAPI = {
  googleOAuthAuthenticate: authenticateGoogleWeb,

  async googleCalendarCreateEvent(tokens: any, appointment: any, client?: any): Promise<string | null> {
    try {
      const event = {
        summary: appointment.exam_name || 'בדיקת עיניים',
        description: this.createEventDescription(appointment, client),
        start: {
          dateTime: this.createDateTime(appointment.date!, appointment.time!),
          timeZone: 'Asia/Jerusalem'
        },
        end: {
          dateTime: this.createDateTime(
            appointment.date!,
            appointment.time!,
            appointment.duration || 30
          ),
          timeZone: 'Asia/Jerusalem'
        }
      };

      const response = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data.id;
    } catch (error) {
      console.error('Web Google Calendar Error:', error);
      return null;
    }
  },

  async googleCalendarUpdateEvent(tokens: any, eventId: string, appointment: any, client?: any): Promise<boolean> {
    try {
      const event = {
        summary: appointment.exam_name || 'בדיקת עיניים',
        description: this.createEventDescription(appointment, client),
        start: {
          dateTime: this.createDateTime(appointment.date!, appointment.time!),
          timeZone: 'Asia/Jerusalem'
        },
        end: {
          dateTime: this.createDateTime(
            appointment.date!,
            appointment.time!,
            appointment.duration || 30
          ),
          timeZone: 'Asia/Jerusalem'
        }
      };

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
      });

      return response.ok;
    } catch (error) {
      console.error('Web Google Calendar Update Error:', error);
      return false;
    }
  },

  async googleCalendarDeleteEvent(tokens: any, eventId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Web Google Calendar Delete Error:', error);
      return false;
    }
  },

  async googleCalendarSyncAppointments(tokens: any, appointments: any[]): Promise<{ success: number; failed: number }> {
     let success = 0;
     let failed = 0;
     for (const item of appointments) {
       const id = await this.googleCalendarCreateEvent(tokens, item.appointment, item.client);
       if (id) success++; else failed++;
     }
     return { success, failed };
  },

  async googleCalendarGetEvents(tokens: any, startDate: string, endDate: string): Promise<any[]> {
    try {
      const params = new URLSearchParams({
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate).toISOString(),
        singleEvents: 'true',
        orderBy: 'startTime'
      });

      const response = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params.toString()}`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`
        }
      });

      if (!response.ok) return [];
      const data = await response.json();
      return data.items || [];
    } catch (error) {
      console.error('Web Google Calendar GetEvents Error:', error);
      return [];
    }
  },

  googleOAuthRefreshToken: refreshGoogleWebToken,

  async googleOAuthValidateTokens(tokens: any): Promise<boolean> {
    if (!tokens?.access_token) return false;
    try {
      const response = await fetch(`https://www.googleapis.com/oauth2/v2/tokeninfo?access_token=${tokens.access_token}`);
      return response.ok;
    } catch (error) {
      return false;
    }
  },

  // Helper methods copied from google-calendar.ts (modified for JS date)
  createDateTime(date: string, time: string, durationMinutes: number = 0): string {
    const [hours, minutes] = time.split(':').map(Number);
    const dateTime = new Date(date);
    dateTime.setHours(hours, minutes + durationMinutes, 0, 0);
    return dateTime.toISOString();
  },

  createEventDescription(appointment: any, client?: any): string {
    let description = '';
    if (client) {
      description += `לקוח: ${client.first_name} ${client.last_name}\n`;
      if (client.phone_mobile) description += `טלפון: ${client.phone_mobile}\n`;
      if (client.email) description += `אימייל: ${client.email}\n`;
    }
    if (appointment.note) description += `\nהערות: ${appointment.note}`;
    description += `\n\nנוצר על ידי מערכת ניהול המרפאה (Web)`;
    return description;
  }
};
