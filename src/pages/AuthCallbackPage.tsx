import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

/**
 * AuthCallbackPage - OAuth redirect handler
 * Extracts session from URL hash and sends it to parent window
 * This page runs in a popup window during OAuth flow
 */
export default function AuthCallbackPage() {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [isWebRedirect, setIsWebRedirect] = useState(false)

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[OAuth Callback] URL:', window.location.href)
        
        // Support both PKCE code flow and implicit token hash flow
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        
        const error = hashParams.get('error') || searchParams.get('error')
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description')

        if (error) {
          console.error('[OAuth Callback] OAuth error:', error, errorDescription)
          setStatus('error')
          setErrorMessage(errorDescription || error)
          return
        }

        let session: any = null
        const code = searchParams.get('code')

        if (code) {
          console.log('[OAuth Callback] Exchanging code for session')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (exchangeError) {
            console.error('[OAuth Callback] Exchange error:', exchangeError)
          }
          session = data?.session
        }

        // 2) Fallback to hash tokens (Common for Supabase implicit flow)
        if (!session) {
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token') || ''
          
          if (accessToken) {
            console.log('[OAuth Callback] Setting session from hash tokens')
            const { data, error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (setErr) console.warn('[OAuth Callback] setSession warning:', setErr.message)
            session = data?.session || { access_token: accessToken } // Fallback to just tokens
          }
        }

        // Environment Detection
        const isElectron = !!(window as any).electronAPI;
        const hasOpener = !!window.opener;

        console.log('[OAuth Callback] Environment:', { isElectron, hasOpener })

        // Even if session is null, if we have tokens we should try to Proceed to App on Web
        if (!session && !hashParams.get('access_token')) {
          console.error('[OAuth Callback] No session established')
          setStatus('error')
          setErrorMessage('Could not establish authentication session')
          return
        }

        setStatus('success')

        if (isElectron && hasOpener) {
          console.log('[OAuth Callback] Electron popup: Notifying parent...')
          window.opener.postMessage({ type: 'OAUTH_SUCCESS', session }, '*')
          setTimeout(() => window.close(), 800)
        } else {
          console.log('[OAuth Callback] Web mode: Showing manual button')
          setIsWebRedirect(true)
        }
        
      } catch (error) {
        console.error('[OAuth Callback] Fatal Error:', error)
        setStatus('error')
        setErrorMessage(error instanceof Error ? error.message : 'Failed to process login')
      }
    }

    handleCallback()
  }, [])

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      backgroundColor: '#f8fafc',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      direction: 'rtl'
    }}>
      <div style={{ 
        textAlign: 'center', 
        padding: '2rem',
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        maxWidth: '400px',
        width: '90%'
      }}>
        {status === 'processing' && (
          <>
            <div style={spinnerStyle}></div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#1e293b' }}>מעבד התחברות...</h2>
            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>אנחנו מבצעים סנכרון מאובטח של החשבון שלך.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={successIconStyle}>✓</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#059669' }}>התחברת בהצלחה!</h2>
            <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
              {isWebRedirect ? 'מיד תועבר חזרה לאפליקציה...' : 'החלון ייסגר אוטומטית.'}
            </p>
            <button 
              onClick={() => window.location.href = '/'}
              style={buttonStyle}
            >
              המשך לאפליקציה
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={errorIconStyle}>✕</div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#dc2626' }}>שגיאה בהתחברות</h2>
            <p style={{ color: '#ef4444', marginTop: '0.5rem', fontSize: '0.875rem' }}>{errorMessage}</p>
            <button 
              onClick={() => window.location.href = '/'}
              style={{ ...buttonStyle, backgroundColor: '#64748b' }}
            >
              חזרה לדף הבית
            </button>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

const spinnerStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  border: '3px solid #e2e8f0',
  borderTop: '3px solid #3b82f6',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
  margin: '0 auto 1.5rem'
}

const successIconStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  backgroundColor: '#dcfce7',
  color: '#059669',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '24px',
  margin: '0 auto 1.5rem'
}

const errorIconStyle: React.CSSProperties = {
  width: '48px',
  height: '48px',
  backgroundColor: '#fee2e2',
  color: '#dc2626',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '24px',
  margin: '0 auto 1.5rem'
}

const buttonStyle: React.CSSProperties = {
  marginTop: '1.5rem',
  padding: '0.75rem 1.5rem',
  backgroundColor: '#3b82f6',
  color: 'white',
  border: 'none',
  borderRadius: '8px',
  fontWeight: 500,
  cursor: 'pointer',
  width: '100%',
  transition: 'background-color 0.2s'
}