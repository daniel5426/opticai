import { Database } from 'better-sqlite3';

export interface Client {
  id?: number;
  first_name?: string;
  last_name?: string;
  gender?: string;
  national_id?: string;
  date_of_birth?: string;
  health_fund?: string;
  address_city?: string;
  address_street?: string;
  address_number?: string;
  postal_code?: string;
  phone_home?: string;
  phone_work?: string;
  phone_mobile?: string;
  fax?: string;
  email?: string;
  service_center?: string;
  file_creation_date?: string;
  membership_end?: string;
  service_end?: string;
  price_list?: string;
  discount_percent?: number;
  blocked_checks?: boolean;
  blocked_credit?: boolean;
  sorting_group?: string;
  referring_party?: string;
  file_location?: string;
  occupation?: string;
  status?: string;
  notes?: string;
  profile_picture?: string;
  family_id?: number;
  family_role?: string;

  // AI-related fields
  ai_updated_date?: string;
  ai_data_updated_date?: string; // Only updated when AI-relevant data changes
  client_updated_date?: string;
  ai_exam_state?: string;
  ai_order_state?: string;
  ai_referral_state?: string;
  ai_contact_lens_state?: string;
  ai_appointment_state?: string;
  ai_file_state?: string;
  ai_medical_state?: string;
}

export interface Family {
  id?: number;
  name: string;
  created_date?: string;
  notes?: string;
}

export interface MedicalLog {
  id?: number;
  client_id: number;
  user_id?: number;
  log_date?: string;
  log?: string;
}

export interface OpticalExam {
  id?: number;
  client_id: number;
  clinic?: string;
  user_id?: number;
  exam_date?: string;
  test_name?: string;
  dominant_eye?: string | null;
  type?: 'opticlens' | 'exam';
}

export interface NotesExam {
  id?: number;
  layout_instance_id: number;
  card_instance_id?: string;
  title?: string;
  note?: string;
}

export interface OldRefractionExam {
  id?: number;
  layout_instance_id: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_pris?: number;
  l_pris?: number;
  r_base?: number;
  l_base?: number;
  r_va?: number;
  l_va?: number;
  r_ad?: number;
  l_ad?: number;
  comb_va?: number;
}

export interface OldRefractionExtensionExam {
  id?: number;
  layout_instance_id: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_pr_h?: number;
  l_pr_h?: number;
  r_base_h?: string;
  l_base_h?: string;
  r_pr_v?: number;
  l_pr_v?: number;
  r_base_v?: string;
  l_base_v?: string;
  r_va?: number;
  l_va?: number;
  r_ad?: number;
  l_ad?: number;
  r_j?: number;
  l_j?: number;
  r_pd_far?: number;
  l_pd_far?: number;
  r_pd_close?: number;
  l_pd_close?: number;
  comb_va?: number;
  comb_pd_far?: number;
  comb_pd_close?: number;
}

export interface ObjectiveExam {
  id?: number;
  layout_instance_id: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_se?: number;
  l_se?: number;
}

export interface SubjectiveExam {
  id?: number;
  layout_instance_id: number;
  r_fa?: number;
  l_fa?: number;
  r_fa_tuning?: number;
  l_fa_tuning?: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_pris?: number;
  l_pris?: number;
  r_base?: number;
  l_base?: number;
  r_va?: number;
  l_va?: number;
  r_ph?: number;
  l_ph?: number;
  r_pd_close?: number;
  l_pd_close?: number;
  r_pd_far?: number;
  l_pd_far?: number;
  comb_va?: number;
  comb_fa?: number;
  comb_fa_tuning?: number;
  comb_pd_close?: number;
  comb_pd_far?: number;
}

export interface AdditionExam {
  id?: number;
  layout_instance_id: number;
  r_fcc?: number;
  l_fcc?: number;
  r_read?: number;
  l_read?: number;
  r_int?: number;
  l_int?: number;
  r_bif?: number;
  l_bif?: number;
  r_mul?: number;
  l_mul?: number;
  r_j?: number;
  l_j?: number;
  r_iop?: number;
  l_iop?: number;
}

export interface RetinoscopExam {
  id?: number;
  layout_instance_id: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_reflex?: string;
  l_reflex?: string;
}

export interface RetinoscopDilationExam {
  id?: number;
  layout_instance_id: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_reflex?: string;
  l_reflex?: string;
}

export interface FinalSubjectiveExam {
  id?: number;
  layout_instance_id: number;
  order_id?: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_pr_h?: number;
  l_pr_h?: number;
  r_base_h?: string;
  l_base_h?: string;
  r_pr_v?: number;
  l_pr_v?: number;
  r_base_v?: string;
  l_base_v?: string;
  r_va?: number;
  l_va?: number;
  r_j?: number;
  l_j?: number;
  r_pd_far?: number;
  l_pd_far?: number;
  r_pd_close?: number;
  l_pd_close?: number;
  comb_pd_far?: number;
  comb_pd_close?: number;
  comb_va?: number;
}

export interface FinalPrescriptionExam {
  id?: number;
  layout_instance_id?: number;
  order_id?: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_pris?: number;
  l_pris?: number;
  r_base?: string;
  l_base?: string;
  r_va?: number;
  l_va?: number;
  r_ad?: number;
  l_ad?: number;
  r_pd?: number;
  l_pd?: number;
  r_high?: number;
  l_high?: number;
  r_diam?: number;
  l_diam?: number;
  comb_va?: number;
  comb_pd?: number;
  comb_high?: number;
}

export interface CompactPrescriptionExam {
  id?: number;
  layout_instance_id?: number;
  referral_id?: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_pris?: number;
  l_pris?: number;
  r_base?: number;
  l_base?: number;
  r_va?: number;
  l_va?: number;
  r_ad?: number;
  l_ad?: number;
  r_pd?: number;
  l_pd?: number;
  comb_va?: number;
  comb_pd?: number;
}

export interface Order {
  id?: number;
  client_id: number;
  order_date?: string;
  type?: string;
  dominant_eye?: string;
  user_id?: number;
  lens_id?: number;
  frame_id?: number;

  comb_va?: number;
  comb_high?: number;
  comb_pd?: number;
}

export interface OrderEye {
  id?: number;
  order_id: number;
  eye: string;
  sph?: number;
  cyl?: number;
  ax?: number;
  pris?: number;
  base?: number;
  va?: number;
  ad?: number;
  diam?: number;
  s_base?: number;
  high?: number;
  pd?: number;
}

export interface Referral {
  id?: number;
  client_id: number;
  user_id?: number;
  referral_notes: string;
  prescription_notes?: string;
  date?: string;
  type?: string;
  branch?: string;
  recipient?: string;
}

export interface ReferralEye {
  id?: number;
  referral_id: number;
  eye: string;
  sph?: number;
  cyl?: number;
  ax?: number;
  pris?: number;
  base?: number;
  va?: number;
  add?: number;
  decent?: number;
  s_base?: number;
  high?: number;
  pd?: number;
}

export interface Appointment {
  id?: number;
  client_id: number;
  user_id?: number;
  date?: string;
  time?: string;
  duration?: number;
  exam_name?: string;
  note?: string;
  google_calendar_event_id?: string;
}

