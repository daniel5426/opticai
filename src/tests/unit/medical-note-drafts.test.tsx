import React from 'react';
import '@/localization/i18n';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ClientMedicalRecordTab } from '@/components/client/ClientMedicalRecordTab';
const fixture=vi.hoisted(()=>({clientId:'1',query:{data:[{id:1,client_id:1,log:'Saved original',log_date:'2026-11-01'}],isLoading:false}}));
vi.mock('@/lib/db/medical-logs-db',()=>({updateMedicalLog:vi.fn(),createMedicalLog:vi.fn(),deleteMedicalLog:vi.fn()}));
vi.mock('@tanstack/react-router',()=>({useParams:()=>({clientId:fixture.clientId})}));
vi.mock('@/components/RecordClinicLabel',()=>({RecordClinicLabel:()=>null}));
vi.mock('@/components/migration/ImportedSourceDataDialog',()=>({ImportedSourceDataDialog:()=>null}));
vi.mock('@/hooks/client/useClientTabQueries',async original=>({...await original<object>(),useClientMedicalLogsQuery:()=>fixture.query}));
afterEach(()=>{cleanup();fixture.clientId='1';vi.clearAllMocks();});
it('query refresh preserves an existing unsaved medical note in edit mode',()=>{
 const client=new QueryClient();const view=()=> <QueryClientProvider client={client}><ClientMedicalRecordTab/></QueryClientProvider>;
 const result=render(view());
 const note=screen.getByText('Saved original');
 const edit=result.container.querySelector('svg.lucide-pencil')?.closest('button');
 expect(edit).toBeTruthy();fireEvent.click(edit!);
 const input=screen.getByPlaceholderText('הזן את תוכן הרשומה הרפואית...');
 fireEvent.change(input,{target:{value:'Unsaved clinical addition'}});
 expect(input).toHaveValue('Unsaved clinical addition');
 fixture.query.data=[{id:1,client_id:1,log:'Saved original',log_date:'2026-11-02'}];
 result.rerender(view());
 expect(screen.getByDisplayValue('Unsaved clinical addition')).toHaveValue('Unsaved clinical addition');
 expect(screen.getByPlaceholderText('הזן את תוכן הרשומה הרפואית...')).toBeEnabled();
});

it('retains multiple edited notes while refreshed untouched notes update', () => {
  fixture.query.data = [
    { id: 1, client_id: 1, log: 'First saved', log_date: '2026-11-01' },
    { id: 2, client_id: 1, log: 'Second saved', log_date: '2026-11-01' },
    { id: 3, client_id: 1, log: 'Third saved', log_date: '2026-11-01' },
  ];
  const client = new QueryClient();
  const view = () => <QueryClientProvider client={client}><ClientMedicalRecordTab /></QueryClientProvider>;
  const rendered = render(view());
  const edit = rendered.container.querySelectorAll('svg.lucide-pencil');
  fireEvent.click(edit[1].closest('button')!);
  fireEvent.click(edit[2].closest('button')!);
  const inputs = screen.getAllByPlaceholderText('הזן את תוכן הרשומה הרפואית...');
  fireEvent.change(inputs[0], { target: { value: 'First local draft' } });
  fireEvent.change(inputs[1], { target: { value: 'Second local draft' } });
  fixture.query.data = fixture.query.data.map(record => ({ ...record, log: 'Updated ' + record.id }));
  rendered.rerender(view());
  expect(screen.getByDisplayValue('First local draft')).toBeInTheDocument();
  expect(screen.getByDisplayValue('Second local draft')).toBeInTheDocument();
  expect(screen.getByText('Updated 3')).toBeInTheDocument();
});

it('keeps a draft protected during save and updates only that note on success', async () => {
  const { updateMedicalLog } = await import('@/lib/db/medical-logs-db');
  let complete!: (value: any) => void;
  vi.mocked(updateMedicalLog).mockReturnValue(new Promise(resolve => { complete = resolve; }));
  fixture.query.data = [{ id: 1, client_id: 1, log: 'Original', log_date: '2026-11-01' }];
  const client = new QueryClient();
  const view = () => <QueryClientProvider client={client}><ClientMedicalRecordTab /></QueryClientProvider>;
  const rendered = render(view());
  fireEvent.click(rendered.container.querySelector('svg.lucide-pencil')!.closest('button')!);
  const input = screen.getByPlaceholderText('הזן את תוכן הרשומה הרפואית...');
  fireEvent.change(input, { target: { value: 'Local saved note' } });
  const save = rendered.container.querySelector('svg.lucide-save')!.closest('button')!;
  fireEvent.click(save); fireEvent.click(save);
  expect(updateMedicalLog).toHaveBeenCalledTimes(1);
  expect(input).toBeDisabled();
  fixture.query.data = [{ id: 1, client_id: 1, log: 'Concurrent server value', log_date: '2026-11-01' }];
  rendered.rerender(view());
  expect(input).toHaveValue('Local saved note');
  await act(async () => complete({ id: 1, client_id: 1, log: 'Local saved note', log_date: '2026-11-01' }));
  await waitFor(() => expect(screen.getByText('Local saved note')).toBeInTheDocument());
});

it("does not carry another patient's draft into a newly selected patient", () => {
  fixture.query.data = [{ id: 1, client_id: 1, log: 'Patient one', log_date: '2026-11-01' }];
  const client = new QueryClient();
  const view = () => <QueryClientProvider client={client}><ClientMedicalRecordTab /></QueryClientProvider>;
  const rendered = render(view());
  fireEvent.click(rendered.container.querySelector('svg.lucide-pencil')!.closest('button')!);
  fireEvent.change(screen.getByPlaceholderText('הזן את תוכן הרשומה הרפואית...'), { target: { value: 'Patient one draft' } });
  fixture.clientId = '2';
  fixture.query.data = [{ id: 1, client_id: 2, log: 'Patient two', log_date: '2026-11-01' }];
  rendered.rerender(view());
  expect(screen.queryByDisplayValue('Patient one draft')).toBeNull();
  expect(screen.getByText('Patient two')).toBeInTheDocument();
});
