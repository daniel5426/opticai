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
  r_pd_far?: number;
  l_pd_far?: number;
  comb_pd_far?: number;
  r_pd_close?: number;
  l_pd_close?: number;
  comb_pd_close?: number;
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
  r_pd_far?: number;
  l_pd_far?: number;
  comb_pd_far?: number;
  r_pd_close?: number;
  l_pd_close?: number;
  comb_pd_close?: number;
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

