import React from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import i18n from '@/localization/i18n';
import { LensSection } from '@/components/orders/regular/LensSection';
import { FrameSection } from '@/components/orders/regular/FrameSection';
import { BillingTab } from '@/components/BillingTab';
import { lensCatalogSuggestions, lensCatalogValue } from '@/components/inventory/LensCatalogCombobox';
import type { Billing, OrderLineItem } from '@/lib/db/schema-interface';
import type { CatalogVariant, InventorySelection } from '@/lib/inventory';

vi.mock('@/contexts/UserContext', () => ({ useUser: () => ({ currentClinic: { id: 1 }, currentUser: { role_level: 2, clinical_auto_advance_enabled: true } }) }));
vi.mock('@/hooks/useSettings', () => ({ useSettings: () => ({ company: { default_currency: 'ILS' } }) }));
vi.mock('@/lib/api-client', () => ({ apiClient: { getInventoryVariants: vi.fn(async () => ({data:{items:[]}})), getLookupTable: vi.fn(async () => ({data:[]})) } }));
vi.mock('@/components/inventory/FrameCatalogCombobox', () => ({ FrameCatalogCombobox: () => null, canCreateFrameCatalogProduct: () => false, hasMatchingFrameCatalogVariant: () => false }));
vi.mock('@/components/inventory/BarcodeScanButton', () => ({ ProductBarcodeScan: () => null }));
afterEach(cleanup);