export interface OrderLens {
  id?: number;
  order_id: number;
  right_model?: string;
  left_model?: string;
  color?: string;
  coating?: string;
  material?: string;
  supplier?: string;
}

export interface Frame {
  id?: number;
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
}


export interface ContactLensDiameters {
  id?: number;
  layout_instance_id: number;
  pupil_diameter?: number;
  corneal_diameter?: number;
  eyelid_aperture?: number;

}

export interface OldContactLenses {
  id?: number;
  layout_instance_id: number;
  r_lens_type?: string;
  l_lens_type?: string;
  r_model?: string;
  l_model?: string;
  r_supplier?: string;
  l_supplier?: string;

  l_bc?: number;
  l_diam?: number;
  l_sph?: number;
  l_cyl?: number;
  l_ax?: number;
  l_va?: number;
  l_j?: number;

  r_bc?: number;
  r_diam?: number;
  r_sph?: number;
  r_cyl?: number;
  r_ax?: number;
  r_va?: number;
  r_j?: number;

  comb_va?: number;
  comb_j?: number;
}

export interface OverRefraction {
  id?: number;
  layout_instance_id: number;
  r_sph?: number;
  l_sph?: number;
  r_cyl?: number;
  l_cyl?: number;
  r_ax?: number;
  l_ax?: number;
  r_va?: number;
  l_va?: number;
  r_j?: number;
  l_j?: number;
  
  comb_va?: number;
  comb_j?: number;

  l_add?: number;
  r_add?: number;
  l_florescent?: string;
  r_florescent?: string;
  l_bio_m?: string;
  r_bio_m?: string;
}


export interface ContactLensDetails {
  id?: number;
  layout_instance_id: number;
  // contact details
  l_lens_type?: string;
  l_model?: string;
  l_supplier?: string;
  l_material?: string;
  l_color?: string;
  l_quantity?: number;
  l_order_quantity?: number;
  l_dx?: boolean;

  r_lens_type?: string;
  r_model?: string;
  r_supplier?: string;
  r_material?: string;
  r_color?: string;
  r_quantity?: number;
  r_order_quantity?: number;
  r_dx?: boolean;

}

export interface KeratometerContactLens {
  id?: number;
  layout_instance_id: number;
  // k values
  l_rh?: number;
  l_rv?: number;
  l_avg?: number;
  l_cyl?: number;
  l_ax?: number;
  l_ecc?: number;

  r_rh?: number;
  r_rv?: number;
  r_avg?: number;
  r_cyl?: number;
  r_ax?: number;
  r_ecc?: number;
}

export interface ContactLensExam {
  id?: number;
  layout_instance_id: number;
  comb_va?: number;
  // exam
  l_bc?: number;
  l_bc_2?: number;
  l_oz?: number;
  l_diam?: number;
  l_sph?: number;
  l_cyl?: number;
  l_ax?: number;
  l_read_ad?: number;
  l_va?: number;
  l_j?: number;

  r_bc?: number;
  r_bc_2?: number;
  r_oz?: number;
  r_diam?: number;
  r_sph?: number;
  r_cyl?: number;
  r_ax?: number;
  r_read_ad?: number;
  r_va?: number;
  r_j?: number;
}


export interface ContactLensOrder {
  id?: number;
  layout_instance_id: number;
  branch?: string;
  supply_in_branch?: string;
  order_status?: string;
  advisor?: string;
  deliverer?: string;
  delivery_date?: string;
  priority?: string;
  guaranteed_date?: string;
  approval_date?: string;
  cleaning_solution?: string;
  disinfection_solution?: string;
  rinsing_solution?: string;
}

export interface Billing {
  id?: number;
  contact_lens_id?: number;
  optical_exams_id?: number;
  order_id?: number;
  total_before_discount?: number;
  discount_amount?: number;
  discount_percent?: number;
  total_after_discount?: number;
  prepayment_amount?: number;
  installment_count?: number;
  notes?: string;
}

export interface OrderDetails {
  id?: number;
  order_id: number;
  branch?: string;
  supplier_status?: string;
  bag_number?: string;
  advisor?: string;
  delivered_by?: string;
  technician?: string;
  delivered_at?: string;
  warranty_expiration?: string;
  delivery_location?: string;
  manufacturing_lab?: string;
  order_status?: string;
  priority?: string;
  promised_date?: string;
  approval_date?: string;
  notes?: string;
  lens_order_notes?: string;
}

export interface OrderLineItem {
  id?: number;
  billings_id: number;
  sku?: string;
  description?: string;
  supplied_by?: string;
  supplied?: boolean;
  price?: number;
  quantity?: number;
  discount?: number;
  line_total?: number;
}

export interface Settings {
  id?: number;
  // General Info
  clinic_name?: string;
  clinic_position?: string;
  clinic_email?: string;
  clinic_phone?: string;
  clinic_address?: string;
  clinic_city?: string;
  clinic_postal_code?: string;
  clinic_directions?: string;
  clinic_website?: string;
  manager_name?: string;
  license_number?: string;

  // Customization
  clinic_logo_path?: string;
  primary_theme_color?: string;
  secondary_theme_color?: string;

  // Work Configuration
  work_start_time?: string;
  work_end_time?: string;
  appointment_duration?: number; // in minutes
  send_email_before_appointment?: boolean;
  email_days_before?: number; // 1 or 2 days before
  email_time?: string; // time to send the reminder email
  working_days?: string; // JSON string of array of working days
  break_start_time?: string;
  break_end_time?: string;
  max_appointments_per_day?: number;

  // Email Configuration
  email_provider?: string; // 'gmail', 'outlook', 'yahoo', 'custom'
  email_smtp_host?: string;
  email_smtp_port?: number;
  email_smtp_secure?: boolean;
  email_username?: string;
  email_password?: string; // Will be encrypted
  email_from_name?: string;

  created_at?: string;
  updated_at?: string;
}

