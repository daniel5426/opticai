import authCopy from '../../localization/auth-login.json';
import { shell } from 'electron'
import http from 'http'
import { randomBytes, createHash } from 'crypto'
import { spawn } from 'child_process'
import { GOOGLE_CONFIG } from './google-config.js'

export interface GoogleTokens {
  access_token: string
  refresh_token: string
  id_token?: string
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
  private static pendingAuth: { resolve: Function; reject: Function } | null = null

  constructor() {
    if (!GOOGLE_CONFIG.clientId || !GOOGLE_CONFIG.clientSecret) {
      throw new Error('authLogin.google.google_not_configured')
    }
    // Import google dynamically to avoid loading Node.js dependencies in renderer
    const { google } = require('googleapis')
    this.oauth2Client = new google.auth.OAuth2(
      GOOGLE_CONFIG.clientId,
      GOOGLE_CONFIG.clientSecret,
      GOOGLE_CONFIG.redirectUri
    )
  }

  /**
   * Handle the OAuth flow in Google Chrome.
   */
  async authenticate(locale = 'he'): Promise<{ tokens: GoogleTokens; userInfo: GoogleUserInfo }> {
    if (GoogleOAuthService.pendingAuth) throw new Error('authLogin.google.failed')
    const state = randomBytes(32).toString('base64url')
    const verifier = randomBytes(32).toString('base64url')
    const challenge = createHash('sha256').update(verifier).digest('base64url')
    const callbackServer = await this.createLoopbackCallbackServer(state, locale)
    const oauth2Client = this.createOAuthClient(callbackServer.redirectUri)
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: GOOGLE_CONFIG.scopes,
      prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256'
    })

    return new Promise((resolve, reject) => {
      let settled = false
      let timeoutId: NodeJS.Timeout | undefined
      const cleanup = () => {
        if (timeoutId) {
          clearTimeout(timeoutId)
        }
        callbackServer.close()
        if (GoogleOAuthService.pendingAuth === pending) {
          GoogleOAuthService.pendingAuth = null
        }
      }

      const finish = async (code: string) => {
        if (settled) return
        settled = true
        try {
          const { tokens } = await oauth2Client.getToken({ code, codeVerifier: verifier, redirect_uri: callbackServer.redirectUri })
          oauth2Client.setCredentials(tokens)

          const userInfo = await this.getUserInfo(oauth2Client)

          resolve({ tokens, userInfo })
        } catch (error) {
          reject(error)
        } finally {
          cleanup()
        }
      }

      const fail = (error: Error) => {
        if (settled) return
        settled = true
        cleanup()
        reject(error)
      }

      // Store pending auth to resolve it from outside if needed
      const pending = {
        resolve: finish,
        reject: fail
      }

      GoogleOAuthService.pendingAuth = pending

      callbackServer.waitForCode.then(finish).catch(fail)
      this.openUrlInChrome(authUrl).catch(fail)
      timeoutId = setTimeout(() => {
        fail(new Error('authLogin.google.timeout'))
      }, 120 * 1000)
    })
  }

  private createOAuthClient(redirectUri: string): any {
    const { google } = require('googleapis')
    return new google.auth.OAuth2(GOOGLE_CONFIG.clientId, GOOGLE_CONFIG.clientSecret, redirectUri)
  }

  private async getUserInfo(client: any): Promise<GoogleUserInfo> {
    const { google } = require('googleapis')
    const response = await google.oauth2({ version: 'v2', auth: client }).userinfo.get()
    return { email: response.data.email!, name: response.data.name || undefined, picture: response.data.picture || undefined }
  }

  private async createLoopbackCallbackServer(expectedState: string, locale = 'he'): Promise<{
    redirectUri: string
    waitForCode: Promise<string>
    close: () => void
  }> {
    let resolveCode: (code: string) => void
    let rejectCode: (error: Error) => void
    const waitForCode = new Promise<string>((resolve, reject) => {
      resolveCode = resolve
      rejectCode = reject
    })

    const server = http.createServer((req, res) => {
      try {
        const host = req.headers.host || ''
        const url = new URL(req.url || '/', `http://${host}`)
        if (url.pathname !== '/oauth/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Not found')
          return
        }

        if (req.method !== 'GET' || url.searchParams.get('state') !== expectedState) {
          res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
          res.end('Invalid OAuth callback')
          return
        }
        const error = url.searchParams.get('error')
        const code = url.searchParams.get('code')
        if (error) {
          rejectCode(new Error('authLogin.google.cancelled'))
        } else if (code) {
          resolveCode(code)
        } else {
          rejectCode(new Error('No authorization code received'))
        }

        const language = locale === 'en' || locale === 'fr' ? locale : 'he'
        const copy = authCopy[language].google
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(`
          <!doctype html>
          <html lang="${language}" dir="${language === 'he' ? 'rtl' : 'ltr'}">
            <head><meta charset="utf-8"><title>${error || !code ? copy.callbackError : copy.callbackSuccess}</title></head>
            <body style="font-family: sans-serif; text-align: center; padding: 48px;">
              <h1>${error || !code ? copy.callbackError : copy.callbackSuccess}</h1>
              <p>${error || !code ? copy.cancelled : copy.callbackSuccessDescription}</p>
              <script>window.close();</script>
            </body>
          </html>
        `)
      } catch (error) {
        rejectCode(error instanceof Error ? error : new Error(String(error)))
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('OAuth callback failed')
      }
    })

    await new Promise<void>((resolve, reject) => {
      server.once('error', reject)
      server.listen(0, '127.0.0.1', () => resolve())
    })

    const address = server.address()
    if (!address || typeof address === 'string') {
      server.close()
      throw new Error('Could not start Google OAuth callback server')
    }

    return {
      redirectUri: `http://127.0.0.1:${address.port}/oauth/callback`,
      waitForCode,
      close: () => {
        if (server.listening) {
          server.close()
        }
      }
    }
  }

  private async openUrlInChrome(url: string): Promise<void> {
    const candidates = process.platform === 'darwin'
      ? [{ command: 'open', args: ['-a', 'Google Chrome', url] }]
      : process.platform === 'win32'
        ? [{ command: 'cmd', args: ['/c', 'start', '', 'chrome', url] }]
        : [
            { command: 'google-chrome', args: [url] },
            { command: 'google-chrome-stable', args: [url] },
            { command: 'chromium', args: [url] },
            { command: 'chromium-browser', args: [url] },
          ]

    await new Promise<void>((resolve, reject) => {
      let index = 0
      const tryNext = () => {
        const candidate = candidates[index]
        if (!candidate) {
          reject(new Error('Google Chrome was not found'))
          return
        }

        index += 1
        const child = spawn(candidate.command, candidate.args, {
          detached: true,
          stdio: 'ignore',
          windowsHide: true,
        })

        child.once('error', tryNext)
        child.once('exit', (code) => {
          if (code === 0 || process.platform === 'win32') {
            resolve()
          } else {
            tryNext()
          }
        })
        child.unref()
      }

      tryNext()
    }).catch(async (error) => {
      console.warn('[GoogleOAuth] Failed to open Chrome, falling back to default browser:', error)
      await shell.openExternal(url)
    })
  }

  /**
   * Resolve a pending authentication with a code received from the renderer
   */
  static async resolvePendingAuth(_code: string): Promise<boolean> {
    return false
  }

  static cancelPendingAuth(message = 'Google authentication was cancelled'): boolean {
    if (this.pendingAuth) {
      this.pendingAuth.reject(new Error(message))
      return true
    }
    return false
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
    const { google } = require('googleapis')
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
      const { google } = require('googleapis')
      const oauth2 = google.oauth2({ version: 'v2', auth: client })
      await oauth2.userinfo.get()
      return true
    } catch (error) {
      return false
    }
  }
}
