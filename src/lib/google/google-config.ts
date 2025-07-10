export interface GoogleConfig {
  readonly clientId: string
  readonly clientSecret: string
  redirectUri: string
  scopes: string[]
}

export const GOOGLE_CONFIG: GoogleConfig = {
  // These will need to be replaced with actual Google OAuth credentials
  // Get these from Google Cloud Console: https://console.cloud.google.com/
  get clientId() {
    return process.env.GOOGLE_CLIENT_ID || 'your-client-id.apps.googleusercontent.com';
  },
  get clientSecret() {
    return process.env.GOOGLE_CLIENT_SECRET || 'your-client-secret';
  },
  redirectUri: 'http://localhost:3000/oauth/callback',
  scopes: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/userinfo.email'
  ]
}

export const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token' 