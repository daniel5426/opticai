export type TrashEntityType =
  | "client"
  | "order"
  | "contact_lens_order"
  | "exam"
  | "referral"
  | "medical_log"
  | "appointment"
  | "file"

export interface TrashWarning {
  code: string
  [key: string]: unknown
}

export interface TrashItem {
  id: number
  clinic_id: number
  root_entity_type: TrashEntityType
  root_entity_id: number
  display_label: string
  client_id: number | null
  client_label: string | null
  deleted_by_user_id: number | null
  deleted_by: string | null
  deleted_at: string
  expires_at: string
  status: "trashed" | "purging" | "restored" | "purged"
  included_counts: Record<string, number>
  warnings: TrashWarning[]
  preview?: Record<string, string | number | boolean>
  members?: Array<{ type: TrashEntityType; id: number }>
  jobs?: Array<{ id: number; type: string; status: string; attempt_count: number; last_error: string | null }>
}

export interface TrashPage {
  items: TrashItem[]
  total: number
  limit: number
  offset: number
}
