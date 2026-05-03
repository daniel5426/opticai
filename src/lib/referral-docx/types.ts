import type {
  Client,
  Clinic,
  Company,
  Referral,
  User,
} from "@/lib/db/schema-interface";

export interface LoadedReferralExportContext {
  referral: Referral;
  client?: Client;
  user?: User | null;
  clinic?: Clinic | null;
  company?: Company | null;
}

export interface ReferralPrintModel {
  company_name: string;
  company_address: string;
  company_phone: string;
  company_email: string;
  clinic_name: string;
  clinic_address: string;
  clinic_phone: string;
  clinic_email: string;
  clinic_website: string;
  referral_number: string;
  referral_date: string;
  referral_type: string;
  urgency_level: string;
  recipient: string;
  client_name: string;
  client_id: string;
  client_birth_date: string;
  client_address: string;
  phone_mobile: string;
  phone_home: string;
  examiner_name: string;
  has_referral_notes: boolean;
  referral_notes: string;
  has_clinical_findings: boolean;
  clinical_impression: string;
  r_iop: string;
  l_iop: string;
  has_compact_prescription: boolean;
  r_sph: string;
  r_cyl: string;
  r_ax: string;
  r_pris: string;
  r_base: string;
  r_va: string;
  r_add: string;
  r_pd: string;
  l_sph: string;
  l_cyl: string;
  l_ax: string;
  l_pris: string;
  l_base: string;
  l_va: string;
  l_add: string;
  l_pd: string;
  comb_va: string;
  comb_pd: string;
  signer_name: string;
  signer_title: string;
  license_number: string;
}