describe.each(['he','en','fr'])('order pricing in %s', locale => {
 test('shows a shared lens once with only its product name and clears both eyes together', async () => {
  await i18n.changeLanguage(locale);
  const variant = {id:7,company_id:1,product_id:7,currency:'ILS',is_stockable:true,product:{id:7,company_id:1,category:'spectacle_lens',brand:'Optic',model:'ClearView'},display_name:'ClearView — AR / 70',attributes:{}} as CatalogVariant;
  const selections = (['right','left'] as const).map(side => ({component:`lens_${side}`,variant_id:7,variant,quantity:1,fulfillment_source:'supplier_ordered'} as InventorySelection));
  const clear=vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><LensSection clinicId={1} lens={{order_id:1}} layoutKey="shared"
    isEditing onLensFieldChange={vi.fn()} selections={selections} onInventoryClear={clear}/></QueryClientProvider>);
  expect(screen.getAllByText('Optic ClearView')).toHaveLength(1);
  expect(screen.queryByText(variant.display_name)).toBeNull();
  expect(screen.queryByText(i18n.t('orderWorkspace.catalogSupplierOrder'))).toBeNull();
  expect(screen.queryByText(i18n.t('orderGroupRightEye'))).toBeNull();
  expect(screen.queryByText(i18n.t('orderGroupLeftEye'))).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:i18n.t('scanner.clear'),exact:true}));
  expect(clear).toHaveBeenCalledWith('both');
  fireEvent.click(screen.getByRole('radio',{name:i18n.t('orderWorkspace.perEye')}));
  expect(screen.getAllByText('Optic ClearView')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button',{name:`${i18n.t('orderWorkspace.catalogUnlink')} ${i18n.t('orderGroupLeftEye')}`,exact:true}));
  expect(clear).toHaveBeenLastCalledWith('left');
 });
 test('frame selection shows its product name without stock or supplier text', async () => {
  await i18n.changeLanguage(locale);
  const variant = {id:8,company_id:1,product_id:8,currency:'ILS',is_stockable:true,product:{id:8,company_id:1,category:'frame',brand:'Atlas',model:'A101'},display_name:'Atlas A101 — Black / 50',attributes:{},balance:{clinic_id:1,variant_id:8,on_hand:5,reserved:0,available:5,reorder_point:0,target_quantity:0,version:1}} as CatalogVariant;
  render(<FrameSection frame={{order_id:1}} isEditing={false} onFrameFieldChange={vi.fn()} onInventorySelect={vi.fn()} onInventoryClear={vi.fn()}
    selectedInventory={{component:'frame',variant_id:8,variant,quantity:1,fulfillment_source:'inventory'}}/>);
  expect(screen.getByText('Atlas A101')).toBeInTheDocument();
  expect(screen.queryByText(variant.display_name)).toBeNull();
  expect(screen.queryByText(i18n.t('orderWorkspace.catalogAvailable',{count:5}))).toBeNull();
 });
 test('frame link stays below inputs and unlink retains typed details and price', async () => {
  await i18n.changeLanguage(locale);
  const variant = {id:8,product:{category:'frame',brand:'Atlas',model:'A101'},display_name:'Atlas A101',attributes:{}} as CatalogVariant;
  const fields=vi.fn(); const clear=vi.fn(); const unlink=vi.fn();
  function FrameCard(){const [linked,setLinked]=React.useState(true);return <FrameSection frame={{order_id:1,model:'A101',width:50}} price={101} isEditing onFrameFieldChange={fields} onInventorySelect={vi.fn()} onInventoryClear={clear}
    onInventoryUnlink={()=>{unlink();setLinked(false);}} selectedInventory={linked ? {component:'frame',variant_id:8,variant,quantity:1,fulfillment_source:'inventory'}:null}/>;}
  const view=render(<FrameCard/>);
  const price=screen.getByLabelText(i18n.t('orderWorkspace.framePrice'));
  const slot=view.container.querySelector('[data-product-link-row]')!;
  expect(price.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(slot.querySelector('[data-selected-catalog-product]')).toHaveClass('w-full','catalog-product-surface');
  fireEvent.click(screen.getByRole('button',{name:i18n.t('orderWorkspace.catalogUnlink'),exact:true}));
  expect(unlink).toHaveBeenCalledOnce();expect(clear).not.toHaveBeenCalled();expect(fields).not.toHaveBeenCalled();
  expect(Number((price as HTMLInputElement).value)).toBe(101);
  expect(view.container.querySelector('[data-product-link-row]')).toBe(slot);
  expect(slot).toHaveClass('min-h-10');expect(slot).toBeEmptyDOMElement();
 });
 test('lens link is below controls and unlink keeps both eye details', async () => {
  await i18n.changeLanguage(locale);
  const variant = {id:7,product:{category:'spectacle_lens',model:'Very long model name that must wrap without moving the inputs'},attributes:{},display_name:'Lens'} as CatalogVariant;
  const fields=vi.fn(),clear=vi.fn(),unlink=vi.fn();
  const view=render(<QueryClientProvider client={new QueryClient()}><LensSection lens={{order_id:1,right_model:variant.product.model,left_model:variant.product.model}} layoutKey="unlink" isEditing onLensFieldChange={fields} onInventoryClear={clear} onInventoryUnlink={unlink}
    selections={(['right','left'] as const).map(side=>({component:`lens_${side}`,variant_id:7,variant,quantity:1,fulfillment_source:'supplier_ordered'}))}/></QueryClientProvider>);
  const slot=view.container.querySelector('[data-product-link-row]')!;
  const lastInput=Array.from(view.container.querySelectorAll('input')).at(-1)!;
  expect(lastInput.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  fireEvent.click(screen.getByRole('button',{name:i18n.t('orderWorkspace.catalogUnlink'),exact:true}));
  expect(unlink).toHaveBeenCalledWith('both');expect(clear).not.toHaveBeenCalled();expect(fields).not.toHaveBeenCalled();
 });
 test('accepts a currency price without clinical decimal conversion', async () => {
  await i18n.changeLanguage(locale);
  const changed=vi.fn();
  function FrameCard(){const [price,setPrice]=React.useState<number>();return <FrameSection frame={{order_id:0,supplied_by:'חנות'}} isEditing onFrameFieldChange={vi.fn()} onInventorySelect={vi.fn()} onInventoryClear={vi.fn()} price={price} onPriceChange={value=>{changed(value);setPrice(Number(value));}} />;}
  render(<FrameCard/>);
  const price=screen.getByLabelText(i18n.t('orderWorkspace.framePrice'));
  fireEvent.input(price,{target:{value:'250'}});
  fireEvent.change(price,{target:{value:'250'}});
  expect(price).not.toHaveAttribute('data-clinical-nav-kind','number');
  expect(Number((price as HTMLInputElement).value)).toBe(250);
  expect(changed).toHaveBeenLastCalledWith('250');
 });
 test('percentage discounts recalculate with quantity and switch to fixed deductions', async () => {
  await i18n.changeLanguage(locale);
  let draft:OrderLineItem[]=[];
  function Panel(){
   const [billing,setBilling]=React.useState<Billing>({currency:'ILS'});
   const [items,setItems]=React.useState<OrderLineItem[]>([{id:1,billings_id:0,description:'Frame',price:200,quantity:1,discount:0,line_total:200,currency:'ILS'}]);
   draft=items;
   return <BillingTab compact billingFormData={billing} setBillingFormData={setBilling} orderLineItems={items} setOrderLineItems={setItems} isEditing handleDeleteOrderLineItem={vi.fn()}/>;
  }
  render(<QueryClientProvider client={new QueryClient()}><Panel/></QueryClientProvider>);
  fireEvent.click(screen.getByRole('button',{name:i18n.t('orderWorkspace.editItem')}));
  expect(screen.queryByLabelText(i18n.t('orderWorkspace.discountPercent'))).toBeNull();
  fireEvent.click(screen.getByRole('radio',{name:'%',exact:true}));
  expect(screen.queryByLabelText(i18n.t('orderGroupDiscount'))).toBeNull();
  fireEvent.change(screen.getByLabelText(i18n.t('orderWorkspace.discountPercent')),{target:{value:'12.5'}});
  expect(draft[0]).toMatchObject({discount_percent:12.5,discount:25,line_total:175});
  fireEvent.change(screen.getByLabelText(i18n.t('orderGroupQuantity')),{target:{value:'2'}});
  expect(draft[0]).toMatchObject({discount:50,line_total:350});
  fireEvent.click(screen.getByRole('radio',{name:'ILS',exact:true}));
  fireEvent.change(screen.getByLabelText(i18n.t('orderGroupDiscount')),{target:{value:'20'}});
  expect(draft[0]).toMatchObject({discount_percent:null,discount:20,line_total:380});
  fireEvent.change(screen.getByLabelText(i18n.t('orderGroupPrice')),{target:{value:''}});
  expect(screen.getByLabelText(i18n.t('orderGroupQuantity'))).toBeInTheDocument();
  expect(screen.getByLabelText(i18n.t('orderGroupPrice'))).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(i18n.t('orderGroupPrice')),{target:{value:'200'}});
  expect(draft[0]).toMatchObject({price:200,quantity:2,discount:20,line_total:380});
  fireEvent.click(screen.getByRole('button',{name:i18n.t('orderWorkspace.doneEditing')}));
  await waitFor(()=>expect(screen.getByLabelText(i18n.t('orderWorkspace.beforeDiscount'))).toHaveTextContent('400'));
  expect(screen.getByLabelText(i18n.t('orderWorkspace.afterDiscount'))).toHaveTextContent('380');
 });
});

