import { GoogleCalendarService } from './google-calendar'
import { GoogleTokens } from './google-oauth'
import { Appointment, Client, User } from '../db/schema'

export class GoogleCalendarSyncService {
  private calendarService: GoogleCalendarService

  constructor() {
    this.calendarService = new GoogleCalendarService()
  }

  /**
   * Get user's Google tokens if they're connected
   */
  private getUserTokens(user: User): GoogleTokens | null {
    if (!user.google_account_connected || !user.google_access_token || !user.google_refresh_token) {
      return null
    }

    return {
      access_token: user.google_access_token,
      refresh_token: user.google_refresh_token,
      scope: 'https://www.googleapis.com/auth/calendar',
      token_type: 'Bearer',
      expiry_date: Date.now() + 3600000 // 1 hour from now
    }
  }

  /**
   * Sync appointment creation to Google Calendar
   */
  async syncAppointmentCreated(appointment: Appointment, client: Client | null, user: User): Promise<string | null> {
    try {
      const tokens = this.getUserTokens(user)
      if (!tokens) {
        console.log('User not connected to Google Calendar, skipping sync')
        return null
      }

      console.log('Syncing new appointment to Google Calendar:', appointment.id)
      const eventId = await this.calendarService.createEvent(tokens, appointment, client || undefined)
      
      if (eventId) {
        console.log('Successfully created Google Calendar event:', eventId)
        return eventId
      } else {
        console.log('Failed to create Google Calendar event')
        return null
      }
    } catch (error) {
      console.error('Error syncing appointment creation to Google Calendar:', error)
      return null
    }
  }

  /**
   * Sync appointment update to Google Calendar
   */
  async syncAppointmentUpdated(appointment: Appointment, client: Client | null, user: User, googleEventId?: string): Promise<boolean> {
    try {
      const tokens = this.getUserTokens(user)
      if (!tokens) {
        console.log('User not connected to Google Calendar, skipping sync')
        return false
      }

      if (!googleEventId) {
        console.log('No Google event ID found for appointment update. Creating new event instead.')
        // Fallback: Create new event if no event ID is stored
        const eventId = await this.syncAppointmentCreated(appointment, client, user)
        return !!eventId
      }

      console.log('Syncing appointment update to Google Calendar:', appointment.id, 'Event ID:', googleEventId)
      const success = await this.calendarService.updateEvent(tokens, googleEventId, appointment, client || undefined)
      
      if (success) {
        console.log('Successfully updated Google Calendar event')
      } else {
        console.log('Failed to update Google Calendar event - event may not exist. Creating new event instead.')
        // Fallback: If update fails, create a new event
        const eventId = await this.syncAppointmentCreated(appointment, client, user)
        return !!eventId
      }
      
      return success
    } catch (error) {
      console.error('Error syncing appointment update to Google Calendar:', error)
      // Fallback: If there's an error, try creating a new event
      try {
        console.log('Attempting to create new event as fallback...')
        const eventId = await this.syncAppointmentCreated(appointment, client, user)
        return !!eventId
      } catch (fallbackError) {
        console.error('Fallback creation also failed:', fallbackError)
        return false
      }
    }
  }

  /**
   * Sync appointment deletion to Google Calendar
   */
  async syncAppointmentDeleted(user: User, googleEventId?: string): Promise<boolean> {
    try {
      const tokens = this.getUserTokens(user)
      if (!tokens) {
        console.log('User not connected to Google Calendar, skipping sync')
        return false
      }

      if (!googleEventId) {
        console.log('No Google event ID found, nothing to delete')
        return false
      }

      console.log('Syncing appointment deletion to Google Calendar, Event ID:', googleEventId)
      const success = await this.calendarService.deleteEvent(tokens, googleEventId)
      
      if (success) {
        console.log('Successfully deleted Google Calendar event')
      } else {
        console.log('Failed to delete Google Calendar event')
      }
      
      return success
    } catch (error) {
      console.error('Error syncing appointment deletion to Google Calendar:', error)
      return false
    }
  }
}

// Export singleton instance
export const googleCalendarSync = new GoogleCalendarSyncService() 