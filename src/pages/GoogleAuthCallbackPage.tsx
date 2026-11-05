import React, { useEffect, useState } from 'react'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { publishGoogleOAuthCallback } from '@/lib/google/google-web-oauth'

/**
 * GoogleAuthCallbackPage - Google OAuth redirect handler
 * Extracts authorization code from URL and sends it to the main application
 * via a state-bound BroadcastChannel. Desktop uses its own loopback callback.
 */
export default function GoogleAuthCallbackPage() {
  const { t, i18n } = useTranslation()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    const success = publishGoogleOAuthCallback(window.location.search)
    setStatus(success ? 'success' : 'error')
    if (!success) {
      setErrorMessage(t('authLogin.google.failed'))
      return
    }
    const closeTimer = setTimeout(() => window.close(), 3000)
    return () => clearTimeout(closeTimer)
  }, [t])

  return (
    <div dir={i18n.dir()} className="flex flex-col items-center justify-center min-h-screen bg-background p-4 text-center">
      <div className="max-w-md w-full p-8 rounded-xl border bg-card shadow-lg">
        {status === 'processing' && (
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-12 w-12 text-primary animate-spin" />
            <h1 className="text-xl font-semibold">{t('authLogin.google.processing')}</h1>
            <p className="text-muted-foreground">{t('authLogin.google.processingDescription')}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="flex flex-col items-center gap-4">
            <CheckCircle2 className="h-12 w-12 text-green-500" />
            <h1 className="text-xl font-semibold">{t('authLogin.google.callbackSuccess')}</h1>
            <p className="text-muted-foreground">{t('authLogin.google.callbackSuccessDescription')}</p>
            <button 
              onClick={() => window.close()}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md transition-colors hover:bg-primary/90"
            >
              {t('authLogin.google.close')}
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <XCircle className="h-12 w-12 text-destructive" />
            <h1 className="text-xl font-semibold text-destructive">{t('authLogin.google.callbackError')}</h1>
            <p className="text-muted-foreground">{errorMessage || t('authLogin.google.failed')}</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="mt-4 px-4 py-2 bg-secondary text-secondary-foreground rounded-md transition-colors hover:bg-secondary/80"
            >
              {t('authLogin.google.back')}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
