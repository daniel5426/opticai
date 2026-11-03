import React from 'react';
import '@/localization/i18n';
import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientMedicalRecordTab } from '@/components/client/ClientMedicalRecordTab';

const query = vi.hoisted(() => ({data: undefined as undefined | Array<{id:number;log:string;log_date:string}>, isLoading:true}));
vi.mock('@tanstack/react-router', () => ({useParams:() => ({clientId:'1'})}));
vi.mock('@/contexts/UserContext', () => ({useUser:() => ({currentClinic:{id:65}})}));
vi.mock('@/localization/use-app-locale', () => ({useAppLocale:() => ({direction:'ltr',locale:'en'})}));
vi.mock('@/components/RecordClinicLabel', () => ({RecordClinicLabel:() => null}));
vi.mock('@/components/migration/ImportedSourceDataDialog', () => ({ImportedSourceDataDialog:() => null}));
vi.mock('@/hooks/client/useClientTabQueries', async importOriginal => ({...await importOriginal<typeof import('@/hooks/client/useClientTabQueries')>(),useClientMedicalLogsQuery:() => query}));
afterEach(cleanup);

test('medical history remains stable while query data is absent, then displays loaded notes', () => {
  const client = new QueryClient();
  const view = () => <QueryClientProvider client={client}><ClientMedicalRecordTab /></QueryClientProvider>;
  const {rerender} = render(view());
  expect(screen.getByRole('heading',{name:'גליון רפואי'})).toBeTruthy();
  query.data=[{id:1,log:'203',log_date:'2026-10-27'}];query.isLoading=false;
  rerender(view());
  expect(screen.getByText('203')).toBeTruthy();
});
