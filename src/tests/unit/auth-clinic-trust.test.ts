import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { User } from '@/lib/db/schema-interface'

vi.unmock('@/lib/api-client')

const clinic = { id: 33, company_id: 1, name: 'Clinic', unique_id: 'clinic-33', location: '', has_entry_pin: true }
const worker = { id: 7, username: 'worker', full_name: 'Worker', clinic_id: 33, company_id: 1, role_level: 1 as const }
const ceo = { ...worker, id: 8, username: 'owner', role_level: 4 as const }
const payload = (user: User = worker) => ({ status: 'authenticated', user, clinic, access_token: 'access', refresh_token: 'refresh', token_type: 'bearer', expires_in: 900 })
const response = (status: number, data: unknown) => ({ ok: status < 400, status, json: async () => data })
const request = vi.fn()
let apiClient: typeof import('@/lib/api-client').apiClient
let auth: typeof import('@/lib/auth/AuthService')

beforeEach(async () => {
  vi.resetModules()
  localStorage.clear()
  localStorage.setItem('selectedClinic', JSON.stringify(clinic))
  localStorage.setItem('clinicTrustToken', 'preserved-trust')
  localStorage.setItem('clinicDeviceId', 'same-device')
  request.mockReset().mockImplementation(async (url: string) => {
    if (url.endsWith('/auth/logout')) return response(200, { ok: true })
    throw new Error(`Unexpected request: ${url}`)
  })
  vi.stubGlobal('fetch', request)
  apiClient = (await import('@/lib/api-client')).apiClient
  auth = await import('@/lib/auth/AuthService')
})
afterEach(() => vi.unstubAllGlobals())

it('keeps the proven clinic token through CEO login, user logout, and window-close logout', async () => {
  request.mockImplementation(async (url: string) => {
    if (url.endsWith('/login/password')) return response(200, payload(ceo))
    if (url.endsWith('/logout')) return response(200, {})
    throw new Error(`Trust must not be rotated: ${url}`)
  })
  const user = await auth.authService.signInClinicUser('owner', 'correct-password')
  auth.authService.setClinicSession(clinic, user!)
  await auth.authService.logoutUser()
  await auth.authService.logoutUser()
  expect(localStorage.getItem('clinicTrustToken')).toBe('preserved-trust')
  expect(auth.authService.getAuthState()).toBe('clinic_selected')
  expect(request.mock.calls.some(([url]) => url.includes('/clinic/trust'))).toBe(false)
})

it('does not invalidate the saved token when a redundant renewal response would be lost', async () => {
  let serverTrust = 'preserved-trust'
  request.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/trust/authenticated')) {
      serverTrust = 'rotated-but-response-lost'
      return new Promise(() => {})
    }
    const token = (options.headers as Record<string, string>).Authorization
    return Promise.resolve(token === `Bearer ${serverTrust}`
      ? response(200, payload(ceo)) : response(401, { detail: 'Invalid clinic trust' }))
  })
  auth.authService.setClinicSession(clinic, ceo)
  expect(await auth.authService.signInClinicUser('owner', 'correct-password')).toMatchObject(ceo)
  expect(serverTrust).toBe('preserved-trust')
})

it.each(['quick', 'password'])('recognizes invalid clinic trust during %s login without blaming the password or logging out', async method => {
  request.mockImplementation(async (url: string) => url.endsWith('/clinic/trust')
    ? response(400, { detail: 'Clinic PIN is required' })
    : response(401, { detail: 'Invalid clinic trust' }))
  await expect(auth.authService.signInClinicUser('worker', method === 'password' ? 'correct-password' : undefined))
    .rejects.toBeInstanceOf(auth.ClinicTrustRequiredError)
  expect(localStorage.getItem('clinicTrustToken')).toBe('preserved-trust')
  expect(JSON.parse(localStorage.getItem('selectedClinic')!).id).toBe(33)
  expect(request.mock.calls.some(([url]) => url.endsWith('/logout'))).toBe(false)
  if (method === 'password') expect(JSON.parse(request.mock.calls[0][1].body).clinic_id).toBe(33)
})

it('recovers existing stale trust using the clinic PIN and retries the same user without clinic logout', async () => {
  request.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith('/clinic/trust')) {
      const body = JSON.parse(options.body as string)
      return body.pin === '1234'
        ? response(200, { clinic, clinic_trust_token: 'repaired-trust' })
        : response(400, { detail: 'Clinic PIN is required' })
    }
    return (options.headers as Record<string, string>).Authorization === 'Bearer repaired-trust'
      ? response(200, payload()) : response(401, { detail: 'Invalid clinic trust' })
  })
  await expect(auth.authService.signInClinicUser('worker')).rejects.toBeInstanceOf(auth.ClinicTrustRequiredError)
  await auth.authService.createClinicTrustSession('clinic-33', '1234')
  expect(await auth.authService.signInClinicUser('worker')).toMatchObject(worker)
  expect(auth.authService.getSession()?.clinic?.id).toBe(33)
  expect(localStorage.getItem('clinicTrustToken')).toBe('repaired-trust')
})

it('automatically recovers a clinic without a PIN and retries only once', async () => {
  request.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith('/clinic/trust')) return response(200, { clinic, clinic_trust_token: 'repaired-trust' })
    return (options.headers as Record<string, string>).Authorization === 'Bearer repaired-trust'
      ? response(200, payload()) : response(401, { detail: 'Invalid clinic trust' })
  })
  expect(await auth.authService.signInClinicUser('worker')).toMatchObject(worker)
  expect(request.mock.calls).toHaveLength(3)
  expect(request.mock.calls[2][1].headers.Authorization).toBe('Bearer repaired-trust')
  expect(request.mock.calls.some(([url]) => url.endsWith('/logout'))).toBe(false)
})

