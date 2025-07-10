import { google } from 'googleapis'
import { GoogleTokens, GoogleOAuthService } from './google-oauth'
import { Appointment, Client } from '../db/schema'

export interface GoogleCalendarEvent {
  id?: string
  summary: string
  description?: string
  start: {
    dateTime: string
    timeZone?: string
  }
  end: {
    dateTime: string
    timeZone?: string
  }
  attendees?: Array<{
    email: string
    displayName?: string
  }>
}

export class GoogleCalendarService {
  private oauthService: GoogleOAuthService

  constructor() {
    this.oauthService = new GoogleOAuthService()
  }

  /**
   * Create a calendar event from an appointment
   */
  async createEvent(
    tokens: GoogleTokens,
    appointment: Appointment,
    client?: Client
  ): Promise<string | null> {
    try {
      const auth = this.oauthService.createAuthenticatedClient(tokens)
      const calendar = google.calendar({ version: 'v3', auth })

      const event: GoogleCalendarEvent = {
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
      }

      // Add client email as attendee if available
      if (client?.email) {
        event.attendees = [{
          email: client.email,
          displayName: `${client.first_name} ${client.last_name}`.trim()
        }]
      }

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
        sendUpdates: 'all'
      })

      return response.data.id || null
    } catch (error) {
      console.error('Error creating calendar event:', error)
      return null
    }
  }

  /**
   * Update a calendar event
   */
  async updateEvent(
    tokens: GoogleTokens,
    eventId: string,
    appointment: Appointment,
    client?: Client
  ): Promise<boolean> {
    try {
      const auth = this.oauthService.createAuthenticatedClient(tokens)
      const calendar = google.calendar({ version: 'v3', auth })

      const event: GoogleCalendarEvent = {
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
      }

      // Add client email as attendee if available
      if (client?.email) {
        event.attendees = [{
          email: client.email,
          displayName: `${client.first_name} ${client.last_name}`.trim()
        }]
      }

      console.log('🔄 Updating Google Calendar event:', eventId)
      console.log('📅 New time:', event.start.dateTime, 'to', event.end.dateTime)

      await calendar.events.update({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: event,
        sendUpdates: 'all'
      })

      console.log('✅ Successfully updated Google Calendar event:', eventId)
      return true
    } catch (error: any) {
      console.error('❌ Error updating calendar event:', eventId)
      console.error('Error details:', error.message || error)
      if (error.response?.data) {
        console.error('Google API response:', error.response.data)
      }
      return false
    }
  }

  /**
   * Delete a calendar event
   */
  async deleteEvent(tokens: GoogleTokens, eventId: string): Promise<boolean> {
    try {
      const auth = this.oauthService.createAuthenticatedClient(tokens)
      const calendar = google.calendar({ version: 'v3', auth })

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
        sendUpdates: 'all'
      })

      return true
    } catch (error) {
      console.error('Error deleting calendar event:', error)
      return false
    }
  }

  /**
   * Sync multiple appointments to Google Calendar
   */
  async syncAppointments(
    tokens: GoogleTokens,
    appointments: Array<{ appointment: Appointment; client?: Client }>
  ): Promise<{ success: number; failed: number }> {
    let success = 0
    let failed = 0

    for (const { appointment, client } of appointments) {
      try {
        const eventId = await this.createEvent(tokens, appointment, client)
        if (eventId) {
          success++
        } else {
          failed++
        }
      } catch (error) {
        console.error('Error syncing appointment:', error)
        failed++
      }
    }

    return { success, failed }
  }

  /**
   * Get user's calendar events for a date range
   */
  async getEvents(
    tokens: GoogleTokens,
    startDate: string,
    endDate: string
  ): Promise<GoogleCalendarEvent[]> {
    try {
      const auth = this.oauthService.createAuthenticatedClient(tokens)
      const calendar = google.calendar({ version: 'v3', auth })

      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date(startDate).toISOString(),
        timeMax: new Date(endDate).toISOString(),
        singleEvents: true,
        orderBy: 'startTime'
      })

      return response.data.items?.map(item => ({
        id: item.id || undefined,
        summary: item.summary || '',
        description: item.description || undefined,
        start: {
          dateTime: item.start?.dateTime || item.start?.date || '',
          timeZone: item.start?.timeZone || undefined
        },
        end: {
          dateTime: item.end?.dateTime || item.end?.date || '',
          timeZone: item.end?.timeZone || undefined
        },
        attendees: item.attendees?.map(attendee => ({
          email: attendee.email || '',
          displayName: attendee.displayName || undefined
        }))
      })) || []
    } catch (error) {
      console.error('Error fetching calendar events:', error)
      return []
    }
  }

  /**
   * Create a DateTime string from date, time, and duration
   */
  private createDateTime(date: string, time: string, durationMinutes: number = 0): string {
    const [hours, minutes] = time.split(':').map(Number)
    const dateTime = new Date(date)
    dateTime.setHours(hours, minutes + durationMinutes, 0, 0)
    return dateTime.toISOString()
  }

  /**
   * Create event description from appointment and client data
   */
  private createEventDescription(appointment: Appointment, client?: Client): string {
    let description = ''
    
    if (client) {
      description += `לקוח: ${client.first_name} ${client.last_name}\n`
      if (client.phone_mobile) {
        description += `טלפון: ${client.phone_mobile}\n`
      }
      if (client.email) {
        description += `אימייל: ${client.email}\n`
      }
    }
    
    if (appointment.note) {
      description += `\nהערות: ${appointment.note}`
    }
    
    description += `\n\nנוצר על ידי מערכת ניהול המרפאה`
    
    return description
  }
} 