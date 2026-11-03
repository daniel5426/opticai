import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/localization/i18n';
const mock = vi.hoisted(() => ({ clinic: 5, preview: vi.fn(), commit: vi.fn() }));
vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentClinic: { id: mock.clinic } }) }));
vi.mock('@/contexts/PrysmAgentContext', () => ({ usePrysmAgent: () => { throw new Error('Manual imports must not use the AI workspace'); } }));
vi.mock('@/lib/api-client', () => ({ apiClient: { previewInventoryImportFile: mock.preview, commitInventoryImport: mock.commit } }));
import { ManualInventoryImportDialog } from '@/components/inventory/ManualInventoryImport';
const row = (index: number, valid = true) => ({ row_number: index + 2, worksheet: 'Stock', status: valid ? 'valid' : 'invalid',
  errors: valid ? [] : ['Duplicate row in file'], error_details: valid ? [] : [{ key: 'supply.manual.error.duplicate' }],
  source_values: { brand: 'Demo', model: 'Model '+index, barcode: '00012', on_hand: 3 }, data: { product: { model: 'Model '+index } } });
const preview = { worksheets: ['Stock','Contacts'], selected_worksheet: 'Stock', rows: [row(0),row(1,false)], total: 2, valid: 1, invalid: 1 };
function mount(open = true, onFinished = vi.fn()) {
  const element = (shown: boolean) => <I18nextProvider i18n={i18n}><ManualInventoryImportDialog open={shown} onOpenChange={() => {}} onFinished={onFinished}/></I18nextProvider>;
  const view = render(element(open)); return { ...view, update: (shown = true) => view.rerender(element(shown)), onFinished };
}
function choose(name = 'stock.csv') { fireEvent.change(screen.getByLabelText(i18n.t('supply.file')), { target: { files: [new File(['test'], name)] } }); }
beforeEach(async () => { mock.clinic = 5; mock.preview.mockReset().mockResolvedValue({data:preview}); mock.commit.mockReset().mockResolvedValue({data:{created:1,skipped:0,validation_errors:[]}}); await i18n.changeLanguage('en'); });
afterEach(cleanup);

describe('manual imports without an agent', () => {
  it.each(['en','he','fr'])('previews and imports only valid rows, with localized results in %s', async locale => {
    await i18n.changeLanguage(locale); const view = mount(); choose();
    expect((await screen.findAllByText('00012'))[0]).toBeVisible();
    expect(screen.getByText(i18n.t('supply.manual.error.duplicate'))).toBeVisible();
    expect(screen.getByRole('dialog')).toHaveAttribute('dir',locale==='he'?'rtl':'ltr');
    fireEvent.click(screen.getByRole('button',{name:i18n.t('supply.manual.apply',{count:1})}));
    await screen.findByText(i18n.t('supply.manual.result',{created:1,skipped:1}));
    expect(mock.commit).toHaveBeenCalledWith(5,[preview.rows[0]],expect.any(String)); expect(view.onFinished).toHaveBeenCalledOnce();
  });
  it('selects exactly one Excel worksheet and resets pagination', async () => {
    mock.preview.mockResolvedValueOnce({data:{...preview,rows:Array.from({length:26},(_,index)=>row(index)),total:26,valid:26,invalid:0}});
    mount(); choose('stock.xlsx'); await screen.findByText('Model 0');
    expect(screen.queryByText('Model 25')).toBeNull(); fireEvent.click(screen.getByRole('button',{name:i18n.t('orderGroupNext')}));
    expect(screen.getByText('Model 25')).toBeVisible();
    fireEvent.change(screen.getByLabelText(i18n.t('supply.manual.worksheet')),{target:{value:'Contacts'}});
    await screen.findByText('Model 0'); expect(mock.preview).toHaveBeenLastCalledWith(expect.objectContaining({name:'stock.xlsx'}),'Contacts');
  });
  it('keeps the worksheet selector available when the first sheet has invalid headers', async () => {
    mock.preview.mockResolvedValue({data:{...preview,file_error:'supply.manual.headers',rows:[],total:0,valid:0,invalid:0}});
    mount(); choose('stock.xls'); expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('supply.manual.headers'));
    expect(screen.getByLabelText(i18n.t('supply.manual.worksheet'))).toBeEnabled();
    expect(screen.queryByRole('button',{name:/Import valid/})).toBeNull();
  });
  it('discards late previews after changing clinic or closing/reopening', async () => {
    let resolve!: (value: unknown)=>void; mock.preview.mockReturnValueOnce(new Promise(yes=>{resolve=yes;}));
    const view=mount(); choose(); mock.clinic=8; view.update();
    await act(async()=>resolve({data:preview})); expect(screen.queryByText('Model 0')).toBeNull();
    choose(); await screen.findByText('Model 0'); view.update(false); view.update();
    expect(screen.queryByText('Model 0')).toBeNull(); expect(screen.getByLabelText(i18n.t('supply.file'))).toHaveValue('');
  });
  it('shows permission failures inline and retains the import ID for retries', async () => {
    mock.commit.mockResolvedValueOnce({error:'Denied',status:403});
    mount(); choose(); const button=await screen.findByRole('button',{name:i18n.t('supply.manual.apply',{count:1})});
    fireEvent.click(button); expect(await screen.findByRole('alert')).toHaveTextContent(i18n.t('supply.permissionDenied'));
    await waitFor(()=>expect(button).toBeEnabled()); fireEvent.click(button); await screen.findByRole('status');
    expect(mock.commit.mock.calls[0][2]).toBe(mock.commit.mock.calls[1][2]);
  });
  it('reports rows rejected during commit alongside the actual imported count', async () => {
    mock.commit.mockResolvedValue({data:{created:0,skipped:1,validation_errors:[{row_number:2,error_details:[{key:'supply.manual.error.exists'}]}]}});
    mount(); choose(); fireEvent.click(await screen.findByRole('button',{name:i18n.t('supply.manual.apply',{count:1})}));
    await screen.findByText(i18n.t('supply.manual.result',{created:0,skipped:2}));
    expect(screen.getByText(i18n.t('supply.manual.error.exists'))).toBeVisible();
  });
});
