import { apiClient } from './api-client';
import type { Billing, BillingPayment, Client, OrderLineItem } from './db/schema-interface';
import type { InventorySelection, CatalogVariant, InventoryComponent } from './inventory';

export type OrderKind = 'regular' | 'contact';
export interface GroupEntry { id?: number; client_key?: string; position: number; kind: OrderKind; order: Record<string, any>; inventory_selections?: InventorySelection[] }
export interface OrderGroup { legacy_order?: {kind: OrderKind; id: number}; id: number; clinic_id: number; payer_client_id: number; revision: number; opened_date?: string; entries: GroupEntry[]; clients: Client[]; billing: Billing | null; line_items: GroupLineItem[]; client_keys?: Record<string, number> }
export type GroupLineItem = OrderLineItem & { source_entry_id?: number | null; source_client_key?: string; source_slot?: string | null; manually_edited?: boolean };
export interface EntryHandle { serialize: () => GroupEntry; setMetadata: (patch: Record<string, unknown>) => void; ready: boolean }
export interface EntryWorkspace { key: string; kind: OrderKind; client: Client; record: Record<string, any>; active?: boolean; editing: boolean; register: (key: string, handle: EntryHandle | null) => void; onChange: (key: string, snapshot: string) => void; suggest: (key: string, slot: InventoryComponent, variant: CatalogVariant | null, quantity: number) => void }

export async function groupRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await apiClient.orderGroupRequest<T>(path, options);
  if (response.error) {
    const detail = typeof response.error === 'string' ? response.error : JSON.stringify(response.error);
    throw new Error(detail);
  }
  return response.data as T;
}

export function serializeEntry(workspace: EntryWorkspace, state: Record<string, any>): GroupEntry {
  const base = workspace.kind === 'regular' ? state.formData : state.contactFormData;
  const original = workspace.record.order_data || {};
  let orderData;
  if (workspace.kind === 'regular') {
    const tab = state.lensFrameTab;
    const existing = Array.isArray(original.lens_frame_tabs) ? original.lens_frame_tabs : [];
    const tabs = existing.length ? existing.map((item: any, index: number) => index === 0 ? tab : item) : [tab];
    orderData = { ...original, 'final-prescription': state.finalPrescriptionFormData, lens_frame_tabs: tabs, active_lens_frame_tab_id: tab.id, details: state.orderDetailsFormData };
  } else {
    orderData = { ...original, 'contact-lens-exam': state.contactLensExamData, 'contact-lens-details': state.contactLensDetailsData, 'keratometer-contact-lens': state.keratoCLData, 'schirmer-test': state.schirmerData, 'contact-lens-diameters': state.diametersData };
  }
  return { client_key: workspace.key, position: 0, kind: workspace.kind, order: { ...workspace.record, ...base, client_id: workspace.client.id, order_data: orderData }, ...(state.inventorySelectionsLoaded ? {inventory_selections: state.inventorySelections.map(({component,variant_id,quantity,fulfillment_source}: InventorySelection) => ({component,variant_id,quantity,fulfillment_source}))} : {}) };
}

export function applySuggestion(lines: GroupLineItem[], key: string, slot: string, variant: CatalogVariant | null, quantity: number, currency: string): GroupLineItem[] {
  const index = lines.findIndex(item => item.source_client_key === key && item.source_slot === slot);
  if (index >= 0 && lines[index].manually_edited !== false) return lines;
  if (!variant || variant.default_retail == null) return lines; // Removing a selection never silently removes a charge.
  if (variant.currency !== currency) throw new Error('cannotMixCurrencies');
  const suggestion: GroupLineItem = { id: index >= 0 ? lines[index].id : -(Date.now() + Math.floor(Math.random()*1000)), billings_id: index >= 0 ? lines[index].billings_id : 0, source_client_key: key, source_slot: slot, manually_edited: false, sku: variant.sku || '', description: variant.display_name, price: variant.default_retail, quantity, discount: 0, line_total: Math.round(variant.default_retail * quantity * 100)/100, currency: variant.currency, supplied: false };
  return index < 0 ? [...lines, suggestion] : lines.map((item,i) => i === index ? suggestion : item);
}