export interface User {
  id?: number;
  username: string;
  email?: string;
  phone?: string;
  password?: string;
  role: 'admin' | 'worker' | 'viewer';
  is_active?: boolean;
  profile_picture?: string;
  primary_theme_color?: string;
  secondary_theme_color?: string;
  theme_preference?: 'light' | 'dark' | 'system';
  google_account_connected?: boolean;
  google_account_email?: string;
  google_access_token?: string;
  google_refresh_token?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Chat {
  id?: number;
  title: string;
  created_at?: string;
  updated_at?: string;
}

export interface ChatMessage {
  id?: number;
  chat_id: number;
  type: 'user' | 'ai';
  content: string;
  timestamp?: string;
  data?: string; // JSON string for additional data
}

export interface EmailLog {
  id?: number;
  appointment_id: number;
  email_address: string;
  sent_at?: string;
  success: boolean;
  error_message?: string;
}

export interface LookupSupplier {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupClinic {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupOrderType {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupReferralType {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupLensModel {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupColor {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupMaterial {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupCoating {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupManufacturer {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupFrameModel {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupContactLensType {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupContactEyeLensType {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupContactEyeMaterial {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupCleaningSolution {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupDisinfectionSolution {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupRinsingSolution {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupManufacturingLab {
  id?: number;
  name: string;
  created_at?: string;
}

export interface LookupAdvisor {
  id?: number;
  name: string;
  created_at?: string;
}

export interface File {
  id?: number;
  client_id: number;
  file_name: string;
  file_path: string;
  file_size?: number;
  file_type?: string;
  upload_date?: string;
  uploaded_by?: number;
  notes?: string;
}

export interface ExamLayout {
  id?: number;
  name: string;
  layout_data: string; // JSON string of layout configuration with custom widths
  type?: 'opticlens' | 'exam';
  is_default?: boolean;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ExamLayoutInstance {
  id?: number;
  exam_id: number;
  layout_id: number;
  is_active?: boolean;
  order?: number;
  created_at?: string;
  updated_at?: string;
}

export interface UncorrectedVAExam {
  id?: number;
  layout_instance_id: number;
  r_fv?: string;
  l_fv?: string;
  r_iv?: string;
  l_iv?: string;
  r_nv_j?: string;
  l_nv_j?: string;
}

export interface KeratometerExam {
  id?: number;
  layout_instance_id: number;
  r_k1?: number;
  r_k2?: number;
  r_axis?: number;
  l_k1?: number;
  l_k2?: number;
  l_axis?: number;
}

export interface KeratometerFullExam {
  id?: number;
  layout_instance_id: number;
  r_dpt_k1?: number;
  r_dpt_k2?: number;
  l_dpt_k1?: number;
  l_dpt_k2?: number;
  r_mm_k1?: number;
  r_mm_k2?: number;
  l_mm_k1?: number;
  l_mm_k2?: number;
  r_mer_k1?: number;
  r_mer_k2?: number;
  l_mer_k1?: number;
  l_mer_k2?: number;
  r_astig?: boolean;
  l_astig?: boolean;
}

export interface CornealTopographyExam {
  id?: number;
  layout_instance_id: number;
  l_note?: string;
  r_note?: string;
  title?: string;
}

export interface AnamnesisExam {
  id?: number;
  layout_instance_id: number;
  medications?: string;
  allergies?: string;
  family_history?: string;
  previous_treatments?: string;
  lazy_eye?: string;
  contact_lens_wear?: boolean;
  started_wearing_since?: string;
  stopped_wearing_since?: string;
  additional_notes?: string;
}

export interface CoverTestExam {
  id?: number;
  layout_instance_id: number;
  card_instance_id?: string;
  card_id?: string;
  tab_index?: number;
  deviation_type?: string;
  deviation_direction?: string;
  fv_1?: number;
  fv_2?: number;
  nv_1?: number;
  nv_2?: number;
}

export interface DiopterAdjustmentPanel {
  id?: number;
  layout_instance_id: number;
  right_diopter?: number;
  left_diopter?: number;
}

export interface SchirmerTestExam {
  id?: number;
  layout_instance_id: number;
  r_mm?: number;
  l_mm?: number;
  r_but?: number;
  l_but?: number;
}

export interface OldRefExam {
  id?: number;
  layout_instance_id: number;
  role?: string;
  source?: string;
  contacts?: string;
}

export interface WorkShift {
  id?: number;
  user_id: number;
  start_time: string;
  end_time?: string;
  duration_minutes?: number;
  date: string;
  status: 'active' | 'completed' | 'cancelled';
  created_at?: string;
  updated_at?: string;
}

export interface Campaign {
  id?: number;
  name: string;
  filters: string; // JSON string of filter conditions
  email_enabled: boolean;
  email_content: string;
  sms_enabled: boolean;
  sms_content: string;
  active: boolean;
  active_since?: string;
  mail_sent?: boolean;
  sms_sent?: boolean;
  emails_sent_count?: number; // Total number of emails sent by this campaign
  sms_sent_count?: number; // Total number of SMS sent by this campaign
  created_at?: string;
  // Cycle time fields
  cycle_type?: 'daily' | 'monthly' | 'yearly' | 'custom';
  cycle_custom_days?: number; // For custom cycle type
  last_executed?: string; // ISO date string of last execution
  execute_once_per_client?: boolean;
}

export interface CampaignClientExecution {
  id?: number;
  campaign_id: number;
  client_id: number;
  executed_at?: string;
}

export interface SensationVisionStabilityExam {
  id?: number;
  layout_instance_id: number;
  r_sensation?: string;
  l_sensation?: string;
  r_vision?: string;
  l_vision?: string;
  r_stability?: string;
  l_stability?: string;
  r_movement?: string;
  l_movement?: string;
  r_recommendations?: string;
  l_recommendations?: string;
}

export interface FusionRangeExam {
  id?: number;
  layout_instance_id: number;
  fv_base_in?: number;
  fv_base_in_recovery?: number;
  fv_base_out?: number;
  fv_base_out_recovery?: number;
  nv_base_in?: number;
  nv_base_in_recovery?: number;
  nv_base_out?: number;
  nv_base_out_recovery?: number;
}

export interface MaddoxRodExam {
  id?: number;
  layout_instance_id: number;
  c_r_h?: number;
  c_r_v?: number;
  c_l_h?: number;
  c_l_v?: number;
  wc_r_h?: number;
  wc_r_v?: number;
  wc_l_h?: number;
  wc_l_v?: number;
}

export interface StereoTestExam {
  id?: number;
  layout_instance_id: number;
  fly_result?: boolean;
  circle_score?: number;
  circle_max?: number;
}

export interface RGExam {
  id?: number;
  layout_instance_id: number;
  rg_status?: "suppression" | "fusion" | "diplopia";
  suppressed_eye?: "R" | "G" | null;
}

export interface OcularMotorAssessmentExam {
  id?: number;
  layout_instance_id: number;
  ocular_motility?: string;
  acc_od?: number;
  acc_os?: number;
  npc_break?: number;
  npc_recovery?: number;
}

export const createTables = (db: Database): void => {
  // Create families table
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_date DATE DEFAULT CURRENT_DATE,
      notes TEXT
    );
  `);

  // Create clients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      gender TEXT,
      national_id TEXT UNIQUE,
      date_of_birth DATE,
      health_fund TEXT,
      address_city TEXT,
      address_street TEXT,
      address_number TEXT,
      postal_code TEXT,
      phone_home TEXT,
      phone_work TEXT,
      phone_mobile TEXT,
      fax TEXT,
      email TEXT,
      service_center TEXT,
      file_creation_date DATE,
      membership_end DATE,
      service_end DATE,
      price_list TEXT,
      discount_percent INTEGER,
      blocked_checks BOOLEAN,
      blocked_credit BOOLEAN,
      sorting_group TEXT,
      referring_party TEXT,
      file_location TEXT,
      occupation TEXT,
      status TEXT,
      notes TEXT,
      profile_picture TEXT,
      family_id INTEGER,
      family_role TEXT,
      ai_updated_date DATETIME,
      client_updated_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      ai_exam_state TEXT,
      ai_order_state TEXT,
      ai_referral_state TEXT,
      ai_contact_lens_state TEXT,
      ai_appointment_state TEXT,
      ai_file_state TEXT,
      ai_medical_state TEXT,
      FOREIGN KEY(family_id) REFERENCES families(id)
    );
  `);

