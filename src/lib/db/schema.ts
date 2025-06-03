import { Database } from 'better-sqlite3';

export interface Client {
  id?: number;
  first_name?: string;
  last_name?: string;
  gender?: string;
  national_id?: string;
  date_of_birth?: string;
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
}

export interface MedicalLog {
  id?: number;
  client_id: number;
  log_date?: string;
  log?: string;
}

export interface OpticalExam {
  id?: number;
  client_id: number;
  clinic?: string;
  examiner_name?: string;
  exam_date?: string;
  test_name?: string;
  dominant_eye?: string;
  notes?: string;

  comb_subj_va?: number;
  comb_old_va?: number;
  comb_fa?: number;
  comb_fa_tuning?: number;
  comb_pd_close?: number;
  comb_pd_far?: number;
}

export interface OpticalEyeExam {
  id?: number;
  exam_id: number;
  eye: string;
  old_sph?: number;
  old_cyl?: number;
  old_ax?: number;
  old_pris?: number;
  old_base?: number;
  old_va?: number;
  old_ad?: number;
  obj_sph?: number;
  obj_cyl?: number;
  obj_ax?: number;
  obj_se?: number;
  subj_fa?: number;
  subj_fa_tuning?: number;
  subj_sph?: number;
  subj_cyl?: number;
  subj_ax?: number;
  subj_pris?: number;
  subj_base?: number;
  subj_va?: number;
  subj_pd_close?: number;
  subj_pd_far?: number;
  subj_ph?: number;
  ad_fcc?: number;
  ad_read?: number;
  ad_int?: number;
  ad_bif?: number;
  ad_mul?: number;
  ad_j?: number;
  iop?: number;
}

export interface OpticalOrder {
  id?: number;
  exam_id: number;
  order_date?: string;
  type?: string;
  sph?: number;
  cyl?: number;
  ax?: number;
  pris?: number;
  base?: string;
  va?: string;
  ad?: number;
  diam?: number;
  secondary_base?: number;
  high_curvature?: number;
  pd?: number;
  lens_id?: number;
  frame_id?: number;
}

export interface OrderLens {
  id?: number;
  right_model?: string;
  left_model?: string;
  color?: string;
  coating?: string;
  material?: string;
  supplier?: string;
}

export interface Frame {
  id?: number;
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

export interface ContactLens {
  id?: number;
  exam_date?: string;
  type?: string;
  examiner_name?: string;
  pupil_diameter?: number;
  corneal_diameter?: number;
  eyelid_aperture?: number;
  notes?: string;
  notes_for_supplier?: string;
}

export interface ContactEye {
  id?: number;
  contact_lens_id: number;
  eye: string;
  schirmer_test?: number;
  schirmer_but?: number;
  k_h?: number;
  k_v?: number;
  k_avg?: number;
  k_cyl?: number;
  k_ax?: number;
  k_ecc?: number;
  lens_type?: string;
  model?: string;
  supplier?: string;
  material?: string;
  color?: string;
  quantity?: number;
  order_quantity?: number;
  bc?: number;
  oz?: number;
  diam?: number;
  sph?: number;
  cyl?: number;
  ax?: number;
  read_ad?: number;
  va?: string;
  j?: string;
}

export interface ContactLensOrder {
  id?: number;
  contact_lens_id: number;
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
  total_before_discount?: number;
  discount_amount?: number;
  discount_percent?: number;
  total_after_discount?: number;
  prepayment_amount?: number;
  installment_count?: number;
  notes?: string;
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

export const createTables = (db: Database): void => {
  // Create clients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT,
      last_name TEXT,
      gender TEXT,
      national_id TEXT UNIQUE,
      date_of_birth DATE,
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
      notes TEXT
    );
  `);

  // Create medical_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS medical_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      log_date DATE,
      log TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `);

