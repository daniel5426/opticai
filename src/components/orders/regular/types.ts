export type OrderLens = {
  order_id: number;
  right_supplier?: string;
  left_supplier?: string;
  right_material?: string;
  left_material?: string;
  right_model?: string;
  left_model?: string;
  right_coating?: string;
  left_coating?: string;
  right_color?: string;
  left_color?: string;
  right_diameter?: string;
  left_diameter?: string;
  warranty_expiration?: string;
  color?: string;
  coating?: string;
  material?: string;
  supplier?: string;
  manufacturer?: string;
  width?: string;
};

export type Frame = {
  order_id: number;
  color?: string;
  supplier?: string;
  model?: string;
  manufacturer?: string;
  supplied_by?: string;
  bridge?: number;
  width?: number;
  height?: number;
  length?: number;
  warranty_expiration?: string;
};

export type LensFrameTab = {
  id: string;
  type: string;
  lens: OrderLens;
  frame: Frame;
  created_at?: string;
  updated_at?: string;
};

export type OrderDetails = {
  order_id: number;
  supplier_status?: string;
  bag_number?: string;
  advisor?: string;
  delivered_by?: string;
  technician?: string;
  delivered_at?: string;
  warranty_expiration?: string;
  delivery_clinic_id?: number;
  delivery_location?: string;
  manufacturing_lab?: string;
  order_status?: string;
  priority?: string;
  promised_date?: string;
  approval_date?: string;
  notes?: string;
  lens_order_notes?: string;
};

export const SUPPLIED_BY_STORE = "חנות";
export const SUPPLIED_BY_CUSTOMER = "לקוח";