  // Add AI fields to existing clients if they don't exist
  try {
    db.exec(`ALTER TABLE clients ADD COLUMN ai_updated_date DATETIME`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN client_updated_date DATETIME DEFAULT CURRENT_TIMESTAMP`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN ai_exam_state TEXT`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN ai_order_state TEXT`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN ai_referral_state TEXT`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN ai_contact_lens_state TEXT`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN ai_appointment_state TEXT`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN ai_file_state TEXT`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE clients ADD COLUMN ai_medical_state TEXT`);
  } catch (e) { /* Column already exists */ }

  // Update existing clients to have current timestamp for client_updated_date if it's null
  db.exec(`
    UPDATE clients 
    SET client_updated_date = CURRENT_TIMESTAMP 
    WHERE client_updated_date IS NULL
  `);

  // Create medical_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS medical_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      user_id INTEGER,
      log_date DATE,
      log TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Create optical_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS optical_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      clinic TEXT,
      user_id INTEGER,
      exam_date DATE,
      test_name TEXT,
      dominant_eye CHAR(1) CHECK(dominant_eye IN ('R','L')),
      type TEXT CHECK(type IN ('opticlens','exam')) DEFAULT 'exam',
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Add type column to existing optical_exams table if it doesn't exist
  try {
    db.exec(`ALTER TABLE optical_exams ADD COLUMN type TEXT CHECK(type IN ('opticlens','exam')) DEFAULT 'exam'`);
  } catch (e) { /* Column already exists */ }

  // Update existing records to have default type value
  db.exec(`
    UPDATE optical_exams 
    SET type = 'exam' 
    WHERE type IS NULL
  `);

  // Create notes_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS notes_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      card_instance_id TEXT,
      title TEXT DEFAULT 'הערות',
      note TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create old_refraction_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS old_refraction_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_pris REAL,
      l_pris REAL,
      r_base REAL,
      l_base REAL,
      r_va REAL,
      l_va REAL,
      r_ad REAL,
      l_ad REAL,
      comb_va REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create old_refraction_extension_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS old_refraction_extension_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_pr_h REAL,
      l_pr_h REAL,
      r_base_h TEXT,
      l_base_h TEXT,
      r_pr_v REAL,
      l_pr_v REAL,
      r_base_v TEXT,
      l_base_v TEXT,
      r_va REAL,
      l_va REAL,
      r_ad REAL,
      l_ad REAL,
      r_j INTEGER,
      l_j INTEGER,
      r_pd_far REAL,
      l_pd_far REAL,
      r_pd_close REAL,
      l_pd_close REAL,
      comb_va REAL,
      comb_pd_far REAL,
      comb_pd_close REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create objective_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS objective_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_se REAL,
      l_se REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create subjective_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS subjective_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_fa REAL,
      l_fa REAL,
      r_fa_tuning REAL,
      l_fa_tuning REAL,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_pris REAL,
      l_pris REAL,
      r_base REAL,
      l_base REAL,
      r_va REAL,
      l_va REAL,
      r_ph REAL,
      l_ph REAL,
      r_pd_close REAL,
      l_pd_close REAL,
      r_pd_far REAL,
      l_pd_far REAL,
      comb_va REAL,
      comb_fa REAL,
      comb_fa_tuning REAL,
      comb_pd_close REAL,
      comb_pd_far REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create addition_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS addition_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_fcc REAL,
      l_fcc REAL,
      r_read REAL,
      l_read REAL,
      r_int REAL,
      l_int REAL,
      r_bif REAL,
      l_bif REAL,
      r_mul REAL,
      l_mul REAL,
      r_j INTEGER,
      l_j INTEGER,
      r_iop REAL,
      l_iop REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create retinoscop_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS retinoscop_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_reflex TEXT,
      l_reflex TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create retinoscop_dilation_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS retinoscop_dilation_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_reflex TEXT,
      l_reflex TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create final_subjective_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS final_subjective_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      order_id INTEGER,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_pr_h REAL,
      l_pr_h REAL,
      r_base_h TEXT,
      l_base_h TEXT,
      r_pr_v REAL,
      l_pr_v REAL,
      r_base_v TEXT,
      l_base_v TEXT,
      r_va REAL,
      l_va REAL,
      r_j INTEGER,
      l_j INTEGER,
      r_pd_far REAL,
      l_pd_far REAL,
      r_pd_close REAL,
      l_pd_close REAL,
      comb_pd_far REAL,
      comb_pd_close REAL,
      comb_va REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Create final_prescription_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS final_prescription_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER,
      order_id INTEGER,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_pris REAL,
      l_pris REAL,
      r_base TEXT,
      l_base TEXT,
      r_va REAL,
      l_va REAL,
      r_ad REAL,
      l_ad REAL,
      r_pd REAL,
      l_pd REAL,
      r_high REAL,
      l_high REAL,
      r_diam INTEGER,
      l_diam INTEGER,
      comb_va REAL,
      comb_pd REAL,
      comb_high REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Create compact_prescription_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS compact_prescription_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER,
      referral_id INTEGER,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax INTEGER,
      l_ax INTEGER,
      r_pris REAL,
      l_pris REAL,
      r_base REAL,
      l_base REAL,
      r_va REAL,
      l_va REAL,
      r_ad REAL,
      l_ad REAL,
      r_pd REAL,
      l_pd REAL,
      comb_va REAL,
      comb_pd REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE,
      FOREIGN KEY(referral_id) REFERENCES referrals(id) ON DELETE CASCADE
    );
  `);

  // Create contact_lens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_lens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      exam_date DATE,
      type TEXT,
      user_id INTEGER,
      comb_va REAL,
      pupil_diameter REAL,
      corneal_diameter REAL,
      eyelid_aperture REAL,
      notes TEXT,
      notes_for_supplier TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);


  // Create contact_lens_order table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_lens_order (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      branch TEXT,
      supply_in_branch TEXT,
      order_status TEXT,
      advisor TEXT,
      deliverer TEXT,
      delivery_date DATE,
      priority TEXT,
      guaranteed_date DATE,
      approval_date DATE,
      cleaning_solution TEXT,
      disinfection_solution TEXT,
      rinsing_solution TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create billings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS billings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_lens_id INTEGER,
      optical_exams_id INTEGER,
      order_id INTEGER,
      total_before_discount REAL,
      discount_amount REAL,
      discount_percent REAL,
      total_after_discount REAL,
      prepayment_amount REAL,
      installment_count INTEGER,
      notes TEXT,
      FOREIGN KEY(contact_lens_id) REFERENCES contact_lens(id) ON DELETE CASCADE,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Create order_line_item table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_line_item (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      billings_id INTEGER NOT NULL,
      sku TEXT,
      description TEXT,
      supplied_by TEXT,
      supplied BOOLEAN,
      price REAL,
      quantity REAL,
      discount REAL,
      line_total REAL,
      FOREIGN KEY(billings_id) REFERENCES billings(id) ON DELETE CASCADE
    );
  `);