test('lens suggestions respect supplier and coating while offering changes to the active field',()=>{
 const lens=(id:number,supplier:string,coating:string)=>({id,company_id:1,product_id:id,display_name:'Single vision',currency:'ILS',is_stockable:true,product:{id,company_id:1,category:'spectacle_lens',model:'Single vision',material:'1.6',preferred_supplier:supplier},attributes:{coating,color:'Clear',diameter:70}} as CatalogVariant);
 const variants=[lens(1,'Lab A','AR'),lens(2,'Lab B','AR'),lens(3,'Lab A','Blue')];
 expect(lensCatalogSuggestions(variants,{supplier:'Lab A',coating:'AR'}).map(v=>v.id)).toEqual([1]);
 expect(lensCatalogSuggestions(variants,{supplier:'Lab A',coating:'AR'},'coating').map(v=>v.id)).toEqual([1,3]);
 expect(lensCatalogValue(variants[0],'diameter')).toBe(70);
});

test('a delivered lens locks combined editing and splitting preserves its allocation', async () => {
 await i18n.changeLanguage('en');
 const changed=vi.fn();
 render(<QueryClientProvider client={new QueryClient()}><LensSection clinicId={1} lens={{order_id:1}} layoutKey="delivered"
  isEditing onLensFieldChange={changed} selections={[{component:'lens_left',variant_id:7,quantity:1,fulfillment_source:'inventory',lifecycle_state:'consumed'}]} /></QueryClientProvider>);
 expect(screen.getByRole('textbox',{name:'Model',exact:true})).toBeDisabled();
 fireEvent.click(screen.getByRole('radio',{name:'Per eye'}));
 expect(changed).not.toHaveBeenCalled();
 expect(screen.getByRole('textbox',{name:'Model Left',exact:true})).toBeDisabled();
 expect(screen.getByRole('textbox',{name:'Model Right',exact:true})).toBeEnabled();
});
