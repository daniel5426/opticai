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

  useEffect(() => {
    const handleCallback = async () => {
      try {
        console.log('[OAuth Callback] Processing OAuth redirect')
        
        // Support both PKCE code flow and implicit token hash flow
        const searchParams = new URLSearchParams(window.location.search)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const error = hashParams.get('error') || searchParams.get('error')
        const errorDescription = hashParams.get('error_description') || searchParams.get('error_description')

        // Check for OAuth errors
        if (error) {
          console.error('[OAuth Callback] OAuth error:', error, errorDescription)
          setStatus('error')
          setErrorMessage(errorDescription || error)
          
          if (window.opener) {
            window.opener.postMessage({
              type: 'OAUTH_ERROR',
              error: errorDescription || error
            }, window.location.origin)
          }
          
          setTimeout(() => window.close(), 2000)
          return
        }

        let session: any = null

        // 1) Try PKCE code exchange if `code` exists in URL
        const hasCode = !!searchParams.get('code')
        if (hasCode) {
          console.log('[OAuth Callback] Code found, exchanging for session')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href)
          if (exchangeError) {
            console.error('[OAuth Callback] exchangeCodeForSession error:', exchangeError)
            throw new Error(exchangeError.message)
          }
          session = data?.session || null
        }

        // 2) Fallback to implicit flow (hash tokens)
        if (!session) {
          const accessToken = hashParams.get('access_token')
          const refreshToken = hashParams.get('refresh_token') || ''
          const expiresIn = hashParams.get('expires_in')
          const tokenType = hashParams.get('token_type')

          if (!accessToken) {
            console.error('[OAuth Callback] No access token or code in URL')
            setStatus('error')
            setErrorMessage('No OAuth tokens received')
            
            if (window.opener) {
              window.opener.postMessage({
                type: 'OAUTH_ERROR',
                error: 'No OAuth tokens found'
              }, '*')
            }
            
            setTimeout(() => window.close(), 2000)
            return
          }

          // Try to set Supabase session so the main window can pick it up/broadcast
          try {
            const { data, error: setErr } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            })
            if (setErr) {
              console.warn('[OAuth Callback] setSession warning:', setErr.message)
            }
            session = data?.session || {
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_in: expiresIn ? parseInt(expiresIn) : 3600,
              token_type: tokenType || 'bearer',
              user: null,
            }
          } catch (e) {
            console.warn('[OAuth Callback] setSession failed, using raw tokens')
            session = {
              access_token: accessToken,
              refresh_token: refreshToken,
              expires_in: expiresIn ? parseInt(expiresIn) : 3600,
              token_type: tokenType || 'bearer',
              user: null,
            }
          }
        }

        console.log('[OAuth Callback] OAuth successful, sending session to parent')
        setStatus('success')

        // Send success message to parent window
        if (window.opener) {
          window.opener.postMessage({
            type: 'OAUTH_SUCCESS',
            session: session
          }, '*')
          
          console.log('[OAuth Callback] Message sent, closing window immediately')
          
          // Close immediately - don't wait
          window.close()
          
          // Fallback: if window.close() doesn't work (some browsers prevent it), try again
          setTimeout(() => {
            if (!window.closed) {
              console.log('[OAuth Callback] First close attempt failed, trying again')
              window.close()
            }
          }, 100)
        } else {
          console.warn('[OAuth Callback] No parent window found')
          window.close()
        }
        
      } catch (error) {
        console.error('[OAuth Callback] Error processing callback:', error)
        setStatus('error')
        setErrorMessage('Failed to process OAuth callback')
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'OAUTH_ERROR',
            error: 'Failed to handle OAuth callback'
          }, window.location.origin)
        }
        
        setTimeout(() => window.close(), 2000)
      }
    }

    // Small delay to ensure URL is fully loaded
    const timer = setTimeout(handleCallback, 100)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      minHeight: '100vh',
      backgroundColor: '#ffffff',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      direction: 'rtl'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '300px' }}>
        {status === 'processing' && (
          <>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #3498db',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }}></div>
            <p style={{ color: '#666', fontSize: '16px', margin: 0 }}>
              מעבד התחברות...
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#4CAF50',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg style={{ width: '24px', height: '24px' }} fill="white" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <p style={{ color: '#4CAF50', fontSize: '16px', margin: '0 0 8px 0' }}>
              התחברות הושלמה בהצלחה
            </p>
            <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
              החלון ייסגר אוטומטית...
            </p>
            <p style={{ color: '#999', fontSize: '11px', margin: '8px 0 0 0' }}>
              אם החלון לא נסגר, אנא סגור אותו ידנית
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: '#f44336',
              margin: '0 auto 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <svg style={{ width: '24px', height: '24px' }} fill="white" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
            <p style={{ color: '#f44336', fontSize: '16px', margin: '0 0 8px 0' }}>
              שגיאה בהתחברות
            </p>
            {errorMessage && (
              <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
                {errorMessage}
              </p>
            )}
          </>
        )}

        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}