  // Create orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      order_date DATE,
      type TEXT,
      dominant_eye CHAR(1) CHECK(dominant_eye IN ('R','L')),
      user_id INTEGER,
      lens_id INTEGER,
      frame_id INTEGER,
      comb_va REAL,
      comb_high REAL,
      comb_pd REAL,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Create order_eyes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_eyes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      eye TEXT CHECK(eye IN ('R','L')),
      sph REAL,
      cyl REAL,
      ax INTEGER,
      pris REAL,
      base REAL,
      va REAL,
      ad REAL,
      diam REAL,
      s_base REAL,
      high REAL,
      pd REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Create order_lens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_lens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      right_model TEXT,
      left_model TEXT,
      color TEXT,
      coating TEXT,
      material TEXT,
      supplier TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Create frames table
  db.exec(`
    CREATE TABLE IF NOT EXISTS frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      color TEXT,
      supplier TEXT,
      model TEXT,
      manufacturer TEXT,
      supplied_by TEXT,
      bridge REAL,
      width REAL,
      height REAL,
      length REAL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Create order_details table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      branch TEXT,
      supplier_status TEXT,
      bag_number TEXT,
      advisor TEXT,
      delivered_by TEXT,
      technician TEXT,
      delivered_at DATE,
      warranty_expiration DATE,
      delivery_location TEXT,
      manufacturing_lab TEXT,
      order_status TEXT,
      priority TEXT,
      promised_date DATE,
      approval_date DATE,
      notes TEXT,
      lens_order_notes TEXT,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE
    );
  `);

  // Create referrals table
  db.exec(`
    CREATE TABLE IF NOT EXISTS referrals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      user_id INTEGER,
      referral_notes TEXT,
      prescription_notes TEXT,
      date DATE,
      type TEXT,
      branch TEXT,
      recipient TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Create referral_eye table
  db.exec(`
    CREATE TABLE IF NOT EXISTS referral_eye (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      referral_id INTEGER NOT NULL,
      eye TEXT CHECK(eye IN ('R','L')),
      sph REAL,
      cyl REAL,
      ax INTEGER,
      pris REAL,
      base REAL,
      va REAL,
      add_power REAL,
      decent REAL,
      s_base REAL,
      high REAL,
      pd REAL,
      FOREIGN KEY(referral_id) REFERENCES referrals(id) ON DELETE CASCADE
    );
  `);

  // Create appointments table
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      user_id INTEGER,
      date DATE,
      time TEXT,
      duration INTEGER DEFAULT 30,
      exam_name TEXT,
      note TEXT,
      google_calendar_event_id TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Create files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      uploaded_by INTEGER,
      notes TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    );
  `);

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_name TEXT,
      clinic_position TEXT,
      clinic_email TEXT,
      clinic_phone TEXT,
      clinic_address TEXT,
      clinic_city TEXT,
      clinic_postal_code TEXT,
      clinic_directions TEXT,
      clinic_website TEXT,
      manager_name TEXT,
      license_number TEXT,
      clinic_logo_path TEXT,
      primary_theme_color TEXT DEFAULT '#3b82f6',
      secondary_theme_color TEXT DEFAULT '#cde3f4',
      work_start_time TEXT DEFAULT '08:00',
      work_end_time TEXT DEFAULT '18:00',
      appointment_duration INTEGER DEFAULT 30,
      send_email_before_appointment BOOLEAN DEFAULT 0,
      email_days_before INTEGER DEFAULT 1,
      email_time TEXT DEFAULT '10:00',
      working_days TEXT DEFAULT '["sunday","monday","tuesday","wednesday","thursday"]',
      break_start_time TEXT,
      break_end_time TEXT,
      max_appointments_per_day INTEGER DEFAULT 20,
      email_provider TEXT DEFAULT 'gmail',
      email_smtp_host TEXT,
      email_smtp_port INTEGER,
      email_smtp_secure BOOLEAN DEFAULT 1,
      email_username TEXT,
      email_password TEXT,
      email_from_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default settings if no settings exist
  const insertSettings = db.prepare(`
    INSERT OR IGNORE INTO settings (
      id, clinic_name, clinic_position, clinic_email, clinic_phone,
      clinic_address, clinic_city, clinic_postal_code,
      manager_name, license_number, clinic_website,
      primary_theme_color, secondary_theme_color,
      work_start_time, work_end_time, appointment_duration,
      send_email_before_appointment, email_days_before, email_time,
      working_days, max_appointments_per_day,
      email_provider, email_smtp_secure
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertSettings.run(
    1, 'מרפאת העיניים שלנו', 'קומה 2, חדר 15', 'info@eyeclinic.co.il', '03-1234567',
    'רחוב הרצל 123', 'תל אביב', '12345',
    'ד"ר יוסי כהן', 'OPT-12345', 'https://www.eyeclinic.co.il',
    '#1e40af', '#e0e7ff',
    '08:00', '18:00', 30,
    0, 1, '10:00',
    '["sunday","monday","tuesday","wednesday","thursday"]', 20,
    'gmail', 1
  );

  // Create users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      phone TEXT,
      password TEXT,
      role TEXT CHECK(role IN ('admin','worker','viewer')) NOT NULL DEFAULT 'worker',
      is_active BOOLEAN DEFAULT 1,
      profile_picture TEXT,
      primary_theme_color TEXT,
      secondary_theme_color TEXT,
      theme_preference TEXT CHECK(theme_preference IN ('light','dark','system')) DEFAULT 'system',
      google_account_connected BOOLEAN DEFAULT 0,
      google_account_email TEXT,
      google_access_token TEXT,
      google_refresh_token TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default admin user if no users exist
  db.exec(`
    INSERT OR IGNORE INTO users (
      id, username, password, role, email, phone, 
      primary_theme_color, secondary_theme_color, theme_preference
    ) 
    SELECT 
      1, 'admin', 'admin', 'admin', 'admin@clinic.com', '',
      '#1e40af', '#e0e7ff', 'system'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 1);
  `);

  // Insert additional default users for demonstration
  db.exec(`
    INSERT OR IGNORE INTO users (
      id, username, password, role, email, phone,
      primary_theme_color, secondary_theme_color, theme_preference
    ) 
    SELECT 
      2, 'worker1', '', 'worker', 'worker1@clinic.com', '050-1234567',
      '#047857', '#d1fae5', 'light'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 2);
  `);

  db.exec(`
    INSERT OR IGNORE INTO users (
      id, username, password, role, email, phone,
      primary_theme_color, secondary_theme_color, theme_preference
    ) 
    SELECT 
      3, 'worker2', 'password123', 'worker', 'worker2@clinic.com', '050-7654321',
      '#7c2d12', '#fed7aa', 'dark'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 3);
  `);

  db.exec(`
    INSERT OR IGNORE INTO users (
      id, username, password, role, email, phone,
      primary_theme_color, secondary_theme_color, theme_preference
    ) 
    SELECT 
      4, 'viewer1', '', 'viewer', 'viewer1@clinic.com', '',
      '#6b21a8', '#f3e8ff', 'system'
    WHERE NOT EXISTS (SELECT 1 FROM users WHERE id = 4);
  `);

  // Create chats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create chat_messages table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id INTEGER NOT NULL,
      type TEXT CHECK(type IN ('user','ai')) NOT NULL,
      content TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      data TEXT,
      FOREIGN KEY(chat_id) REFERENCES chats(id) ON DELETE CASCADE
    );
  `);

