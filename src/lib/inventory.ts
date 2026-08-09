export type InventoryCategory = "frame" | "contact_lens";
export type FulfillmentSource = "inventory" | "supplier_ordered";
export type InventoryComponent = "frame" | "contact_right" | "contact_left";

export interface CatalogProduct {
  id: number;
  company_id: number;
  category: InventoryCategory;
  brand?: string | null;
  model: string;
  product_type?: string | null;
  material?: string | null;
  preferred_supplier?: string | null;
  replacement_schedule?: string | null;
  archived_at?: string | null;
}

export interface InventoryBalance {
  id?: number;
  clinic_id: number;
  variant_id: number;
  on_hand: number;
  reserved: number;
  available: number;
  reorder_point: number;
  target_quantity: number;
  version: number;
  updated_at?: string | null;
}

export interface CatalogVariant {
  id: number;
  company_id: number;
  product_id: number;
  product: CatalogProduct;
  display_name: string;
  attributes: Record<string, string | number | boolean | null | undefined>;
  sku?: string | null;
  barcode?: string | null;
  default_cost?: number | null;
  default_retail?: number | null;
  currency: "ILS";
  is_stockable: boolean;
  archived_at?: string | null;
  balance?: InventoryBalance;
}

export interface InventorySelection {
  component: InventoryComponent;
  variant_id: number;
  quantity: number;
  fulfillment_source: FulfillmentSource;
  variant?: CatalogVariant;
  lifecycle_state?: "reserved" | "supplier_ordered" | "consumed" | "released" | "detached";
}

export interface InventoryMovement {
  id: number;
  clinic_id: number;
  variant_id: number;
  movement_type: string;
  on_hand_delta: number;
  reserved_delta: number;
  reason: string;
  actor_user_id?: number | null;
  order_id?: number | null;
  contact_lens_order_id?: number | null;
  created_at: string;
  variant: CatalogVariant;
}

export interface DiscoveryCandidate {
  normalized_fingerprint: string;
  category: InventoryCategory;
  product: Partial<CatalogProduct>;
  attributes: Record<string, unknown>;
  needs_details: boolean;
  missing_fields: string[];
  occurrence_count: number;
  sources: Array<{
    kind: "regular" | "contact";
    order_id: number;
    component: InventoryComponent | string;
    clinic_id: number;
    date?: string | null;
    quantity: number;
  }>;
  clinic_ids: number[];
  first_seen?: string | null;
  last_seen?: string | null;
  suggested_variant?: { id: number; display_name: string; similarity: number } | null;
  selected?: boolean;
}

export const inventoryCategoryLabel = (category: InventoryCategory) =>
  category === "frame" ? "מסגרות" : "עדשות מגע";

export const inventoryVariantDescription = (variant: CatalogVariant) => {
  const attributes = variant.attributes || {};
  if (variant.product.category === "frame") {
    return [attributes.color, attributes.eye_size, attributes.bridge && "גשר " + attributes.bridge]
      .filter(Boolean)
      .join(" · ");
  }
  return [
    attributes.sph && "SPH " + attributes.sph,
    attributes.cyl && "CYL " + attributes.cyl,
    attributes.axis && "AX " + attributes.axis,
    attributes.pack_size && attributes.pack_size + " באריזה",
  ]
    .filter(Boolean)
    .join(" · ");
};
