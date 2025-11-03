import { Database } from "better-sqlite3";

export const createTables = (db: Database): void => {
  // Create companies table
  db.exec(`
    CREATE TABLE IF NOT EXISTS companies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      owner_full_name TEXT NOT NULL,
      contact_email TEXT ,
      contact_phone TEXT ,
      logo_path TEXT,
      address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create clinics table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clinics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      phone_number TEXT,
      email TEXT,
      unique_id TEXT UNIQUE NOT NULL,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
    );
  `);

  // Create families table
  db.exec(`
    CREATE TABLE IF NOT EXISTS families (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER,
      name TEXT NOT NULL,
      created_date DATE DEFAULT CURRENT_DATE,
      notes TEXT,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    );
  `);

  // Create clients table
  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER,
      first_name TEXT,
      last_name TEXT,
      gender TEXT,
      national_id TEXT,
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
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY(family_id) REFERENCES families(id)
    );
  `);

  // Add clinic_id to existing clients table if it doesn't exist
  try {
    db.exec(`ALTER TABLE clients ADD COLUMN clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE`);
  } catch (e) { /* Column already exists */ }

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
      clinic_id INTEGER,
      user_id INTEGER,
      log_date DATE,
      log TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Create optical_exams table
  db.exec(`
    CREATE TABLE IF NOT EXISTS optical_exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      clinic_id INTEGER,
      clinic TEXT,
      user_id INTEGER,
      exam_date DATE,
      test_name TEXT,
      dominant_eye CHAR(1) CHECK(dominant_eye IN ('R','L')),
      type TEXT CHECK(type IN ('opticlens','exam')) DEFAULT 'exam',
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
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
      clinic_id INTEGER,
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
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
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
      clinic_id INTEGER,
      user_id INTEGER,
      referral_notes TEXT,
      prescription_notes TEXT,
      date DATE,
      type TEXT,
      branch TEXT,
      recipient TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
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
      clinic_id INTEGER,
      user_id INTEGER,
      date DATE,
      time TEXT,
      duration INTEGER DEFAULT 30,
      exam_name TEXT,
      note TEXT,
      google_calendar_event_id TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id)
    );
  `);

  // Create files table
  db.exec(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      clinic_id INTEGER,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER,
      file_type TEXT,
      upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      uploaded_by INTEGER,
      notes TEXT,
      FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
      FOREIGN KEY(uploaded_by) REFERENCES users(id)
    );
  `);

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER,
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    );
  `);

  // Add clinic_id to existing settings table if it doesn't exist
  try {
    db.exec(`ALTER TABLE settings ADD COLUMN clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE`);
  } catch (e) { /* Column already exists */ }

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
      clinic_id INTEGER,
      username TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      password TEXT,
      role_level INTEGER NOT NULL DEFAULT 1 CHECK(role_level BETWEEN 1 AND 4),
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
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    );
  `);

  // Add clinic_id to existing users table if it doesn't exist
  try {
    db.exec(`ALTER TABLE users ADD COLUMN clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE`);
  } catch (e) { /* Column already exists */ }

  // Remove unique constraint from username to allow same username across different clinics
  try {
    db.exec(`
      CREATE TABLE users_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        clinic_id INTEGER,
        username TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        password TEXT,
        role_level INTEGER NOT NULL DEFAULT 1 CHECK(role_level BETWEEN 1 AND 4),
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
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE,
        UNIQUE(clinic_id, username)
      );
      INSERT INTO users_new SELECT * FROM users;
      DROP TABLE users;
      ALTER TABLE users_new RENAME TO users;
    `);
  } catch (e) { /* Table structure already updated */ }


  // Create chats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER,
      title TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
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
      clinic_id INTEGER,
      name TEXT NOT NULL,
      layout_data TEXT NOT NULL,
      type TEXT CHECK(type IN ('opticlens','exam')) DEFAULT 'exam',
      is_default BOOLEAN DEFAULT 0,
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    );
  `);

  // Add clinic_id to existing exam_layouts table if it doesn't exist
  try {
    db.exec(`ALTER TABLE exam_layouts ADD COLUMN clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE`);
  } catch (e) { /* Column already exists */ }

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

  // Only insert sample clients and appointments if companies exist (multi-clinic mode)
  const companiesCount = db.prepare(`SELECT COUNT(*) as count FROM companies`).get() as { count: number };
  
  if (companiesCount.count > 0) {
    // Insert sample clients for demonstration
    const insertClient = db.prepare(`
      INSERT OR IGNORE INTO clients (
        id, clinic_id, first_name, last_name, gender, national_id, date_of_birth,
        health_fund, address_city, address_street, address_number,
        phone_mobile, email, file_creation_date, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), ?)
    `);

    // Get the first clinic ID for sample data
    const firstClinic = db.prepare(`SELECT id FROM clinics ORDER BY id LIMIT 1`).get() as { id: number } | undefined;
    const clinicId = firstClinic?.id || 1;

    insertClient.run(
      1, clinicId, 'יוסי', 'כהן', 'זכר', '123456789', '1980-05-15',
      'כללית', 'תל אביב', 'רחוב דיזנגוף', '123',
      '050-1234567', 'yossi.cohen@email.com', 'פעיל'
    );

    insertClient.run(
      2, clinicId, 'שרה', 'לוי', 'נקבה', '987654321', '1992-08-22',
      'מכבי', 'ירושלים', 'רחוב יפו', '456',
      '052-9876543', 'sarah.levi@email.com', 'פעיל'
    );

    insertClient.run(
      3, clinicId, 'דוד', 'ישראלי', 'זכר', '456789123', '1975-12-03',
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
  }

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
      role_level INTEGER,
      source TEXT,
      contacts TEXT,
      FOREIGN KEY(layout_instance_id) REFERENCES exam_layout_instances(id) ON DELETE CASCADE
    );
  `);

  // Create campaigns table
  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id INTEGER,
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
      execute_once_per_client BOOLEAN DEFAULT 0,
      FOREIGN KEY(clinic_id) REFERENCES clinics(id) ON DELETE CASCADE
    );
  `);

  // Add clinic_id to existing campaigns table if it doesn't exist
  try {
    db.exec(`ALTER TABLE campaigns ADD COLUMN clinic_id INTEGER REFERENCES clinics(id) ON DELETE CASCADE`);
  } catch (e) { /* Column already exists */ }

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