  // Create email_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      appointment_id INTEGER NOT NULL,
      email_address TEXT NOT NULL,
      sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      success BOOLEAN NOT NULL,
      error_message TEXT,
      FOREIGN KEY(appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
    );
  `);

  // Create lookup tables for field data selection
  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_supplier (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_clinic (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_order_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_referral_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_lens_model (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_color (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_material (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_coating (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_manufacturer (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_frame_model (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_contact_lens_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_contact_eye_lens_type (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_contact_eye_material (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_cleaning_solution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_disinfection_solution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_rinsing_solution (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_manufacturing_lab (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS lookup_advisor (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Insert default values for lookup tables
  const defaultColors = ['שחור', 'חום', 'כחול', 'ירוק', 'אפור', 'אדום', 'ורוד', 'סגול', 'כתום', 'צהוב', 'לבן', 'שקוף'];
  const defaultMaterials = ['פלסטיק', 'מתכת', 'טיטניום', 'אלומיניום', 'אצטט', 'פוליקרבונט', 'TR90'];
  const defaultCoatings = ['אנטי-רפלקס', 'הקשיה', 'UV', 'כחול אור', 'מגנטי', 'פוטוכרומטי'];
  const defaultOrderTypes = ['משקפיים', 'עדשות מגע', 'משקפי שמש', 'תיקון', 'החלפה'];
  const defaultReferralTypes = ['רופא עיניים', 'מרפאת עיניים', 'בית חולים', 'מומחה'];
  const defaultContactLensTypes = ['יומיות', 'דו-שבועיות', 'חודשיות', 'שנתיות', 'טוריות', 'מולטיפוקל'];
  const defaultContactEyeLensTypes = ['רכות', 'קשות', 'היברידיות', 'סקלרליות'];
  const defaultContactEyeMaterials = ['סיליקון הידרוגל', 'הידרוגל', 'PMMA', 'RGP'];
  const defaultCleaningSolutions = ['מיצלר', 'אנזימטי', 'חלבון', 'יומי'];
  const defaultDisinfectionSolutions = ['פרוקסיד מימן', 'מולטי פרפוס', 'UV', 'חום'];
  const defaultRinsingSolutions = ['מלוח', 'מיצלר', 'מים מזוקקים'];

  // Insert default colors
  const insertColor = db.prepare(`INSERT OR IGNORE INTO lookup_color (name) VALUES (?)`);
  defaultColors.forEach(color => {
    insertColor.run(color);
  });

  // Insert default materials
  const insertMaterial = db.prepare(`INSERT OR IGNORE INTO lookup_material (name) VALUES (?)`);
  defaultMaterials.forEach(material => {
    insertMaterial.run(material);
  });

  // Insert default coatings
  const insertCoating = db.prepare(`INSERT OR IGNORE INTO lookup_coating (name) VALUES (?)`);
  defaultCoatings.forEach(coating => {
    insertCoating.run(coating);
  });

  // Insert default order types
  const insertOrderType = db.prepare(`INSERT OR IGNORE INTO lookup_order_type (name) VALUES (?)`);
  defaultOrderTypes.forEach(type => {
    insertOrderType.run(type);
  });

  // Insert default referral types
  const insertReferralType = db.prepare(`INSERT OR IGNORE INTO lookup_referral_type (name) VALUES (?)`);
  defaultReferralTypes.forEach(type => {
    insertReferralType.run(type);
  });

  // Insert default contact lens types
  const insertContactLensType = db.prepare(`INSERT OR IGNORE INTO lookup_contact_lens_type (name) VALUES (?)`);
  defaultContactLensTypes.forEach(type => {
    insertContactLensType.run(type);
  });

  // Insert default contact eye lens types
  const insertContactEyeLensType = db.prepare(`INSERT OR IGNORE INTO lookup_contact_eye_lens_type (name) VALUES (?)`);
  defaultContactEyeLensTypes.forEach(type => {
    insertContactEyeLensType.run(type);
  });

  // Insert default contact eye materials
  const insertContactEyeMaterial = db.prepare(`INSERT OR IGNORE INTO lookup_contact_eye_material (name) VALUES (?)`);
  defaultContactEyeMaterials.forEach(material => {
    insertContactEyeMaterial.run(material);
  });

  // Insert default cleaning solutions
  const insertCleaningSolution = db.prepare(`INSERT OR IGNORE INTO lookup_cleaning_solution (name) VALUES (?)`);
  defaultCleaningSolutions.forEach(solution => {
    insertCleaningSolution.run(solution);
  });

  // Insert default disinfection solutions
  const insertDisinfectionSolution = db.prepare(`INSERT OR IGNORE INTO lookup_disinfection_solution (name) VALUES (?)`);
  defaultDisinfectionSolutions.forEach(solution => {
    insertDisinfectionSolution.run(solution);
  });

  // Insert default rinsing solutions
  const insertRinsingSolution = db.prepare(`INSERT OR IGNORE INTO lookup_rinsing_solution (name) VALUES (?)`);
  defaultRinsingSolutions.forEach(solution => {
    insertRinsingSolution.run(solution);
  });

  // Insert default suppliers
  const defaultSuppliers = ['אופטיקנה', 'שמיר', 'זייס', 'אסילור', 'הויה', 'סיקו', 'קופר ויז\'ן', 'ג\'ונסון אנד ג\'ונסון', 'באוש אנד לומב', 'אלקון'];
  const insertSupplier = db.prepare(`INSERT OR IGNORE INTO lookup_supplier (name) VALUES (?)`);
  defaultSuppliers.forEach(supplier => {
    insertSupplier.run(supplier);
  });

  // Insert default clinics
  const defaultClinics = ['מרפאה ראשית', 'סניף צפון', 'סניף דרום', 'סניף מרכז', 'מרפאת חירום'];
  const insertClinic = db.prepare(`INSERT OR IGNORE INTO lookup_clinic (name) VALUES (?)`);
  defaultClinics.forEach(clinic => {
    insertClinic.run(clinic);
  });

  // Insert default lens models
  const defaultLensModels = ['סינגל ויז\'ן', 'פרוגרסיב', 'ביפוקל', 'אופיס', 'קומפיוטר', 'נהיגה', 'ספורט'];
  const insertLensModel = db.prepare(`INSERT OR IGNORE INTO lookup_lens_model (name) VALUES (?)`);
  defaultLensModels.forEach(model => {
    insertLensModel.run(model);
  });

  // Insert default manufacturers
  const defaultManufacturers = ['ריי בן', 'אוקלי', 'פרסול', 'גוצ\'י', 'פראדה', 'דולצ\'ה וגבאנה', 'ארמני', 'קלווין קליין', 'טום פורד', 'מאווי ג\'ים'];
  const insertManufacturer = db.prepare(`INSERT OR IGNORE INTO lookup_manufacturer (name) VALUES (?)`);
  defaultManufacturers.forEach(manufacturer => {
    insertManufacturer.run(manufacturer);
  });

  // Insert default frame models
  const defaultFrameModels = ['קלאסי', 'ספורטיבי', 'מודרני', 'וינטאג\'', 'מינימליסטי', 'עגול', 'מרובע', 'אובלי', 'חתולי', 'אוויאטור'];
  const insertFrameModel = db.prepare(`INSERT OR IGNORE INTO lookup_frame_model (name) VALUES (?)`);
  defaultFrameModels.forEach(model => {
    insertFrameModel.run(model);
  });

  // Insert default manufacturing labs
  const defaultLabs = ['מעבדה מרכזית', 'מעבדת צפון', 'מעבדת דרום', 'מעבדה חיצונית', 'מעבדת חירום'];
  const insertLab = db.prepare(`INSERT OR IGNORE INTO lookup_manufacturing_lab (name) VALUES (?)`);
  defaultLabs.forEach(lab => {
    insertLab.run(lab);
  });

  // Insert default advisors
  const defaultAdvisors = ['יוסי כהן', 'רחל לוי', 'דוד ישראלי', 'שרה אברהם', 'מיכל דוד', 'אבי משה'];
  const insertAdvisor = db.prepare(`INSERT OR IGNORE INTO lookup_advisor (name) VALUES (?)`);
  defaultAdvisors.forEach(advisor => {
    insertAdvisor.run(advisor);
  });

  // Create exam_layouts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_layouts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      layout_data TEXT NOT NULL,
      type TEXT CHECK(type IN ('opticlens','exam')) DEFAULT 'exam',
      is_default BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create exam_layout_instances table
  db.exec(`
    CREATE TABLE IF NOT EXISTS exam_layout_instances (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      layout_id INTEGER NOT NULL,
      is_active BOOLEAN DEFAULT 0,
      \`order\` INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(exam_id) REFERENCES optical_exams(id) ON DELETE CASCADE,
      FOREIGN KEY(layout_id) REFERENCES exam_layouts(id) ON DELETE CASCADE
    );
  `);

