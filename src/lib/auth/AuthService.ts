import { supabase } from '@/lib/supabaseClient'
import { apiClient } from '@/lib/api-client'
import { User, Company, Clinic } from '@/lib/db/schema-interface'
import { ROLE_LEVELS, isRoleAtLeast } from '@/lib/role-levels'
import { router } from '@/routes/router'

/**
 * Authentication State Machine
 * LOADING -> Initial state during app boot
 * UNAUTHENTICATED -> No session, show welcome/control-center
 * CLINIC_SELECTED -> Clinic chosen, show user selection
 * AUTHENTICATED -> Full session with user context
 * SETUP_REQUIRED -> New Supabase user needs company setup
 */
export enum AuthState {
  LOADING = 'loading',
  UNAUTHENTICATED = 'unauthenticated',
  CLINIC_SELECTED = 'clinic_selected',
  AUTHENTICATED = 'authenticated',
  SETUP_REQUIRED = 'setup_required'
}

export interface AuthSession {
  user?: User
  company?: Company
  clinic?: Clinic
  isSupabaseAuth?: boolean // True if authenticated via Supabase (not clinic user)
}

type StateChangeListener = (state: AuthState, session: AuthSession | null) => void

/**
 * AuthService - Single source of truth for authentication
 * Manages the complete authentication lifecycle with a clean state machine
 */
class AuthService {
  private state: AuthState = AuthState.LOADING
  private session: AuthSession | null = null
  private listeners: StateChangeListener[] = []
  private initialized = false

