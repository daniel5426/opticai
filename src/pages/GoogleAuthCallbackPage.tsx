import React, { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

/**
 * GoogleAuthCallbackPage - Google OAuth redirect handler
 * Extracts authorization code from URL and sends it to the main application
 * via BroadcastChannel or IPC if in Electron.
 */
export default function GoogleAuthCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[Google OAuth Callback] Processing redirect')
        
        const searchParams = new URLSearchParams(window.location.search)
        const code = searchParams.get('code')
        const error = searchParams.get('error')

        if (error) {
          throw new Error(error)
        }

        if (!code) {
          throw new Error('No authorization code received')
        }

        console.log('[Google OAuth Callback] Code received, signaling application')

        // 1. Send via BroadcastChannel (works between system browser and Electron if same origin)
        const channel = new BroadcastChannel('google-oauth-channel')
        channel.postMessage({ type: 'GOOGLE_AUTH_CODE', code })
        
        // 2. If running inside Electron, try IPC directly
        if (window.electronAPI && (window.electronAPI as any).googleOAuthCodeReceived) {
          await (window.electronAPI as any).googleOAuthCodeReceived(code)
        }

        setStatus('success')
        
        // Close window after a short delay if it was a popup/tab
        setTimeout(() => {
          window.close()
        }, 3000)

      } catch (error) {
        console.error('[Google OAuth Callback] Error:', error)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : String(error))
      }
    }

    handleCallback()
  }, [])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <div className="max-w-md w-full p-8 rounded-xl border bg-card shadow-lg">
        {status === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <h1 className="text-xl font-semibold">מעבד התחברות ל-Google...</h1>
            <p className="text-muted-foreground">אנא המתן בזמן שאנחנו מסנכרנים את היומן שלך.</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h1 className="text-xl font-semibold">ההתחברות הצליחה!</h1>
            <p className="text-muted-foreground">יומן Google שלך מחובר כעת. החלון ייסגר אוטומטית.</p>
            <button 
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md transition-colors hover:bg-primary/90"
            >
              סגור חלון
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-12 w-12 text-destructive" />
            <h1 className="text-xl font-semibold text-destructive">שגיאה בהתחברות</h1>
            <p className="text-muted-foreground">{errorMessage || 'אירעה שגיאה בעת ניסיון ההתחברות ל-Google.'}</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-md transition-colors hover:bg-secondary/80"
            >
              חזור לאפליקציה
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
