import { google } from 'googleapis'
import { BrowserWindow } from 'electron'
import { GOOGLE_CONFIG } from './google-config'

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  scope: string
  token_type: string
  expiry_date: number
}

export interface GoogleUserInfo {
  email: string
  name?: string
  picture?: string
}

export class GoogleOAuthService {
  private oauth2Client: any

  constructor() {
    // Debug: Print the credentials being used
    console.log('🔍 Google OAuth Debug Info:')
    console.log('Client ID:', GOOGLE_CONFIG.clientId)
    console.log('Client Secret:', GOOGLE_CONFIG.clientSecret ? `${GOOGLE_CONFIG.clientSecret.substring(0, 10)}...` : 'NOT SET')
    console.log('Redirect URI:', GOOGLE_CONFIG.redirectUri)
    console.log('Environment variables:')
    console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? `${process.env.GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'NOT SET')
    console.log('- GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'NOT SET')
    
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CONFIG.clientId,
      GOOGLE_CONFIG.clientSecret,
      GOOGLE_CONFIG.redirectUri
    )
  }

  /**
   * Generate the OAuth URL for authentication
   */
  generateAuthUrl(): string {
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_CONFIG.scopes,
      prompt: 'consent'
    })
  }

  /**
   * Handle the OAuth flow in an Electron window
   */
  async authenticate(): Promise<{ tokens: GoogleTokens; userInfo: GoogleUserInfo }> {
    return new Promise((resolve, reject) => {
      const authUrl = this.generateAuthUrl()
      
      // Create a new browser window for OAuth
      const authWindow = new BrowserWindow({
        width: 500,
        height: 600,
        show: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      })

      authWindow.loadURL(authUrl)

      // Handle the redirect
      authWindow.webContents.on('will-redirect', async (event, url) => {
        if (url.startsWith(GOOGLE_CONFIG.redirectUri)) {
          event.preventDefault()
          
          try {
            const urlParams = new URL(url)
            const code = urlParams.searchParams.get('code')
            
            if (!code) {
              throw new Error('No authorization code received')
            }

            // Exchange code for tokens
            const { tokens } = await this.oauth2Client.getToken(code)
            this.oauth2Client.setCredentials(tokens)

            // Get user info
            const oauth2 = google.oauth2({ version: 'v2', auth: this.oauth2Client })
            const userInfoResponse = await oauth2.userinfo.get()
            
            const userInfo: GoogleUserInfo = {
              email: userInfoResponse.data.email!,
              name: userInfoResponse.data.name || undefined,
              picture: userInfoResponse.data.picture || undefined
            }

            authWindow.close()
            resolve({ tokens, userInfo })
          } catch (error) {
            authWindow.close()
            reject(error)
          }
        }
      })

      // Handle window closed
      authWindow.on('closed', () => {
        reject(new Error('Authentication window was closed'))
      })
    })
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<GoogleTokens> {
    this.oauth2Client.setCredentials({
      refresh_token: refreshToken
    })

    const { credentials } = await this.oauth2Client.refreshAccessToken()
    return credentials
  }

  /**
   * Create an authenticated OAuth2 client
   */
  createAuthenticatedClient(tokens: GoogleTokens): any {
    const client = new google.auth.OAuth2(
      GOOGLE_CONFIG.clientId,
      GOOGLE_CONFIG.clientSecret,
      GOOGLE_CONFIG.redirectUri
    )
    
    client.setCredentials(tokens)
    return client
  }

  /**
   * Validate if tokens are still valid
   */
  async validateTokens(tokens: GoogleTokens): Promise<boolean> {
    try {
      const client = this.createAuthenticatedClient(tokens)
      const oauth2 = google.oauth2({ version: 'v2', auth: client })
      await oauth2.userinfo.get()
      return true
    } catch (error) {
      return false
    }
  }
} 