  // Create optical_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS optical_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      clinic TEXT,
      examiner_name TEXT,
      exam_date DATE,
      test_name TEXT,
      dominant_eye CHAR(1) CHECK(dominant_eye IN ('R','L')),
      notes TEXT,
      comb_subj_va REAL,
      comb_old_va REAL,
      comb_fa REAL,
      comb_fa_tuning REAL,
      comb_pd_close REAL,
      comb_pd_far REAL,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `);

  // Create optical_eye_exam table
  db.exec(`
    CREATE TABLE IF NOT EXISTS optical_eye_exam (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      eye CHAR(1) CHECK(eye IN ('R','L')),
      old_sph REAL,
      old_cyl REAL,
      old_ax INTEGER,
      old_pris REAL,
      old_base REAL,
      old_va REAL,
      old_ad REAL,
      obj_sph REAL,
      obj_cyl REAL,
      obj_ax INTEGER,
      obj_se REAL,
      subj_fa REAL,
      subj_fa_tuning REAL,
      subj_sph REAL,
      subj_cyl REAL,
      subj_ax INTEGER,
      subj_pris REAL,
      subj_base REAL,
      subj_va REAL,
      subj_pd_close REAL,
      subj_pd_far REAL,
      subj_ph REAL,
      ad_fcc REAL,
      ad_read REAL,
      ad_int REAL,
      ad_bif REAL,
      ad_mul REAL,
      ad_j REAL,
      iop REAL,
      FOREIGN KEY(exam_id) REFERENCES optical_exams(id) ON DELETE CASCADE
    );
  `);

  // Create optical_orders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS optical_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_id INTEGER NOT NULL,
      order_date DATE,
      type TEXT,
      sph REAL,
      cyl REAL,
      ax INTEGER,
      pris REAL,
      base TEXT,
      va TEXT,
      ad REAL,
      diam REAL,
      secondary_base REAL,
      high_curvature REAL,
      pd REAL,
      lens_id INTEGER,
      frame_id INTEGER,
      FOREIGN KEY(exam_id) REFERENCES optical_exams(id) ON DELETE CASCADE,
      FOREIGN KEY(lens_id) REFERENCES order_lenses(id),
      FOREIGN KEY(frame_id) REFERENCES frames(id)
    );
  `);

  // Create order_lenses table
  db.exec(`
    CREATE TABLE IF NOT EXISTS order_lenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      right_model TEXT,
      left_model TEXT,
      color TEXT,
      coating TEXT,
      material TEXT,
      supplier TEXT
    );
  `);

  // Create frames table
  db.exec(`
    CREATE TABLE IF NOT EXISTS frames (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      color TEXT,
      supplier TEXT,
      model TEXT,
      manufacturer TEXT,
      supplied_by TEXT,
      bridge REAL,
      width REAL,
      height REAL,
      length REAL
    );
  `);

  // Create contact_lens table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_lens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exam_date DATE,
      type TEXT,
      examiner_name TEXT,
      pupil_diameter REAL,
      corneal_diameter REAL,
      eyelid_aperture REAL,
      notes TEXT,
      notes_for_supplier TEXT
    );
  `);

  // Create contact_eye table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_eye (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_lens_id INTEGER NOT NULL,
      eye TEXT CHECK(eye IN ('R','L')),
      schirmer_test REAL,
      schirmer_but REAL,
      k_h REAL,
      k_v REAL,
      k_avg REAL,
      k_cyl REAL,
      k_ax INTEGER,
      k_ecc REAL,
      lens_type TEXT,
      model TEXT,
      supplier TEXT,
      material TEXT,
      color TEXT,
      quantity INTEGER,
      order_quantity INTEGER,
      bc REAL,
      oz REAL,
      diam REAL,
      sph REAL,
      cyl REAL,
      ax INTEGER,
      read_ad REAL,
      va TEXT,
      j TEXT,
      FOREIGN KEY(contact_lens_id) REFERENCES contact_lens(id)
    );
  `);

  // Create contact_lens_order table
  db.exec(`
    CREATE TABLE IF NOT EXISTS contact_lens_order (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_lens_id INTEGER NOT NULL,
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
      FOREIGN KEY(contact_lens_id) REFERENCES contact_lens(id)
    );
  `);

  // Create billings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS billings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_lens_id INTEGER,
      optical_exams_id INTEGER,
      total_before_discount REAL,
      discount_amount REAL,
      discount_percent REAL,
      total_after_discount REAL,
      prepayment_amount REAL,
      installment_count INTEGER,
      notes TEXT,
      FOREIGN KEY(contact_lens_id) REFERENCES contact_lens(id),
      FOREIGN KEY(optical_exams_id) REFERENCES optical_exams(id)
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
      FOREIGN KEY(billings_id) REFERENCES billings(id)
    );
  `);
};
  