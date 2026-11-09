import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, test, vi } from 'vitest';
import i18n from '@/localization/i18n';
import { InventoryCountDialog } from '@/components/inventory/InventoryCountDialog';
import { apiClient } from '@/lib/api-client';
const fixture=vi.hoisted(()=>({target:null as any}));
vi.mock('@/lib/scanner',()=>({useScanTarget:(target:any)=>{fixture.target=target;return ()=>{};},dispatchBarcode:async()=>false}));
vi.mock('@/components/inventory/BarcodeScanButton',()=>({BarcodeScanButton:()=>null}));
vi.mock('@/lib/api-client',()=>({apiClient:{submitInventoryCount:vi.fn(async()=>({data:{}}))}}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
const frame={id:25,display_name:'Test frame',barcode:'123',is_stockable:true,product:{brand:'Test',model:'frame',category:'frame'},balance:{reserved:0}} as any;
test.each(['he','en','fr'])('counts only scanned products and undoes exactly one increment in %s',async lang=>{
 await i18n.changeLanguage(lang);const props={open:true,onOpenChange:vi.fn(),onSaved:vi.fn(),variants:[frame],clinicId:33};
 render(<InventoryCountDialog {...props}/>);
 expect(screen.queryByRole('textbox')).toBeNull();
 await act(async()=>{fixture.target.apply(frame);fixture.target.apply(frame);});
 const input=screen.getByRole('textbox',{name:i18n.t('scanner.countQuantity',{name:'Test frame'})});expect(input).toHaveValue('2');
 fireEvent.click(screen.getAllByRole('button',{name:i18n.t('scanner.undoCount',{name:'Test frame'})})[0]);expect(input).toHaveValue('1');
 fireEvent.change(input,{target:{value:'5'}});expect(input).toHaveValue('5');
 fireEvent.click(screen.getByRole('button',{name:i18n.t('supply.apply')}));
 await waitFor(()=>expect(apiClient.submitInventoryCount).toHaveBeenCalledWith(expect.objectContaining({items:[{variant_id:25,counted_quantity:5}]})));
});
test('undoing all scans leaves nothing to save and never zeroes unscanned stock',async()=>{
 await i18n.changeLanguage('en');render(<InventoryCountDialog open onOpenChange={()=>{}} onSaved={()=>{}} variants={[frame]} clinicId={33}/>);
 await act(async()=>fixture.target.apply(frame));
 fireEvent.click(screen.getByRole('button',{name:i18n.t('scanner.undoCount',{name:'Test frame'})}));
 expect(screen.queryByRole('textbox')).toBeNull();expect(screen.getByRole('button',{name:i18n.t('supply.apply')})).toBeDisabled();
});
