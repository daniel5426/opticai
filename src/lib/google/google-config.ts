export interface GoogleConfig {
  readonly clientId: string
  readonly clientSecret: string
  redirectUri: string
  scopes: string[]
}

export const GOOGLE_CONFIG: GoogleConfig = {
  // Desktop OAuth credentials for Google Calendar API access
  // These are separate from the web OAuth used by Supabase for login
  get clientId() {
    return process.env.GOOGLE_DESKTOP_CLIENT_ID || 'your-desktop-client-id.apps.googleusercontent.com';
  },
  get clientSecret() {
    return process.env.GOOGLE_DESKTOP_CLIENT_SECRET || 'your-desktop-client-secret';
  },
  // Use loopback URI for desktop OAuth (works in both dev and prod)
  redirectUri: 'http://127.0.0.1:3000/oauth/callback',
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email'
  ]
}

export const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token' 