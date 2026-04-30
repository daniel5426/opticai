import { apiClient, AuthPayload, AuthResult, SetupRequiredPayload } from '@/lib/api-client'
import { User, Company, Clinic } from '@/lib/db/schema-interface'
import { ROLE_LEVELS, isRoleAtLeast } from '@/lib/role-levels'

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
}

type StateChangeListener = (state: AuthState, session: AuthSession | null) => void

class AuthService {
  private state: AuthState = AuthState.LOADING
  private session: AuthSession | null = null
  private listeners: StateChangeListener[] = []
  private initialized = false
  private router: any = null
  private routerHistory: any = null
  private isHandlingUnauthorized = false

  constructor() {
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      const token = localStorage.getItem('auth_token')
      if (token) {
        const response = await apiClient.getCurrentSession({ suppressUnauthorized: true })
        if (response.data?.user) {
          this.applySession({
            user: response.data.user,
            company: response.data.company || undefined,
            clinic: this.getStoredClinic() || response.data.clinic || undefined,
          }, false)
          this.initialized = true
          return
        }
      }

      const clinic = this.getStoredClinic()
      if (clinic && apiClient.getClinicTrustToken()) {
        this.session = { clinic }
        this.transitionTo(AuthState.CLINIC_SELECTED)
      } else {
        this.clearAllStorage()
        this.transitionTo(AuthState.UNAUTHENTICATED)
      }
    } catch {
      this.clearAllStorage()
      this.transitionTo(AuthState.UNAUTHENTICATED)
    } finally {
      this.setupUnauthorizedListener()
      this.initialized = true
    }
  }

  private setupUnauthorizedListener(): void {
    window.addEventListener('auth:unauthorized', () => {
      void this.handleUnauthorized()
    })
  }

  private async handleUnauthorized(): Promise<void> {
    if (this.isHandlingUnauthorized) return
    this.isHandlingUnauthorized = true
    try {
      const response = await apiClient.getCurrentSession({ suppressUnauthorized: true })
      if (response.data?.user) {
        this.applySession({
          user: response.data.user,
          company: response.data.company || undefined,
          clinic: this.getStoredClinic() || response.data.clinic || undefined,
        })
        return
      }

      const clinic = this.session?.clinic || this.getStoredClinic()
      this.clearUser()
      apiClient.clearToken()
      if (clinic && apiClient.getClinicTrustToken()) {
        this.session = { clinic }
        this.transitionTo(AuthState.CLINIC_SELECTED, true)
      } else {
        this.clearSession()
      }
    } finally {
      this.isHandlingUnauthorized = false
    }
  }

  async signInWithEmail(email: string, password: string): Promise<boolean> {
    const response = await apiClient.loginPassword({ identifier: email, password })
    if (!response.data || response.error) return false
    this.handleAuthResult(response.data)
    return response.data.status === 'authenticated'
  }

  async signUp(email: string, password: string, fullName: string): Promise<{ success: boolean; status?: 'authenticated' | 'setup_required' | 'pending_confirmation' | 'error'; error?: string }> {
    const response = await apiClient.registerStart({ email, password, full_name: fullName })
    if (!response.data || response.error) {
      return { success: false, status: 'error', error: response.error }
    }
    this.storePendingSetup(response.data)
    this.transitionTo(AuthState.SETUP_REQUIRED)
    return { success: true, status: 'setup_required' }
  }

  async signInWithGoogle(): Promise<void> {
    const result = await window.electronAPI.googleOAuthAuthenticate()
    if (result.success === false || !result.tokens?.access_token) {
      throw new Error(result.error || 'Google authentication failed')
    }
    const response = await apiClient.loginGoogle({
      access_token: result.tokens.access_token,
      refresh_token: result.tokens.refresh_token,
      id_token: result.tokens.id_token,
      user_info: result.userInfo,
    })
    if (!response.data || response.error) {
      throw new Error(response.error || 'Google login failed')
    }
    this.handleAuthResult(response.data)
  }

  getClinicDeviceId(): string {
    const key = 'clinicDeviceId'
    const existing = localStorage.getItem(key)
    if (existing) return existing
    const id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`
    localStorage.setItem(key, id)
    return id
  }

  async createClinicTrustSession(clinicUniqueId: string, pin: string): Promise<Clinic | null> {
    const response = await apiClient.createClinicSession({
      clinic_unique_id: clinicUniqueId,
      pin,
      device_id: this.getClinicDeviceId()
    })
    if (!response.data?.clinic_trust_token || !response.data.clinic) return null
    apiClient.setClinicTrustToken(response.data.clinic_trust_token)
    this.storeClinic(response.data.clinic as Clinic)
    return response.data.clinic as Clinic
  }

  async signInClinicUser(username: string, password?: string): Promise<User | null> {
    const clinic = this.session?.clinic || this.getStoredClinic()
    const clinicTrustToken = apiClient.getClinicTrustToken()
    if (!clinic || !clinicTrustToken) return null

    const response = password
      ? await apiClient.loginPassword(
          { identifier: username, password, clinic_id: clinic.id, device_id: this.getClinicDeviceId() },
          clinicTrustToken
        )
      : await apiClient.loginQuick(
          { username, device_id: this.getClinicDeviceId() },
          clinicTrustToken
        )
    if (!response.data || response.error || response.data.status !== 'authenticated') return null
    this.storeAuthPayload(response.data)
    return response.data.user as User
  }

  async signInClinicUserWithGoogle(userId: number): Promise<void> {
    const clinic = this.session?.clinic || this.getStoredClinic()
    const clinicTrustToken = apiClient.getClinicTrustToken()
    if (!clinic || !clinicTrustToken) throw new Error('Missing clinic trust session')

    const result = await window.electronAPI.googleOAuthAuthenticate()
    if (result.success === false || !result.tokens?.access_token) {
      throw new Error(result.error || 'Google authentication failed')
    }
    const response = await apiClient.loginGoogle({
      access_token: result.tokens.access_token,
      refresh_token: result.tokens.refresh_token,
      id_token: result.tokens.id_token,
      user_id: userId,
      device_id: this.getClinicDeviceId(),
      user_info: result.userInfo,
    }, clinicTrustToken)
    if (!response.data || response.error || response.data.status !== 'authenticated') {
      throw new Error(response.error || 'Clinic Google login failed')
    }
    this.storeAuthPayload(response.data)
    this.setClinicSession(clinic, response.data.user)
  }

  async completeSetup(companyData: any, clinicData: any): Promise<boolean> {
    const setup = this.getPendingSetup()
    if (!setup?.setup_token) return false
    const response = await apiClient.registerComplete({
      setup_token: setup.setup_token,
      company: {
        name: companyData.name,
        owner_full_name: setup.full_name || setup.email?.split('@')[0],
        contact_email: setup.email,
        contact_phone: companyData.phone || '',
        address: companyData.address || ''
      },
      clinic: {
        name: clinicData.name,
        location: clinicData.location,
        phone_number: clinicData.phone_number,
        email: clinicData.email || setup.email
      }
    })
    if (!response.data || response.error) return false
    this.clearPendingSetup()
    this.handleAuthPayload(response.data)
    return true
  }

  async getSetupData() {
    if (this.state !== AuthState.SETUP_REQUIRED) return null
    const setup = this.getPendingSetup()
    if (!setup) return null
    return {
      email: setup.email,
      fullName: setup.full_name || setup.email?.split('@')[0],
      isGoogleUser: setup.auth_provider === 'google',
    }
  }

  setClinicSession(clinic: Clinic, user?: User): void {
    this.storeClinic(clinic)
    if (user) {
      this.storeUser(user)
      const company = this.session?.company || this.getStoredCompany()
      this.applySession({ user, clinic, company }, true)
    } else {
      this.session = { clinic }
      this.transitionTo(AuthState.CLINIC_SELECTED)
    }
  }

  logoutUser(): void {
    const clinic = this.session?.clinic || this.getStoredClinic()
    void apiClient.logout()
    this.clearUser()
    apiClient.clearToken()
    if (clinic && apiClient.getClinicTrustToken()) {
      this.session = { clinic }
      this.transitionTo(AuthState.CLINIC_SELECTED, true)
    } else {
      this.clearSession()
    }
  }

  async logoutClinic(): Promise<void> {
    await apiClient.logout().catch(() => undefined)
    this.clearAllStorage()
    apiClient.clearToken()
    apiClient.clearClinicTrustToken()
    this.session = null
    this.transitionTo(AuthState.UNAUTHENTICATED, true)
  }

  signOut(): void {
    void this.logoutClinic()
  }

  subscribe(listener: StateChangeListener): () => void {
    this.listeners.push(listener)
    listener(this.state, this.session)
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

  hasClinicContext(): boolean {
    return !!this.session?.clinic
  }

  public setRouter(router: any, history: any) {
    this.router = router
    this.routerHistory = history
  }

  private handleAuthResult(result: AuthResult): void {
    if (result.status === 'setup_required') {
      this.storePendingSetup(result)
      this.transitionTo(AuthState.SETUP_REQUIRED)
      return
    }
    this.handleAuthPayload(result)
  }

  private handleAuthPayload(payload: AuthPayload): void {
    this.storeAuthPayload(payload)
    this.applySession({
      user: payload.user,
      company: payload.company || undefined,
      clinic: payload.clinic || this.getStoredClinic() || undefined,
    }, true)
  }

  private storeAuthPayload(payload: AuthPayload): void {
    apiClient.setSessionTokens(payload.access_token, payload.refresh_token)
    this.storeUser(payload.user)
    if (payload.company) this.storeCompany(payload.company)
    if (payload.clinic) this.storeClinic(payload.clinic)
  }

  private applySession(session: AuthSession, forceNavigation = false): void {
    this.session = session
    if (session.user) this.storeUser(session.user)
    if (session.company) this.storeCompany(session.company)
    if (session.clinic) this.storeClinic(session.clinic)
    this.transitionTo(AuthState.AUTHENTICATED, forceNavigation)
  }

  private transitionTo(newState: AuthState, forceNavigation = false): void {
    const oldState = this.state
    if (oldState === newState && !forceNavigation) {
      this.notifyListeners()
      return
    }
    this.state = newState
    this.notifyListeners()
    if (newState !== AuthState.LOADING || forceNavigation) {
      this.navigate(forceNavigation)
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

  private navigate(forceNavigation = false): void {
    if (!this.router) return
    let currentPath = window.location.pathname
    try {
      currentPath = this.router.state?.location?.pathname || currentPath
    } catch {}

    if (!forceNavigation) {
      const storedPath = this.getStoredPath()
      if (storedPath && this.shouldRestorePath(storedPath, currentPath) && this.restoreStoredPath(storedPath)) {
        return
      }
    }

    if (this.state === AuthState.UNAUTHENTICATED && currentPath !== '/control-center') {
      void this.router.navigate({ to: '/control-center', replace: true })
      return
    }
    if (this.state === AuthState.CLINIC_SELECTED && currentPath !== '/user-selection') {
      void this.router.navigate({ to: '/user-selection', replace: true })
      return
    }
    if (this.state === AuthState.SETUP_REQUIRED && currentPath !== '/control-center') {
      void this.router.navigate({ to: '/control-center' })
      return
    }
    if (this.state !== AuthState.AUTHENTICATED || !this.session?.user) return

    if (this.session.clinic) {
      const isOnClinicPage = [
        '/dashboard',
        '/clients',
        '/exams',
        '/orders',
        '/appointments',
        '/referrals',
        '/files',
        '/settings',
        '/campaigns',
        '/ai-assistant',
        '/worker-stats',
      ].some(prefix => currentPath.startsWith(prefix))
      if (forceNavigation || !isOnClinicPage || currentPath.startsWith('/control-center')) {
        void this.router.navigate({
          to: '/dashboard',
          replace: true,
          search: {
            clinicId: this.session.clinic.id?.toString(),
            refresh: Date.now().toString(),
          }
        })
      }
      return
    }

    if (isRoleAtLeast(this.session.user.role_level, ROLE_LEVELS.ceo)) {
      if (forceNavigation || !currentPath.startsWith('/control-center/dashboard')) {
        void this.router.navigate({
          to: '/control-center/dashboard',
          search: {
            companyId: this.session.company?.id?.toString() || '',
            companyName: this.session.company?.name || '',
            fromSetup: 'false'
          }
        })
      }
    }
  }

  private storeUser(user: User): void {
    localStorage.setItem('currentUser', JSON.stringify(user))
    if (user.id) localStorage.setItem('currentUserId', user.id.toString())
  }

  private clearUser(): void {
    localStorage.removeItem('currentUser')
    localStorage.removeItem('currentUserId')
  }

  private storeClinic(clinic: Clinic): void {
    localStorage.setItem('selectedClinic', JSON.stringify(clinic))
  }

  private getStoredClinic(): Clinic | null {
    try {
      const stored = localStorage.getItem('selectedClinic')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  private storeCompany(company: Company): void {
    localStorage.setItem('controlCenterCompany', JSON.stringify(company))
  }

  private getStoredCompany(): Company | null {
    try {
      const stored = localStorage.getItem('controlCenterCompany')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  private storePendingSetup(setup: SetupRequiredPayload): void {
    localStorage.setItem('pendingCompanySetup', JSON.stringify(setup))
  }

  private getPendingSetup(): SetupRequiredPayload | null {
    try {
      const stored = localStorage.getItem('pendingCompanySetup')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  }

  private clearPendingSetup(): void {
    localStorage.removeItem('pendingCompanySetup')
  }

  private clearSession(): void {
    this.clearAllStorage()
    this.session = null
    this.transitionTo(AuthState.UNAUTHENTICATED)
  }

  private clearAllStorage(): void {
    [
      'currentUser',
      'currentUserId',
      'selectedClinic',
      'controlCenterCompany',
      'auth_token',
      'auth_refresh_token',
      'clinicTrustToken',
      'pendingCompanySetup',
      'pendingClinicUserId',
      'isClinicGoogleAuth',
      'lastAppPath',
      'lastAppContext',
    ].forEach(key => localStorage.removeItem(key))
    Object.keys(localStorage)
      .filter(key => key.startsWith('sb-'))
      .forEach(key => localStorage.removeItem(key))
  }

  private getStoredPath(): string | null {
    try {
      return localStorage.getItem('lastAppPath')
    } catch {
      return null
    }
  }

  private shouldRestorePath(storedPath: string, currentPath: string): boolean {
    if (!storedPath || storedPath === currentPath) return false
    if (storedPath === '/auth/callback' || storedPath === '/oauth/callback') return false
    if (this.state === AuthState.UNAUTHENTICATED || this.state === AuthState.SETUP_REQUIRED) return false
    if (this.state === AuthState.CLINIC_SELECTED) return storedPath === '/user-selection'
    return storedPath !== '/control-center'
  }

  private restoreStoredPath(path: string): boolean {
    try {
      if (!this.routerHistory) return false
      this.routerHistory.replace(path)
      return true
    } catch {
      return false
    }
  }
}

export const authService = new AuthService()