it('does not loop when newly issued clinic trust is rejected again', async () => {
  request.mockImplementation(async (url: string) => url.endsWith('/clinic/trust')
    ? response(200, { clinic, clinic_trust_token: 'repaired-trust' })
    : response(401, { detail: 'Invalid clinic trust' }))
  await expect(auth.authService.signInClinicUser('worker')).rejects.toBeInstanceOf(auth.ClinicTrustRequiredError)
  expect(request.mock.calls).toHaveLength(3)
})

it('distinguishes actual invalid passwords from server errors without issuing trust', async () => {
  request.mockResolvedValueOnce(response(401, { detail: 'Invalid credentials' }))
  expect(await auth.authService.signInClinicUser('worker', 'wrong')).toBeNull()
  request.mockResolvedValueOnce(response(503, { detail: 'Service unavailable' }))
  await expect(auth.authService.signInClinicUser('worker', 'correct')).rejects.toThrow('Service unavailable')
  expect(request.mock.calls).toHaveLength(2)
})

it('single-flights initial CEO clinic trust creation across selection and logout', async () => {
  apiClient.clearClinicTrustToken()
  let finish!: (value: unknown) => void
  request.mockImplementation((url: string) => url.endsWith('/trust/authenticated')
    ? new Promise(resolve => { finish = resolve }) : Promise.resolve(response(200, {})))
  auth.authService.setClinicSession(clinic, ceo)
  const logout = auth.authService.logoutUser()
  expect(request.mock.calls.filter(([url]) => url.endsWith('/trust/authenticated'))).toHaveLength(1)
  finish(response(200, { clinic, clinic_trust_token: 'initial-trust' }))
  await logout
  expect(localStorage.getItem('clinicTrustToken')).toBe('initial-trust')
  expect(auth.authService.getAuthState()).toBe('clinic_selected')
})

it('discards an in-flight trust response after clinic logout', async () => {
  apiClient.clearClinicTrustToken()
  let finish!: (value: unknown) => void
  request.mockImplementation((url: string) => url.endsWith('/trust/authenticated')
    ? new Promise(resolve => { finish = resolve }) : Promise.resolve(response(200, {})))
  auth.authService.setClinicSession(clinic, ceo)
  await auth.authService.logoutClinic()
  finish(response(200, { clinic, clinic_trust_token: 'late-trust' }))
  await new Promise(resolve => setTimeout(resolve, 0))
  expect(localStorage.getItem('clinicTrustToken')).toBeNull()
  expect(auth.authService.getSession()).toBeNull()
})

it('binds legacy trust to its original clinic and reads credentials updated by another renderer', () => {
  expect(apiClient.getClinicTrustToken(33)).toBe('preserved-trust')
  expect(apiClient.getClinicTrustToken(44)).toBeNull()
  auth.authService.setClinicSession({ ...clinic, id: 44 })
  expect(apiClient.getClinicTrustToken(44)).toBeNull()
  localStorage.setItem('clinicTrustToken', 'other-renderer-trust')
  localStorage.setItem('clinicTrustClinicId', '44')
  expect(apiClient.getClinicTrustToken(44)).toBe('other-renderer-trust')
  expect(apiClient.getClinicTrustToken(33)).toBeNull()
})

it('retries Google login with the selected user and existing OAuth result after trust recovery', async () => {
  const googleOAuthAuthenticate = vi.fn(async () => ({ tokens: { access_token: 'google-access' } }))
  vi.stubGlobal('electronAPI', { googleOAuthAuthenticate })
  request.mockImplementation(async (url: string, options: RequestInit) => {
    if (url.endsWith('/clinic/trust')) return response(200, { clinic, clinic_trust_token: 'repaired-trust' })
    expect(JSON.parse(options.body as string).user_id).toBe(7)
    return (options.headers as Record<string, string>).Authorization === 'Bearer repaired-trust'
      ? response(200, payload()) : response(401, { detail: 'Invalid clinic trust' })
  })
  await auth.authService.signInClinicUserWithGoogle(7)
  expect(googleOAuthAuthenticate).toHaveBeenCalledTimes(1)
  expect(auth.authService.getSession()?.user?.id).toBe(7)
})

it('single-flights simultaneous stale-trust recovery so responses cannot overwrite a newer token', async () => {
  let finish!: (value: unknown) => void
  request.mockImplementation((url: string, options: RequestInit) => {
    if (url.endsWith('/clinic/trust')) return new Promise(resolve => { finish = resolve })
    const repaired = (options.headers as Record<string, string>).Authorization === 'Bearer repaired-trust'
    return Promise.resolve(repaired ? response(200, payload()) : response(401, { detail: 'Invalid clinic trust' }))
  })
  const first = auth.authService.signInClinicUser('worker')
  const second = auth.authService.signInClinicUser('worker')
  await vi.waitFor(() => expect(finish).toBeDefined())
  expect(request.mock.calls.filter(([url]) => url.endsWith('/clinic/trust'))).toHaveLength(1)
  finish(response(200, { clinic, clinic_trust_token: 'repaired-trust' }))
  await expect(Promise.all([first, second])).resolves.toEqual([worker, worker])
})

it('does not restore a previous clinic after a late login failure arrives following a clinic switch', async () => {
  let finish!: (value: unknown) => void
  request.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  const login = auth.authService.signInClinicUser('worker')
  auth.authService.setClinicSession({ ...clinic, id: 44, unique_id: 'clinic-44' })
  finish(response(401, { detail: 'Invalid clinic trust' }))
  await expect(login).rejects.toThrow('Clinic selection changed')
  expect(auth.authService.getSession()?.clinic?.id).toBe(44)
  expect(request.mock.calls).toHaveLength(1)
})