  // Insert default layout if no layouts exist
  const defaultLayoutData = JSON.stringify({
    rows: [
      { id: 'row-1', cards: [{ id: 'exam-details', type: 'exam-details' }] },
      { id: 'row-2', cards: [{ id: 'old-refraction', type: 'old-refraction' }] },
      { id: 'row-3', cards: [{ id: 'objective', type: 'objective' }] },
      { id: 'row-4', cards: [{ id: 'subjective', type: 'subjective' }] },
      { id: 'row-5', cards: [{ id: 'final-subjective', type: 'final-subjective' }] },
      { id: 'row-6', cards: [{ id: 'addition', type: 'addition' }] },
      { id: 'row-7', cards: [{ id: 'notes', type: 'notes' }] }
    ],
    customWidths: {}
  });

  // Add type column to existing exam_layouts table if it doesn't exist
  try {
    db.exec(`ALTER TABLE exam_layouts ADD COLUMN type TEXT CHECK(type IN ('opticlens','exam')) DEFAULT 'exam'`);
  } catch (e) { /* Column already exists */ }

  // Update existing records to have default type value
  db.exec(`
    UPDATE exam_layouts 
    SET type = 'exam' 
    WHERE type IS NULL
  `);

  const insertExamLayout = db.prepare(`
    INSERT OR IGNORE INTO exam_layouts (id, name, layout_data, type, is_default) 
    VALUES (?, ?, ?, ?, ?)
  `);
  insertExamLayout.run(1, 'ברירת מחדל', defaultLayoutData, 'exam', 1);

  // Insert sample clients for demonstration
  const insertClient = db.prepare(`
    INSERT OR IGNORE INTO clients (
      id, first_name, last_name, gender, national_id, date_of_birth,
      health_fund, address_city, address_street, address_number,
      phone_mobile, email, file_creation_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), ?)
  `);

  insertClient.run(
    1, 'יוסי', 'כהן', 'זכר', '123456789', '1980-05-15',
    'כללית', 'תל אביב', 'רחוב דיזנגוף', '123',
    '050-1234567', 'yossi.cohen@email.com', 'פעיל'
  );

  insertClient.run(
    2, 'שרה', 'לוי', 'נקבה', '987654321', '1992-08-22',
    'מכבי', 'ירושלים', 'רחוב יפו', '456',
    '052-9876543', 'sarah.levi@email.com', 'פעיל'
  );

  insertClient.run(
    3, 'דוד', 'ישראלי', 'זכר', '456789123', '1975-12-03',
    'לאומית', 'חיפה', 'רחוב הרצל', '789',
    '054-5555555', 'david.israeli@email.com', 'פעיל'
  );

  // Insert sample appointments
  const insertAppointment = db.prepare(`
    INSERT OR IGNORE INTO appointments (
      id, client_id, user_id, date, time, exam_name, note
    ) VALUES (?, ?, ?, date('now', ?), ?, ?, ?)
  `);

  insertAppointment.run(1, 1, 1, '+1 day', '09:00', 'בדיקת ראייה שגרתית', 'בדיקה שנתית');
  insertAppointment.run(2, 2, 2, '+2 days', '14:30', 'התאמת עדשות מגע', 'לקוח חדש');
  insertAppointment.run(3, 3, 1, '+3 days', '11:15', 'בדיקת משקפיים חדשים', 'שינוי במרשם');

  // Create uncorrected_va_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS uncorrected_va_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_fv TEXT,
      l_fv TEXT,
      r_iv TEXT,
      l_iv TEXT,
      r_nv_j TEXT,
      l_nv_j TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create keratometer_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS keratometer_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_k1 REAL,
      r_k2 REAL,
      r_axis INTEGER,
      l_k1 REAL,
      l_k2 REAL,
      l_axis INTEGER,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create keratometer_full_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS keratometer_full_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_dpt_k1 REAL,
      r_dpt_k2 REAL,
      l_dpt_k1 REAL,
      l_dpt_k2 REAL,
      r_mm_k1 REAL,
      r_mm_k2 REAL,
      l_mm_k1 REAL,
      l_mm_k2 REAL,
      r_mer_k1 REAL,
      r_mer_k2 REAL,
      l_mer_k1 REAL,
      l_mer_k2 REAL,
      r_astig BOOLEAN,
      l_astig BOOLEAN,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create corneal_topography_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS corneal_topography_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      l_note TEXT,
      r_note TEXT,
      title TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create anamnesis_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS anamnesis_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      medications TEXT,
      allergies TEXT,
      family_history TEXT,
      previous_treatments TEXT,
      lazy_eye TEXT,
      contact_lens_wear INTEGER DEFAULT 0,
      started_wearing_since TEXT,
      stopped_wearing_since TEXT,
      additional_notes TEXT,
      FOREIGN KEY (layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create cover_test_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cover_test_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      card_instance_id TEXT,
      card_id TEXT,
      tab_index INTEGER,
      deviation_type TEXT,
      deviation_direction TEXT,
      fv_1 REAL,
      fv_2 REAL,
      nv_1 REAL,
      nv_2 REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create schirmer_test_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS schirmer_test_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_mm REAL,
      l_mm REAL,
      r_but REAL,
      l_but REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create old_ref_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS old_ref_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      role TEXT,
      source TEXT,
      contacts TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create campaigns table
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      filters TEXT,
      email_enabled BOOLEAN DEFAULT 0,
      email_content TEXT,
      sms_enabled BOOLEAN DEFAULT 0,
      sms_content TEXT,
      active BOOLEAN DEFAULT 0,
      active_since DATETIME,
      mail_sent BOOLEAN DEFAULT 0,
      sms_sent BOOLEAN DEFAULT 0,
      emails_sent_count INTEGER DEFAULT 0,
      sms_sent_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      cycle_type TEXT CHECK(cycle_type IN ('daily','monthly','yearly','custom')) DEFAULT 'daily',
      cycle_custom_days INTEGER,
      last_executed DATETIME,
      execute_once_per_client BOOLEAN DEFAULT 0
    );
  `);

  // Add new cycle time columns to existing campaigns table if they don't exist
  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN cycle_type TEXT CHECK(cycle_type IN ('daily','monthly','yearly','custom')) DEFAULT 'daily'`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN cycle_custom_days INTEGER`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN last_executed DATETIME`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN execute_once_per_client BOOLEAN DEFAULT 0`);
  } catch (e) { /* Column already exists */ }

  // Add new count columns to existing campaigns table if they don't exist
  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN emails_sent_count INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }

  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN sms_sent_count INTEGER DEFAULT 0`);
  } catch (e) { /* Column already exists */ }