  constructor() {
    // Don't initialize AuthService in popup windows (OAuth callbacks)
    // Check both window.opener and current path to detect popup/callback context
    const isPopup = window.opener !== null
    const isCallbackRoute = window.location.pathname === '/auth/callback'
    
    if (isPopup || isCallbackRoute) {
      console.log('[Auth] Skipping initialization - popup/callback context:', { isPopup, isCallbackRoute })
      this.state = AuthState.LOADING
      return
    }
    
    this.initialize()
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================

  private async initialize(): Promise<void> {
    try {
      console.log('[Auth] Initializing...')

      // Check Supabase session first
      const { data: { session: supabaseSession } } = await supabase.auth.getSession()
      
      if (supabaseSession) {
        console.log('[Auth] Found Supabase session')
        await this.handleSupabaseSession(supabaseSession)
        } else {
        console.log('[Auth] No Supabase session, checking local storage')
        await this.restoreLocalSession()
      }

      // Setup Supabase auth listener
      this.setupAuthListener()
      
      this.initialized = true
      console.log('[Auth] Initialization complete, state:', this.state)
    } catch (error) {
      console.error('[Auth] Initialization failed:', error)
      this.transitionTo(AuthState.UNAUTHENTICATED)
    }
  }

  private setupAuthListener(): void {
    supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Supabase event:', event)

      // Ignore initial session (already handled in initialize)
      if (event === 'INITIAL_SESSION') return

      if (event === 'SIGNED_IN' && session) {
        await this.handleSupabaseSession(session)
      } else if (event === 'SIGNED_OUT') {
        // Only clear if not already unauthenticated and not a clinic user session
        if (this.state !== AuthState.UNAUTHENTICATED && !this.hasClinicContext()) {
          console.log('[Auth] Supabase signed out, clearing session')
          this.clearSession()
        }
      } else if (event === 'TOKEN_REFRESHED' && session) {
        // Update token silently
        apiClient.setToken(session.access_token)
      }
    })
  }

  // ============================================================================
  // SESSION HANDLING
  // ============================================================================

  private async handleSupabaseSession(session: any): Promise<void> {
    // Don't process sessions in popup/callback context
    if (window.location.pathname === '/auth/callback') {
      console.log('[Auth] Skipping session processing - in callback route')
      return
    }

    try {
      console.log('[Auth] Processing Supabase session')
      
      // Set token for API calls
      apiClient.setToken(session.access_token)
      
      // Check for pending clinic user OAuth (special case)
      const pendingUserId = this.getPendingClinicUserId()
      if (pendingUserId) {
        await this.completePendingClinicAuth(pendingUserId)
                return
          }
          
      // Try to get app user from backend
      const userResponse = await apiClient.getCurrentUser()
      
      if (!userResponse.data) {
        console.log('[Auth] No app user found, setup required')
        this.session = { isSupabaseAuth: true }
        this.transitionTo(AuthState.SETUP_REQUIRED)
              return
            }

          const user = userResponse.data as User
      
      // Check if CEO without company (shouldn't happen, but handle it)
      if (isRoleAtLeast(user.role_level, ROLE_LEVELS.ceo) && !user.company_id) {
        console.log('[Auth] CEO without company, setup required')
        this.session = { user, isSupabaseAuth: true }
        this.transitionTo(AuthState.SETUP_REQUIRED)
              return
            }
      
      // Load full context based on user role
      await this.loadUserContext(user, true)
      
      this.transitionTo(AuthState.AUTHENTICATED)
      
      } catch (error) {
      console.error('[Auth] Failed to process Supabase session:', error)
      this.clearSession()
    }
  }

  private async restoreLocalSession(): Promise<void> {
    const storedClinic = this.getStoredClinic()
    const storedUser = this.getStoredUser()

    console.log('[Auth] Stored clinic:', !!storedClinic, 'Stored user:', !!storedUser)

    if (storedClinic && storedUser) {
      // Full session restored
      this.session = { clinic: storedClinic, user: storedUser }
      this.transitionTo(AuthState.AUTHENTICATED)
    } else if (storedClinic) {
      // Only clinic selected
      this.session = { clinic: storedClinic }
      this.transitionTo(AuthState.CLINIC_SELECTED)
    } else {
      // No session
      this.transitionTo(AuthState.UNAUTHENTICATED)
    }
  }

  private async loadUserContext(user: User, isSupabaseAuth: boolean): Promise<void> {
    this.storeUser(user)

    if (isRoleAtLeast(user.role_level, ROLE_LEVELS.ceo) && user.company_id) {
      // Load company for CEO
      const companyResponse = await apiClient.getCompany(user.company_id)
      if (companyResponse.data) {
        const company = companyResponse.data as Company
        this.storeCompany(company)
        this.session = { user, company, isSupabaseAuth }
        return
      }
    }

    if (user.clinic_id) {
      // Load clinic for clinic users
      const clinicResponse = await apiClient.getClinic(user.clinic_id)
      if (clinicResponse.data) {
        const clinic = clinicResponse.data as Clinic
        this.storeClinic(clinic)
        this.session = { user, clinic, isSupabaseAuth }
        return
      }
    }

    // Fallback - user only
    this.session = { user, isSupabaseAuth }
  }

  // ============================================================================
  // AUTHENTICATION METHODS
  // ============================================================================

  async signInWithEmail(email: string, password: string): Promise<boolean> {
    try {
      console.log('[Auth] Email sign in for:', email)
      
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      
      if (error || !data.session) {
        console.error('[Auth] Email sign in failed:', error)
        return false
      }
      
      await this.handleSupabaseSession(data.session)
      return true
      
    } catch (error) {
      console.error('[Auth] Email sign in error:', error)
      return false
    }
  }

  async signUp(email: string, password: string, fullName: string): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('[Auth] Sign up for:', email)

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } }
      })

      if (error) {
        // Check if user already exists
        if (error.message?.toLowerCase().includes('already registered')) {
          // Try to sign in instead
          const signInResult = await this.signInWithEmail(email, password)
          if (signInResult) {
            return { success: true }
          }
          return { success: false, error: 'email_exists_but_wrong_password' }
        }
        return { success: false, error: error.message }
      }

      if (data.session) {
        await this.handleSupabaseSession(data.session)
        return { success: true }
      }

      return { success: false, error: 'no_session_returned' }
      
    } catch (error) {
      console.error('[Auth] Sign up error:', error)
      return { success: false, error: 'unknown_error' }
    }
  }

  async signInWithGoogle(): Promise<void> {
    try {
      console.log('[Auth] Starting Google OAuth')

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid email profile https://www.googleapis.com/auth/calendar',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: true,
        }
      })

      if (error || !data?.url) {
        throw new Error(error?.message || 'No OAuth URL received')
      }

      // Open popup for OAuth
      await this.openOAuthPopup(data.url)
      
    } catch (error) {
      console.error('[Auth] Google sign in error:', error)
      throw error
    }
  }

  async signInClinicUser(username: string, password?: string): Promise<User | null> {
    try {
      console.log('[Auth] Clinic user sign in:', username, 'with password:', !!password)

      const endpoint = password ? '/auth/login' : '/auth/login-no-password'
      const body = password ? { username, password } : { username }
      
      const response = await fetch(`${(apiClient as any).baseUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      
      const data = await response.json()
      
      if (data?.access_token && data?.user) {
        apiClient.setToken(data.access_token)
        return data.user as User
      }
      
      return null
      
    } catch (error) {
      console.error('[Auth] Clinic user sign in error:', error)
      return null
    }
  }

  async signInClinicUserWithGoogle(userId: number): Promise<void> {
    try {
      console.log('[Auth] Starting clinic user Google OAuth for user:', userId)

      // Store pending auth info
      this.storePendingClinicAuth(userId)

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          scopes: 'openid email profile https://www.googleapis.com/auth/calendar',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
          skipBrowserRedirect: true,
        }
      })

      if (error || !data?.url) {
        this.clearPendingClinicAuth()
        throw new Error(error?.message || 'No OAuth URL received')
      }

      await this.openOAuthPopup(data.url)
      
        } catch (error) {
      this.clearPendingClinicAuth()
      console.error('[Auth] Clinic Google sign in error:', error)
      throw error
    }
  }

  private async completePendingClinicAuth(userId: number): Promise<void> {
    try {
      console.log('[Auth] Completing pending clinic auth for user:', userId)
      
      this.clearPendingClinicAuth()

      const userResponse = await apiClient.getUser(userId)
      if (!userResponse.data) {
        throw new Error('User not found')
      }

      const user = userResponse.data as User
      const clinic = this.getStoredClinic()

      if (!clinic) {
        throw new Error('No clinic context')
      }

      // Build session with proper context
      const newSession: AuthSession = { user, clinic }
      
      // CEOs keep their Supabase auth, clinic workers don't need it
      if (isRoleAtLeast(user.role_level, ROLE_LEVELS.ceo)) {
        newSession.isSupabaseAuth = true
        // Load company context for CEO
        if (user.company_id) {
          const companyResponse = await apiClient.getCompany(user.company_id)
          if (companyResponse.data) {
            newSession.company = companyResponse.data as Company
            this.storeCompany(companyResponse.data as Company)
          }
        }
      }
      
      this.storeUser(user)
      this.session = newSession
      this.transitionTo(AuthState.AUTHENTICATED)

      // Only sign out from Supabase if NOT a CEO (clinic workers don't need Supabase session)
      if (!isRoleAtLeast(user.role_level, ROLE_LEVELS.ceo)) {
        console.log('[Auth] Signing out from Supabase (clinic worker)')
        setTimeout(() => supabase.auth.signOut(), 100)
      } else {
        console.log('[Auth] Keeping Supabase session (CEO)')
      }
      
        } catch (error) {
      console.error('[Auth] Failed to complete pending clinic auth:', error)
      this.clearSession()
    }
  }

  // ============================================================================
  // SETUP FLOW
  // ============================================================================

  async completeSetup(companyData: any, clinicData: any): Promise<boolean> {
    try {
      console.log('[Auth] Starting setup completion')

      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user?.email) {
        throw new Error('No active Supabase session')
      }

      apiClient.setToken(session.access_token)
      
      // Detect auth provider (google or email)
      const isGoogleAuth = session.user.app_metadata?.provider === 'google' || 
                           session.user.app_metadata?.providers?.includes('google')
      
      console.log('[Auth] Setup for auth provider:', session.user.app_metadata?.provider, 'isGoogle:', isGoogleAuth)
      
      // Create company
      const companyResponse = await apiClient.createCompanyPublic({
        name: companyData.name,
        owner_full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
        contact_email: session.user.email,
        contact_phone: companyData.phone || '',
        address: companyData.address || ''
      })

      if (!companyResponse.data) {
        throw new Error('Failed to create company')
      }

      const company = companyResponse.data as Company
      
      // Create CEO user
      const userResponse = await apiClient.createUserPublic({
        clinic_id: null, 
        company_id: company.id!,
        username: session.user.email.split('@')[0] + '_ceo',
        email: session.user.email,
        password: '',
        role_level: ROLE_LEVELS.ceo,
        full_name: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
        google_account_connected: isGoogleAuth,
        google_account_email: isGoogleAuth ? session.user.email : null,
        is_active: true
      })

      if (!userResponse.data) {
        throw new Error('Failed to create user')
      }

      const user = userResponse.data as User

      // Create first clinic
      await apiClient.createClinic({
        company_id: company.id!,
        name: clinicData.name,
        location: clinicData.location,
        phone_number: clinicData.phone_number,
        email: clinicData.email
      })

      // Set session
      this.storeCompany(company)
      this.storeUser(user)
      this.session = { user, company, isSupabaseAuth: true }
      this.transitionTo(AuthState.AUTHENTICATED)

      console.log('[Auth] Setup completed successfully')
      return true
      
    } catch (error) {
      console.error('[Auth] Setup completion failed:', error)
              return false
            }
  }

  async getSetupData() {
    if (this.state !== AuthState.SETUP_REQUIRED) {
      return null
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) return null

    return {
      email: session.user.email,
      fullName: session.user.user_metadata?.full_name || session.user.email.split('@')[0],
      isGoogleUser: true,
      supabaseSession: session
    }
  }

  // ============================================================================
  // SESSION MANAGEMENT
  // ============================================================================

  setClinicSession(clinic: Clinic, user?: User): void {
    console.log('[Auth] Setting clinic session:', clinic.name, 'with user:', user?.username)

    this.storeClinic(clinic)

    if (user) {
      this.storeUser(user)

      // Build new session preserving company context for CEOs
      const newSession: AuthSession = { clinic, user }

      if (isRoleAtLeast(user.role_level, ROLE_LEVELS.ceo) && this.session?.company) {
          newSession.company = this.session.company
        newSession.isSupabaseAuth = this.session.isSupabaseAuth
      }

      const previousClinicId = this.session?.clinic?.id
      this.session = newSession

      // For CEOs, always force navigation when selecting a clinic
      // This handles cases where they're switching from control center to clinic,
      // or even if they're already "in" that clinic but coming from control center context
      const forceNavigation = isRoleAtLeast(user.role_level, ROLE_LEVELS.ceo) && !!clinic

      console.log('[Auth] Clinic switch:', { previousClinicId, newClinicId: clinic.id, forceNavigation })

      this.transitionTo(AuthState.AUTHENTICATED, forceNavigation)
    } else {
      this.session = { clinic }
      this.transitionTo(AuthState.CLINIC_SELECTED)
    }
  }

  logoutUser(): void {
    console.log('[Auth] Logging out user, preserving clinic context')

    const clinic = this.session?.clinic

    // Clear user data
    this.clearUser()
    apiClient.clearToken()

    if (clinic) {
      // Keep clinic session - force navigation to user selection
      this.session = { clinic }
      this.transitionTo(AuthState.CLINIC_SELECTED, true)
    } else {
      // No clinic context, full logout
      this.clearSession()
    }
  }

  async logoutClinic(): Promise<void> {
    try {
      console.log('[Auth] Logging out from clinic')
      
      // Transition to LOADING state immediately to show loading UI
      this.transitionTo(AuthState.LOADING)
      console.log('[Auth] Transitioned to LOADING state')
      
      const wasSupabaseAuth = this.session?.isSupabaseAuth
      
      // If authenticated via Supabase, sign out from Supabase FIRST
      if (wasSupabaseAuth) {
        console.log('[Auth] Signing out from Supabase')
        try {
          await supabase.auth.signOut()
          console.log('[Auth] Supabase sign out complete')
    } catch (error) {
          console.error('[Auth] Error signing out from Supabase:', error)
        }
      }
      
      // Then clear all local session data
      console.log('[Auth] Clearing session data')
      this.clearClinic()
      this.clearUser()
      apiClient.clearToken()
      this.clearAllStorage()
      
      this.session = null
      console.log('[Auth] Session cleared')
      
      // Small delay to ensure navigation happens smoothly
      await new Promise(resolve => setTimeout(resolve, 50))
      
      console.log('[Auth] Transitioning to UNAUTHENTICATED state')
      this.transitionTo(AuthState.UNAUTHENTICATED)
      console.log('[Auth] Logout complete')
    } catch (error) {
      console.error('[Auth] Error during logout:', error)
      // Ensure we still transition to unauthenticated even on error
      this.clearAllStorage()
      this.session = null
      this.transitionTo(AuthState.UNAUTHENTICATED)
    }
  }

  signOut(): void {
    console.log('[Auth] Full sign out')
    
    this.clearSession()
    apiClient.clearToken()
    supabase.auth.signOut()
  }

  private clearSession(): void {
    this.clearAllStorage()
    this.session = null
    this.transitionTo(AuthState.UNAUTHENTICATED)
  }

  // ============================================================================
  // OAUTH POPUP HANDLING
  // ============================================================================

  private openOAuthPopup(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const popup = window.open(
        url,
        'google-oauth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      )

      if (!popup) {
        reject(new Error('Popup blocked - please allow popups for this site'))
        return
      }

      // Check if popup closed
      // Note: popup.closed may be blocked by COOP when navigating to external domains
      const checkClosed = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(checkClosed)
            clearTimeout(timeout)
            window.removeEventListener('message', messageHandler)
            reject(new Error('Popup closed by user'))
          }
        } catch (e) {
          // COOP blocks access to popup.closed when on external domain - this is expected
          // We'll rely on the message handler instead
        }
      }, 1000)

      // Timeout after 2 minutes
      const timeout = setTimeout(() => {
        clearInterval(checkClosed)
        window.removeEventListener('message', messageHandler)
        try {
          popup.close()
        } catch (e) {
          console.warn('[Auth] Could not close popup on timeout:', e)
        }
        reject(new Error('OAuth timeout'))
      }, 120000)

      const messageHandler = async (event: MessageEvent) => {
        // Accept messages from same-origin, file://, and about:blank (Electron dev)
        const isSameOrigin = event.origin === window.location.origin
        const isFileProtocol = window.location.origin === 'file://' || event.origin === 'file://'
        const isBlank = event.origin === 'null' || event.origin === ''
        if (!isSameOrigin && !isFileProtocol && !isBlank) return

        if (event.data.type === 'OAUTH_SUCCESS') {
          clearInterval(checkClosed)
          clearTimeout(timeout)
          window.removeEventListener('message', messageHandler)
          
          // Close popup immediately
          try {
            popup.close()
          } catch (e) {
            console.warn('[Auth] Could not close popup:', e)
          }

          // Small delay to ensure popup closes before we navigate
          await new Promise(resolve => setTimeout(resolve, 200))

          try {
            await this.handleSupabaseSession(event.data.session)
            resolve()
          } catch (error) {
            reject(error)
          }
        } else if (event.data.type === 'OAUTH_ERROR') {
          clearInterval(checkClosed)
          clearTimeout(timeout)
          window.removeEventListener('message', messageHandler)
          
          try {
            popup.close()
          } catch (e) {
            console.warn('[Auth] Could not close popup:', e)
          }
          
          reject(new Error(event.data.error))
        }
      }

      window.addEventListener('message', messageHandler)
    })
  }

  // ============================================================================
  // STATE MACHINE
  // ============================================================================

  private transitionTo(newState: AuthState, forceNavigation = false): void {
    const oldState = this.state
    
    if (oldState === newState && !forceNavigation) {
      console.log('[Auth] Already in state:', newState, '- skipping transition and navigation')
      return
    }

    console.log('[Auth] State transition:', oldState, '->', newState, forceNavigation ? '(forced)' : '')
    
    // Update state if different
    if (oldState !== newState) {
      this.state = newState
    }
    
    this.notifyListeners()

    // Navigate after state update (synchronous)
    // Always navigate if forceNavigation is true, even in same state
    if (forceNavigation || newState !== AuthState.LOADING) {
      this.navigate()
    }
  }

  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.state, this.session)
      } catch (error) {
        console.error('[Auth] Listener error:', error)
      }
    })
  }

  private navigate(): void {
    // Don't navigate if we're in a popup window (OAuth callback)
    if (window.opener) {
      console.log('[Auth] Skipping navigation - in popup window')
      return
    }

    console.log('[Auth] Navigating for state:', this.state)

    // Try to get current path from router first, fallback to window.location
    let currentPath = window.location.pathname
    try {
      if (router?.state?.location?.pathname) {
        currentPath = router.state.location.pathname
      }
    } catch (error) {
      console.log('[Auth] Could not get path from router, using window.location')
    }

    console.log('[Auth] Current path:', currentPath)

    try {
      switch (this.state) {
        case AuthState.UNAUTHENTICATED:
          if (currentPath !== '/control-center') {
            console.log('[Auth] Navigating to control center from:', currentPath)
            const navResult = router.navigate({ 
              to: '/control-center',
              replace: true  // Replace history instead of push
            })
            if (navResult && typeof navResult.then === 'function') {
              navResult.catch((err: Error) => {
                console.error('[Auth] Navigation failed:', err)
              })
            }
          } else {
            console.log('[Auth] Already on control center page')
          }
          break

        case AuthState.CLINIC_SELECTED:
          if (currentPath !== '/user-selection') {
            console.log('[Auth] Navigating to user selection from:', currentPath)
            router.navigate({ 
              to: '/user-selection',
              replace: true
            })
          }
          break

        case AuthState.AUTHENTICATED:
          if (this.session?.clinic) {
            // Clinic user context - go to dashboard
            // Navigate if not already on a clinic page OR coming from control center
            const isOnClinicPage = currentPath.startsWith('/dashboard') || 
                                   currentPath.startsWith('/clients') ||
                                   currentPath.startsWith('/exams') ||
                                   currentPath.startsWith('/orders') ||
                                   currentPath.startsWith('/appointments') ||
                                   currentPath.startsWith('/referrals') ||
                                   currentPath.startsWith('/files') ||
                                   currentPath.startsWith('/settings') ||
                                   currentPath.startsWith('/campaigns') ||
                                   currentPath.startsWith('/ai-assistant') ||
                                   currentPath.startsWith('/worker-stats')
            const isComingFromControlCenter = currentPath.startsWith('/control-center')
            
            if (!isOnClinicPage || isComingFromControlCenter) {
              console.log('[Auth] Navigating to clinic dashboard from:', currentPath)
              const navResult = router.navigate({ to: '/dashboard' })
              if (navResult && typeof navResult.then === 'function') {
                navResult.catch((err: Error) => {
                  console.error('[Auth] Dashboard navigation failed:', err)
                })
              }
            } else {
              console.log('[Auth] Already on clinic page, skipping navigation')
            }
          } else if (isRoleAtLeast(this.session?.user?.role_level, ROLE_LEVELS.ceo)) {
            // CEO context - go to control center dashboard
            if (!currentPath.startsWith('/control-center/dashboard')) {
              console.log('[Auth] Navigating to control center dashboard from:', currentPath)
              const navResult = router.navigate({
                to: '/control-center/dashboard',
                search: {
                  companyId: this.session.company?.id?.toString() || '',
                  companyName: this.session.company?.name || '',
                  fromSetup: 'false'
                }
              })
              if (navResult && typeof navResult.then === 'function') {
                navResult.catch((err: Error) => {
                  console.error('[Auth] Control center navigation failed:', err)
                })
              }
            } else {
              console.log('[Auth] Already on control center dashboard, skipping navigation')
            }
          }
          break

        case AuthState.SETUP_REQUIRED:
          if (currentPath !== '/control-center') {
            console.log('[Auth] Navigating to control center for setup from:', currentPath)
            router.navigate({ to: '/control-center' })
          }
          break
      }
    } catch (error) {
      console.error('[Auth] Navigation failed:', error)
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.push(listener)
    
    // Immediately notify with current state
    if (this.initialized) {
      listener(this.state, this.session)
    }
    
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  getAuthState(): AuthState {
    return this.state
  }

  getSession(): AuthSession | null {
    return this.session
  }

  isInitialized(): boolean {
    return this.initialized
  }

  // ============================================================================
  // LOCAL STORAGE HELPERS
  // ============================================================================

  private hasClinicContext(): boolean {
    return !!this.session?.clinic
  }

  private getStoredUser(): User | null {
    try {
      const stored = localStorage.getItem('currentUser')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  private storeUser(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user))
    localStorage.setItem('currentUserId', user.id!.toString())
  }

  private clearUser(): void {
    localStorage.removeItem('currentUser')
    localStorage.removeItem('currentUserId')
  }

  private getStoredClinic(): Clinic | null {
    try {
      const stored = localStorage.getItem('selectedClinic')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  private storeClinic(clinic: Clinic): void {
    localStorage.setItem('selectedClinic', JSON.stringify(clinic))
  }

  private clearClinic(): void {
    localStorage.removeItem('selectedClinic')
  }

  private storeCompany(company: Company): void {
    localStorage.setItem('controlCenterCompany', JSON.stringify(company))
  }

  private getPendingClinicUserId(): number | null {
    try {
      const stored = localStorage.getItem('pendingClinicUserId')
      const isClinicAuth = localStorage.getItem('isClinicGoogleAuth')
      return stored && isClinicAuth ? parseInt(stored, 10) : null
    } catch {
      return null
    }
  }

  private storePendingClinicAuth(userId: number): void {
    localStorage.setItem('pendingClinicUserId', userId.toString())
    localStorage.setItem('isClinicGoogleAuth', 'true')
  }

  private clearPendingClinicAuth(): void {
    localStorage.removeItem('pendingClinicUserId')
    localStorage.removeItem('isClinicGoogleAuth')
  }

  private clearAllStorage(): void {
    const keys = [
      'currentUser',
      'currentUserId',
      'selectedClinic',
      'controlCenterCompany',
      'auth_token',
      'pendingClinicUserId',
      'isClinicGoogleAuth'
    ]
    keys.forEach(key => localStorage.removeItem(key))
  }
}

export const authService = new AuthService()