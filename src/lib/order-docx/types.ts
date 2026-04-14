import type {
  Billing,
  Client,
  Clinic,
  ContactLensOrderEntity,
  Order,
  OrderLineItem,
  User,
} from "@/lib/db/schema-interface";

export type OrderExportKind = "regular" | "contact";

export interface LoadedOrderExportContext {
  kind: OrderExportKind;
  order: Order | ContactLensOrderEntity;
  client?: Client;
  user?: User | null;
  billing?: Billing | null;
  lineItems: OrderLineItem[];
  clinicsById: Record<number, Clinic>;
}

export interface RegularOrderPrintLineItem {
  line_index: string;
  line_description: string;
  line_sku: string;
  line_quantity: string;
  line_price: string;
  line_total: string;
}

export interface RegularOrderPrintModel {
  clinic_name: string;
  delivery_clinic_name: string;
  order_number: string;
  bag_number: string;
  order_date: string;
  approval_date: string;
  order_status: string;
  priority: string;
  client_name: string;
  client_id: string;
  client_address: string;
  phone_mobile: string;
  phone_home: string;
  phone_work: string;
  optician_name: string;
  advisor_name: string;
  delivered_by: string;
  delivered_date: string;
  manufacturing_lab: string;
  r_sph: string;
  r_cyl: string;
  r_ax: string;
  r_pris: string;
  r_base: string;
  r_add: string;
  r_diam: string;
  r_high: string;
  r_pd: string;
  l_sph: string;
  l_cyl: string;
  l_ax: string;
  l_pris: string;
  l_base: string;
  l_add: string;
  l_diam: string;
  l_high: string;
  l_pd: string;
  comb_pd: string;
  multifocal_block: string;
  lens_tab_type: string;
  r_lens_model: string;
  r_lens_supplier: string;
  r_lens_material: string;
  r_lens_coating: string;
  r_lens_color: string;
  r_lens_diameter: string;
  l_lens_model: string;
  l_lens_supplier: string;
  l_lens_material: string;
  l_lens_coating: string;
  l_lens_color: string;
  l_lens_diameter: string;
  frame_supplier: string;
  frame_brand: string;
  frame_model: string;
  frame_color: string;
  frame_width: string;
  frame_bridge: string;
  frame_height: string;
  frame_length: string;
  frame_supplied_by: string;
  promised_date: string;
  line_items_block: string;
  line_items_rows: RegularOrderPrintLineItem[];
  total_price: string;
  amount_paid: string;
  balance_due: string;
  clinic_notes: string;
  supplier_notes: string;
}

export interface ContactOrderPrintModel {
  clinic_name: string;
  supply_clinic_name: string;
  order_number: string;
  order_date: string;
  order_status: string;
  priority: string;
  guaranteed_date: string;
  approval_date: string;
  delivery_date: string;
  client_name: string;
  client_id: string;
  client_address: string;
  phone_mobile: string;
  phone_home: string;
  phone_work: string;
  optician_name: string;
  advisor_name: string;
  deliverer_name: string;
  r_lens_type: string;
  r_model: string;
  r_supplier: string;
  r_material: string;
  r_color: string;
  r_quantity: string;
  l_lens_type: string;
  l_model: string;
  l_supplier: string;
  l_material: string;
  l_color: string;
  l_quantity: string;
  r_bc1: string;
  r_bc2: string;
  r_oz: string;
  r_diam: string;
  r_sph: string;
  r_cyl: string;
  r_ax: string;
  r_read_add: string;
  l_bc1: string;
  l_bc2: string;
  l_oz: string;
  l_diam: string;
  l_sph: string;
  l_cyl: string;
  l_ax: string;
  l_read_add: string;
  cleaning_solution: string;
  disinfection_solution: string;
  rinsing_solution: string;
  total_price: string;
  amount_paid: string;
  balance_due: string;
  clinic_notes: string;
  supplier_notes: string;
}
