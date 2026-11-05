import React from 'react';
import {afterEach, expect, test, vi} from 'vitest';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {ImportedProfileHistory} from '@/components/migration/ImportedProfileHistory';
import i18n from '@/localization/i18n';
const api = vi.hoisted(() => ({getImportedProfileHistory:vi.fn()}));
vi.mock('@/lib/api-client', () => ({apiClient:api}));
afterEach(() => {cleanup(); vi.clearAllMocks();});

test.each(['he','en','fr'])('profile history is a small text disclosure in %s, preserving false and zero', async locale => {
  await i18n.changeLanguage(locale);
  api.getImportedProfileHistory.mockResolvedValue({data:{available:true,values:{zero:0,flag:false,colv:'saved edit'}}});
  const {container}=render(<ImportedProfileHistory clientId={123} />);
  fireEvent.click(await screen.findByRole('button', {name:i18n.t('opticplusCards.profileHistory.button')}));
  const text = await screen.findByText('saved edit');
  expect(text.closest('[dir]')?.getAttribute('dir')).toBe(locale === 'he' ? 'rtl' : 'ltr');
  expect(screen.getByText('0')).toBeTruthy();
  expect(screen.getByText(i18n.t('opticplusCards.no'))).toBeTruthy();
  expect(container.querySelector('.examcard')).toBeNull();
});

test('ordinary clients have no migrated-history button', async () => {
  api.getImportedProfileHistory.mockResolvedValue({data:{available:false,values:{}}});
  render(<ImportedProfileHistory clientId={123} />);
  await vi.waitFor(() => expect(api.getImportedProfileHistory).toHaveBeenCalledWith(123));
  expect(screen.queryByRole('button')).toBeNull();
});
