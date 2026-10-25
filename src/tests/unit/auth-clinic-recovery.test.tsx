import React from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import i18n from '@/localization/i18n'
import UserSelectionPage from '@/pages/UserSelectionPage'
import { authService, ClinicTrustRequiredError } from '@/lib/auth/AuthService'
import { toast } from 'sonner'

vi.mock('@/lib/auth/AuthService', () => ({
  ClinicTrustRequiredError: class ClinicTrustRequiredError extends Error {},
  authService: {
    signInClinicUser: vi.fn(), createClinicTrustSession: vi.fn(),
    setClinicSession: vi.fn(), logoutClinic: vi.fn(),
  },
}))
vi.mock('@/lib/api-client', () => ({ apiClient: {
  getUsersByClinicPublic: vi.fn(async () => ({ data: [
    { id: 7, username: 'worker', full_name: 'Worker', clinic_id: 33, role_level: 1, has_password: true },
  ] })),
} }))
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  localStorage.setItem('selectedClinic', JSON.stringify({ id: 33, name: 'Clinic', unique_id: 'clinic-33' }))
  vi.mocked(authService.signInClinicUser).mockRejectedValue(new ClinicTrustRequiredError())
})
afterEach(() => { cleanup(); vi.restoreAllMocks() })

async function openRecovery(language: string) {
  await i18n.changeLanguage(language)
  render(<I18nextProvider i18n={i18n}><UserSelectionPage /></I18nextProvider>)
  fireEvent.click(await screen.findByText('Worker'))
  fireEvent.change(screen.getByLabelText('הזן סיסמה'), { target: { value: 'correct-password' } })
  fireEvent.click(screen.getByRole('button', { name: 'התחבר' }))
  return screen.findByRole('dialog')
}

describe.each([
  ['he', 'rtl', 'אימות גישה למרפאה', 'קוד המרפאה', 'המשך', 'ביטול'],
  ['en', 'ltr', 'Verify clinic access', 'Clinic PIN', 'Continue', 'Cancel'],
  ['fr', 'ltr', 'Vérifier l’accès à la clinique', 'Code PIN de la clinique', 'Continuer', 'Annuler'],
])('clinic recovery in %s', (language, direction, title, pinLabel, submit, cancel) => {
  it('uses the active portal direction, keeps PIN digits LTR, and retries the original login', async () => {
    const dialog = await openRecovery(language)
    expect(dialog).toHaveAttribute('dir', direction)
    expect(screen.getByRole('heading', { name: title })).toBeVisible()
    const pin = screen.getByLabelText(pinLabel)
    expect(pin).toHaveAttribute('dir', 'ltr')
    expect(pin).toHaveAttribute('type', 'password')
    expect(toast.error).not.toHaveBeenCalled()
    vi.mocked(authService.createClinicTrustSession).mockResolvedValue({ id: 33 } as any)
    vi.mocked(authService.signInClinicUser).mockResolvedValue({ id: 7 } as any)
    fireEvent.change(pin, { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: submit }))
    await waitFor(() => expect(authService.setClinicSession).toHaveBeenCalled())
    expect(authService.createClinicTrustSession).toHaveBeenCalledWith('clinic-33', '1234')
    expect(authService.signInClinicUser).toHaveBeenLastCalledWith('worker', 'correct-password')
    expect(authService.logoutClinic).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('keeps clinic recovery open after a wrong PIN and can cancel without logging out', async () => {
    await openRecovery(language)
    vi.mocked(authService.createClinicTrustSession).mockRejectedValue(new Error('Invalid clinic credentials'))
    fireEvent.change(screen.getByLabelText(pinLabel), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: submit }))
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(i18n.t('authLogin.invalidClinicPin')))
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(authService.signInClinicUser).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: cancel }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Worker' })).toBeVisible()
    expect(screen.getByLabelText('הזן סיסמה')).toHaveValue('')
    expect(authService.logoutClinic).not.toHaveBeenCalled()
  })
})
