
import { GOOGLE_CONFIG, GOOGLE_OAUTH_URL, GOOGLE_TOKEN_URL } from './google-config';

export interface GoogleTokens {
  access_token: string;
  refresh_token: string;
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
  async googleOAuthAuthenticate(): Promise<any> {
    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        client_id: GOOGLE_CONFIG.clientId,
        redirect_uri: GOOGLE_CONFIG.redirectUri,
        response_type: 'code',
        scope: GOOGLE_CONFIG.scopes.join(' '),
        access_type: 'offline',
        prompt: 'consent'
      });
      
      const url = `${GOOGLE_OAUTH_URL}?${params.toString()}`;
      const popup = window.open(url, 'google-oauth', 'width=500,height=600');
      
      if (!popup) {
        return resolve({ success: false, error: 'Popup blocked' });
      }

      // We use BroadcastChannel which we already set up in App.tsx and GoogleAuthCallbackPage.tsx
      const channel = new BroadcastChannel('google-oauth-channel');
      
      const timeout = setTimeout(() => {
        channel.close();
        resolve({ success: false, error: 'Authentication timeout' });
      }, 60000);

      channel.onmessage = async (event) => {
        if (event.data.type === 'GOOGLE_AUTH_CODE') {
          clearTimeout(timeout);
          channel.close();
          popup.close();
          
          const code = event.data.code;
          try {
            const result = await this.exchangeCodeForTokens(code);
            resolve(result);
          } catch (error) {
            resolve({ success: false, error: error instanceof Error ? error.message : 'Token exchange failed' });
          }
        }
      };
    });
  },

  async exchangeCodeForTokens(code: string): Promise<any> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CONFIG.clientId,
        client_secret: GOOGLE_CONFIG.clientSecret,
        redirect_uri: GOOGLE_CONFIG.redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error_description || 'Failed to exchange code');
    }

    const tokens = await response.json();
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    
    const userInfo = await userResponse.json();

    return {
      success: true,
      tokens: {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        scope: tokens.scope,
        token_type: tokens.token_type,
        expiry_date: Date.now() + (tokens.expires_in * 1000)
      },
      userInfo: {
        email: userInfo.email,
        name: userInfo.name,
        picture: userInfo.picture
      }
    };
  },

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

  async googleOAuthRefreshToken(refreshToken: string): Promise<any> {
    try {
      const response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          refresh_token: refreshToken,
          client_id: GOOGLE_CONFIG.clientId,
          client_secret: GOOGLE_CONFIG.clientSecret,
          grant_type: 'refresh_token',
        }),
      });

      if (!response.ok) return { success: false };
      const data = await response.json();
      return {
        success: true,
        access_token: data.access_token,
        refresh_token: data.refresh_token || refreshToken,
        expiry_date: Date.now() + (data.expires_in * 1000)
      };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  },

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