  // Update existing campaigns to have default cycle_type value
  db.exec(`
    UPDATE campaigns
    SET cycle_type = 'daily'
    WHERE cycle_type IS NULL
  `);

  // Create campaign_client_executions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_client_executions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campaign_id INTEGER NOT NULL,
      client_id INTEGER NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      UNIQUE(campaign_id, client_id)
    );
  `);

  // Create work_shifts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS work_shifts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT,
      duration_minutes INTEGER,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('active', 'completed', 'cancelled')) DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  // Create index for efficient querying of work shifts by user and date
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_work_shifts_user_date 
    ON work_shifts(user_id, date);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_work_shifts_date 
    ON work_shifts(date);
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS notes_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      card_instance_id TEXT,
      title TEXT DEFAULT 'הערות',
      note TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create contact_lens_diameters table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_lens_diameters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      pupil_diameter REAL,
      corneal_diameter REAL,
      eyelid_aperture REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create contact_lens_details table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_lens_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      l_lens_type TEXT,
      l_model TEXT,
      l_supplier TEXT,
      l_material TEXT,
      l_color TEXT,
      l_quantity INTEGER,
      l_order_quantity INTEGER,
      l_dx BOOLEAN,
      r_lens_type TEXT,
      r_model TEXT,
      r_supplier TEXT,
      r_material TEXT,
      r_color TEXT,
      r_quantity INTEGER,
      r_order_quantity INTEGER,
      r_dx BOOLEAN,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create keratometer_contact_lens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS keratometer_contact_lens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      l_rh REAL,
      l_rv REAL,
      l_avg REAL,
      l_cyl REAL,
      l_ax INTEGER,
      l_ecc REAL,
      r_rh REAL,
      r_rv REAL,
      r_avg REAL,
      r_cyl REAL,
      r_ax INTEGER,
      r_ecc REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create contact_lens_exam table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_lens_exam (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      comb_va REAL,
      l_bc REAL,
      l_bc_2 REAL,
      l_oz REAL,
      l_diam REAL,
      l_sph REAL,
      l_cyl REAL,
      l_ax INTEGER,
      l_read_ad REAL,
      l_va REAL,
      l_j REAL,
      r_bc REAL,
      r_bc_2 REAL,
      r_oz REAL,
      r_diam REAL,
      r_sph REAL,
      r_cyl REAL,
      r_ax INTEGER,
      r_read_ad REAL,
      r_va REAL,
      r_j REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS old_contact_lenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_lens_type TEXT,
      l_lens_type TEXT,
      r_model TEXT,
      l_model TEXT,
      r_supplier TEXT,
      l_supplier TEXT,
      l_bc REAL,
      l_diam REAL,
      l_sph REAL,
      l_cyl REAL,
      l_ax REAL,
      l_va REAL,
      l_j REAL,
      r_bc REAL,
      r_diam REAL,
      r_sph REAL,
      r_cyl REAL,
      r_ax REAL,
      r_va REAL,
      r_j REAL,
      comb_va REAL,
      comb_j REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);
  db.exec(`
    CREATE TABLE IF NOT EXISTS over_refraction (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_sph REAL,
      l_sph REAL,
      r_cyl REAL,
      l_cyl REAL,
      r_ax REAL,
      l_ax REAL,
      r_va REAL,
      l_va REAL,
      r_j REAL,
      l_j REAL,
      comb_va REAL,
      comb_j REAL,
      l_add REAL,
      r_add REAL,
      l_florescent TEXT,
      r_florescent TEXT,
      l_bio_m TEXT,
      r_bio_m TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Add this in createTables after other exam tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS sensation_vision_stability_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      r_sensation TEXT,
      l_sensation TEXT,
      r_vision TEXT,
      l_vision TEXT,
      r_stability TEXT,
      l_stability TEXT,
      r_movement TEXT,
      l_movement TEXT,
      r_recommendations TEXT,
      l_recommendations TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create diopter_adjustment_panel table
  db.exec(`
    CREATE TABLE IF NOT EXISTS diopter_adjustment_panel (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      layout_instance_id INTEGER NOT NULL,
      right_diopter REAL,
      left_diopter REAL,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  db.prepare(`CREATE TABLE IF NOT EXISTS fusion_range_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layout_instance_id INTEGER NOT NULL,
    fv_base_in REAL,
    fv_base_in_recovery REAL,
    fv_base_out REAL,
    fv_base_out_recovery REAL,
    nv_base_in REAL,
    nv_base_in_recovery REAL,
    nv_base_out REAL,
    nv_base_out_recovery REAL,
    FOREIGN KEY (layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS maddox_rod_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layout_instance_id INTEGER NOT NULL,
    c_r_h REAL,
    c_r_v REAL,
    c_l_h REAL,
    c_l_v REAL,
    wc_r_h REAL,
    wc_r_v REAL,
    wc_l_h REAL,
    wc_l_v REAL,
    FOREIGN KEY (layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS stereo_test_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layout_instance_id INTEGER NOT NULL,
    fly_result INTEGER,
    circle_score INTEGER,
    circle_max INTEGER,
    FOREIGN KEY (layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS ocular_motor_assessment_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layout_instance_id INTEGER NOT NULL,
    ocular_motility TEXT,
    acc_od REAL,
    acc_os REAL,
    npc_break REAL,
    npc_recovery REAL,
    FOREIGN KEY (layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS rg_exams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    layout_instance_id INTEGER NOT NULL,
    rg_status TEXT CHECK(rg_status IN ('suppression', 'fusion', 'diplopia')),
    suppressed_eye TEXT CHECK(suppressed_eye IN ('R', 'G')) DEFAULT NULL,
    FOREIGN KEY (layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
  )`).run();
};
