import { describe, expect, test, vi } from 'vitest';
import { applySuggestion, serializeEntry, type EntryWorkspace, type GroupLineItem } from '@/lib/order-groups';
import type { CatalogVariant } from '@/lib/inventory';

const variant = {id: 1,sku:'shared-sku',display_name:'Frame',default_retail:100,currency:'ILS'} as CatalogVariant;
const state = {formData:{client_id:1,type:'Distance'},contactFormData:{},lensFrameTab:{id:'first',lens:{r_model:'changed'},frame:{}},orderDetailsFormData:{notes:'clinical'},finalPrescriptionFormData:{r_sph:1},inventorySelections:[],inventorySelectionsLoaded:false};
const workspace = {key:'entry:1',kind:'regular',client:{id:1},record:{id:4,client_id:1,order_data:{unknown:{retained:true},lens_frame_tabs:[{id:'first',lens:{},frame:{}},{id:'second',lens:{r_model:'keep'},frame:{}}]}},editing:true,register:vi.fn(),onChange:vi.fn(),suggest:vi.fn()} as unknown as EntryWorkspace;

describe('order group drafts and independent billing',()=>{
 test('preserves unknown order data and other lens/frame tabs',()=>{
  const entry=serializeEntry(workspace,state);
  expect(entry.order.order_data.unknown).toEqual({retained:true});
  expect(entry.order.order_data.lens_frame_tabs).toHaveLength(2);
  expect(entry.order.order_data.lens_frame_tabs[1].lens.r_model).toBe('keep');
  expect(entry.inventory_selections).toBeUndefined();
 });
 test('keeps manually edited suggestions authoritative',()=>{
  const lines=[{id:2,billings_id:1,source_client_key:'entry:1',source_slot:'frame',price:85,manually_edited:true}] as GroupLineItem[];
  expect(applySuggestion(lines,'entry:1','frame',variant,1,'ILS')).toBe(lines);
 });
 test('the same SKU can belong to different clients and order slots',()=>{
  const first=applySuggestion([],'entry:1','frame',variant,1,'ILS');
  const next=applySuggestion(first,'entry:2','frame',variant,2,'ILS');
  expect(next).toHaveLength(2);
  expect(next.map(item=>item.quantity)).toEqual([1,2]);
 });
 test('removing a selection does not silently remove billing items',()=>{
  const lines=applySuggestion([],'entry:1','frame',variant,1,'ILS');
  expect(applySuggestion(lines,'entry:1','frame',null,1,'ILS')).toBe(lines);
 });
 test('rejects mixing currencies without changing the displayed bill',()=>{
  expect(()=>applySuggestion([],'entry:1','frame',{...variant,currency:'EUR'},1,'ILS')).toThrow('cannotMixCurrencies');
 });
});
