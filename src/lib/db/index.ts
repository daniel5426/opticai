import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { googleCalendarSync } from '../google/google-calendar-sync';
import {
  createTables,
  Client,
  Family,
  OpticalExam,
  OldRefractionExam,
  OldRefractionExtensionExam,
  ObjectiveExam,
  SubjectiveExam,
  AdditionExam,
  FinalSubjectiveExam,
  FinalPrescriptionExam,
  RetinoscopExam,
  RetinoscopDilationExam,
  Order,
  OrderEye,
  OrderLens,
  Frame,
  OrderDetails,
  MedicalLog,
  ContactLensOrder,
  Billing,
  OrderLineItem,
  Referral,
  ReferralEye,
  Appointment,
  Settings,
  User,
  Chat,
  ChatMessage,
  EmailLog,
  File,
  LookupSupplier,
  LookupClinic,
  LookupOrderType,
  LookupReferralType,
  LookupLensModel,
  LookupColor,
  LookupMaterial,
  LookupCoating,
  LookupManufacturer,
  LookupFrameModel,
  LookupContactLensType,
  LookupContactEyeLensType,
  LookupContactEyeMaterial,
  LookupCleaningSolution,
  LookupDisinfectionSolution,
  LookupRinsingSolution,
  LookupManufacturingLab,
  LookupAdvisor,
  ExamLayout,
  ExamLayoutInstance,
  UncorrectedVAExam,
  KeratometerExam,
  KeratometerFullExam,
  CornealTopographyExam,
  CoverTestExam,
  SchirmerTestExam,
  WorkShift,
  CompactPrescriptionExam,
  Campaign,
  AnamnesisExam,
  NotesExam,
  OldRefExam,
  ContactLensDiameters,
  ContactLensDetails,
  KeratometerContactLens,
  ContactLensExam,
  OldContactLenses,
  OverRefraction,
  SensationVisionStabilityExam,
  DiopterAdjustmentPanel,
  FusionRangeExam,
  MaddoxRodExam,
  StereoTestExam,
  RGExam,
  OcularMotorAssessmentExam,
  Company,
  Clinic
} from './schema';
import * as usersDb from './users-db'
import * as workShiftsDb from './work-shifts-db'
import * as anamnesisDb from './anamnesis-db'
import * as notesDb from './notes-db'

class DatabaseService {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'database.sqlite');

    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  }

  initialize(): void {
    try {
      this.db = new Database(this.dbPath);
      this.db.pragma('journal_mode = WAL');
      this.db.pragma('foreign_keys = ON');

      createTables(this.db);
      this.migrateDatabase();

      this.seedInitialData();

      console.log('Database initialized successfully at:', this.dbPath);
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  private migrateDatabase(): void {
    if (!this.db) return;

    try {
      // Check if notes columns exist in order_details table
      const orderDetailsInfo = this.db.prepare("PRAGMA table_info(order_details)").all() as unknown[];
      const hasNotesColumn = orderDetailsInfo.some(col => col.name === 'notes');
      const hasLensOrderNotesColumn = orderDetailsInfo.some(col => col.name === 'lens_order_notes');

      // Add notes column if it doesn't exist
      if (!hasNotesColumn) {
        this.db.exec('ALTER TABLE order_details ADD COLUMN notes TEXT');
        console.log('Added notes column to order_details table');
      }

      // Add lens_order_notes column if it doesn't exist
      if (!hasLensOrderNotesColumn) {
        this.db.exec('ALTER TABLE order_details ADD COLUMN lens_order_notes TEXT');
        console.log('Added lens_order_notes column to order_details table');
      }

      // Check if appointments table has duration column
      const appointmentsInfo = this.db.prepare("PRAGMA table_info(appointments)").all() as unknown[];
      const hasDurationColumn = appointmentsInfo.some(col => col.name === 'duration');
      const hasGoogleCalendarEventIdColumn = appointmentsInfo.some(col => col.name === 'google_calendar_event_id');
      
      // Add duration column if it doesn't exist
      if (!hasDurationColumn) {
        this.db.exec('ALTER TABLE appointments ADD COLUMN duration INTEGER DEFAULT 30');
        console.log('Added duration column to appointments table');
      }

      // Add google_calendar_event_id column if it doesn't exist
      if (!hasGoogleCalendarEventIdColumn) {
        this.db.exec('ALTER TABLE appointments ADD COLUMN google_calendar_event_id TEXT');
        console.log('Added google_calendar_event_id column to appointments table');
      }

      // Check if clients table has family columns
      const clientsInfo = this.db.prepare("PRAGMA table_info(clients)").all() as unknown[];
      const hasFamilyIdColumn = clientsInfo.some(col => col.name === 'family_id');
      const hasFamilyRoleColumn = clientsInfo.some(col => col.name === 'family_role');

      // Add family_id column if it doesn't exist
      if (!hasFamilyIdColumn) {
        this.db.exec('ALTER TABLE clients ADD COLUMN family_id INTEGER');
        console.log('Added family_id column to clients table');
      }

      // Add family_role column if it doesn't exist
      if (!hasFamilyRoleColumn) {
        this.db.exec('ALTER TABLE clients ADD COLUMN family_role TEXT');
        console.log('Added family_role column to clients table');
      }

      // Check if appointments table has redundant client fields that should be removed
      const hasFirstNameColumn = appointmentsInfo.some(col => col.name === 'first_name');
      const hasLastNameColumn = appointmentsInfo.some(col => col.name === 'last_name');
      const hasPhoneMobileColumn = appointmentsInfo.some(col => col.name === 'phone_mobile');
      const hasEmailColumn = appointmentsInfo.some(col => col.name === 'email');

      // If redundant client fields exist, migrate to new structure
      if (hasFirstNameColumn || hasLastNameColumn || hasPhoneMobileColumn || hasEmailColumn) {
        console.log('Migrating appointments table to remove redundant client fields...');

        // Create backup of existing data
        const existingAppointments = this.db.prepare('SELECT * FROM appointments').all() as unknown[];

        // Drop and recreate table with new structure (without redundant client fields)
        this.db.exec('DROP TABLE appointments');
        this.db.exec(`
          CREATE TABLE appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            date DATE,
            time TEXT,
            exam_name TEXT,
            note TEXT,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
          )
        `);

        // Restore data without the redundant client fields
        for (const appointment of existingAppointments) {
          this.db.prepare(`
            INSERT INTO appointments (id, client_id, date, time, exam_name, note)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            appointment.id,
            appointment.client_id,
            appointment.date,
            appointment.time,
            appointment.exam_name,
            appointment.note
          );
        }

        console.log('Appointments table migration completed - redundant client fields removed');
      }
    } catch (error) {
      console.error('Error during database migration:', error);
    }
  }

  private seedInitialData(): void {
    if (!this.db) return;

    try {
      // Check if we're in multi-clinic mode (companies exist)
      const companyCount = this.db.prepare('SELECT COUNT(*) as count FROM companies').get() as { count: number };
      
      // Only seed data if we're in multi-clinic mode and have companies but no clients
      if (companyCount.count > 0) {
        const clientCount = this.db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number };

        if (clientCount.count === 0) {
          console.log('Seeding database with initial data for multi-clinic mode...');

          const clients = [
            {
              first_name: "דוד",
              last_name: "כהן",
              gender: "זכר",
              national_id: "123456789",
              date_of_birth: "1985-05-15",
              address_city: "תל אביב",
              phone_mobile: "0501234567",
              email: "david@example.com",
              file_creation_date: new Date().toISOString().split('T')[0]
            },
            {
              first_name: "שרה",
              last_name: "לוי",
              gender: "נקבה",
              national_id: "987654321",
              date_of_birth: "1990-10-20",
              address_city: "ירושלים",
              phone_mobile: "0507654321",
              email: "sarah@example.com",
              file_creation_date: new Date().toISOString().split('T')[0]
            },
            {
              first_name: "יוסי",
              last_name: "אברהם",
              gender: "זכר",
              national_id: "456789123",
              date_of_birth: "1978-03-25",
              address_city: "חיפה",
              phone_mobile: "0509876543",
              email: "yossi@example.com",
              file_creation_date: new Date().toISOString().split('T')[0]
            }
          ];

          clients.forEach(client => {
            const createdClient = this.createClient(client);
            if (createdClient) {
              const exam = this.createExam({
                client_id: createdClient.id!,
                clinic: "מרפאת עיניים ראשית",
                user_id: 1,
                exam_date: "2024-01-15",
                test_name: "בדיקת ראייה מקיפה",
                dominant_eye: "R",
              });

              if (exam) {
                // First create a default layout
                const layout = this.createExamLayout({
                  name: "Default Layout",
                  layout_data: "[]",
                  is_default: true
                });
                
                if (!layout) return;

                // Create a layout instance for this exam
                const layoutInstance = this.createExamLayoutInstance({
                  exam_id: exam.id!,
                  layout_id: layout.id!,
                  is_active: true,
                  order: 0
                });

                if (!layoutInstance) return;
                
                // Create old refraction exam data
                this.createOldRefractionExam({
                  layout_instance_id: layoutInstance.id!,
                  r_sph: -1.25,
                  l_sph: -1.0,
                  r_cyl: -0.5,
                  l_cyl: -0.25,
                  r_ax: 180,
                  l_ax: 90,
                  r_va: 0.6,
                  l_va: 0.6,
                  comb_va: 0.8
                });

                // Create objective exam data
                this.createObjectiveExam({
                  layout_instance_id: layoutInstance.id!,
                  r_sph: -1.5,
                  l_sph: -1.25,
                  r_cyl: -0.75,
                  l_cyl: -0.5,
                  r_ax: 175,
                  l_ax: 85,
                  r_se: -1.875,
                  l_se: -1.5
                });

                // Create subjective exam data
                this.createSubjectiveExam({
                  layout_instance_id: layoutInstance.id!,
                  r_fa: 6,
                  l_fa: 6,
                  r_sph: -1.5,
                  l_sph: -1.25,
                  r_cyl: -0.75,
                  l_cyl: -0.5,
                  r_ax: 175,
                  l_ax: 85,
                  r_va: 1.0,
                  l_va: 1.0,
                  r_pd_close: 32,
                  l_pd_close: 31,
                  r_pd_far: 33,
                  l_pd_far: 32,
                  comb_va: 1.0,
                  comb_fa: 6,
                  comb_pd_close: 62,
                  comb_pd_far: 64
                });

                // Create addition exam data
                this.createAdditionExam({
                  layout_instance_id: layoutInstance.id!,
                  r_fcc: 0.75,
                  l_fcc: 0.75,
                  r_read: 1.0,
                  l_read: 1.0,
                  r_j: 1,
                  l_j: 1
                });
              }
            }
          });

          console.log('Initial data seeded successfully for multi-clinic mode');
        }
      } else {
        console.log('No companies found - skipping data seeding to allow welcome screen flow');
      }
    } catch (error) {
      console.error('Error seeding initial data:', error);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  private sanitizeValue(value: unknown): unknown {
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    if (value === undefined) {
      return null;
    }
    return value;
  }

  // Client CRUD operations
  createClient(client: Omit<Client, 'id'>): Client | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO clients (
          clinic_id, first_name, last_name, gender, national_id, date_of_birth,
          address_city, address_street, address_number, postal_code,
          phone_home, phone_work, phone_mobile, fax, email,
          service_center, file_creation_date, membership_end, service_end,
          price_list, discount_percent, blocked_checks, blocked_credit,
          sorting_group, referring_party, file_location, occupation, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        this.sanitizeValue(client.clinic_id),
        this.sanitizeValue(client.first_name),
        this.sanitizeValue(client.last_name),
        this.sanitizeValue(client.gender),
        this.sanitizeValue(client.national_id),
        this.sanitizeValue(client.date_of_birth),
        this.sanitizeValue(client.address_city),
        this.sanitizeValue(client.address_street),
        this.sanitizeValue(client.address_number),
        this.sanitizeValue(client.postal_code),
        this.sanitizeValue(client.phone_home),
        this.sanitizeValue(client.phone_work),
        this.sanitizeValue(client.phone_mobile),
        this.sanitizeValue(client.fax),
        this.sanitizeValue(client.email),
        this.sanitizeValue(client.service_center),
        this.sanitizeValue(client.file_creation_date),
        this.sanitizeValue(client.membership_end),
        this.sanitizeValue(client.service_end),
        this.sanitizeValue(client.price_list),
        this.sanitizeValue(client.discount_percent),
        this.sanitizeValue(client.blocked_checks),
        this.sanitizeValue(client.blocked_credit),
        this.sanitizeValue(client.sorting_group),
        this.sanitizeValue(client.referring_party),
        this.sanitizeValue(client.file_location),
        this.sanitizeValue(client.occupation),
        this.sanitizeValue(client.status),
        this.sanitizeValue(client.notes)
      );

      return { ...client, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating client:', error);
      return null;
    }
  }

  getClientById(id: number): Client | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM clients WHERE id = ?');
      return stmt.get(id) as Client | null;
    } catch (error) {
      console.error('Error getting client:', error);
      return null;
    }
  }

  getAllClients(clinicId?: number): Client[] {
    if (!this.db) return [];

    try {
      if (clinicId) {
        const stmt = this.db.prepare('SELECT * FROM clients WHERE clinic_id = ? ORDER BY first_name, last_name');
        return stmt.all(clinicId) as Client[];
      } else {
        const stmt = this.db.prepare('SELECT * FROM clients ORDER BY first_name, last_name');
        return stmt.all() as Client[];
      }
    } catch (error) {
      console.error('Error getting all clients:', error);
      return [];
    }
  }

  updateClient(client: Client): Client | null {
    if (!this.db || !client.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE clients SET 
        first_name = ?, last_name = ?, gender = ?, national_id = ?, date_of_birth = ?,
        address_city = ?, address_street = ?, address_number = ?, postal_code = ?,
        phone_home = ?, phone_work = ?, phone_mobile = ?, fax = ?, email = ?,
        service_center = ?, file_creation_date = ?, membership_end = ?, service_end = ?,
        price_list = ?, discount_percent = ?, blocked_checks = ?, blocked_credit = ?,
        sorting_group = ?, referring_party = ?, file_location = ?, occupation = ?, status = ?, notes = ?,
        profile_picture = ?, family_id = ?, family_role = ?
        WHERE id = ?
      `);

      stmt.run(
        this.sanitizeValue(client.first_name), this.sanitizeValue(client.last_name), this.sanitizeValue(client.gender), this.sanitizeValue(client.national_id), this.sanitizeValue(client.date_of_birth),
        this.sanitizeValue(client.address_city), this.sanitizeValue(client.address_street), this.sanitizeValue(client.address_number), this.sanitizeValue(client.postal_code),
        this.sanitizeValue(client.phone_home), this.sanitizeValue(client.phone_work), this.sanitizeValue(client.phone_mobile), this.sanitizeValue(client.fax), this.sanitizeValue(client.email),
        this.sanitizeValue(client.service_center), this.sanitizeValue(client.file_creation_date), this.sanitizeValue(client.membership_end), this.sanitizeValue(client.service_end),
        this.sanitizeValue(client.price_list), this.sanitizeValue(client.discount_percent), this.sanitizeValue(client.blocked_checks), this.sanitizeValue(client.blocked_credit),
        this.sanitizeValue(client.sorting_group), this.sanitizeValue(client.referring_party), this.sanitizeValue(client.file_location), this.sanitizeValue(client.occupation), this.sanitizeValue(client.status), this.sanitizeValue(client.notes),
        this.sanitizeValue(client.profile_picture), this.sanitizeValue(client.family_id), this.sanitizeValue(client.family_role),
        client.id
      );

      return client;
    } catch (error) {
      console.error('Error updating client:', error);
      return null;
    }
  }

  deleteClient(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM clients WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting client:', error);
      return false;
    }
  }

  // Company CRUD operations
  createCompany(company: Omit<Company, 'id'>): Company | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO companies (name, owner_full_name, contact_email, contact_phone, address, logo_path)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        company.name,
        company.owner_full_name,
        this.sanitizeValue(company.contact_email),
        this.sanitizeValue(company.contact_phone),
        this.sanitizeValue(company.address),
        this.sanitizeValue(company.logo_path)
      );

      return { ...company, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating company:', error);
      return null;
    }
  }

  getCompanyById(id: number): Company | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM companies WHERE id = ?');
      return stmt.get(id) as Company | null;
    } catch (error) {
      console.error('Error getting company:', error);
      return null;
    }
  }

  getAllCompanies(): Company[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM companies ORDER BY name');
      return stmt.all() as Company[];
    } catch (error) {
      console.error('Error getting all companies:', error);
      return [];
    }
  }

  updateCompany(company: Company): Company | null {
    if (!this.db || !company.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE companies SET
        name = ?, owner_full_name = ?, contact_email = ?, contact_phone = ?,
        address = ?, logo_path = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        company.name,
        company.owner_full_name,
        this.sanitizeValue(company.contact_email),
        this.sanitizeValue(company.contact_phone),
        this.sanitizeValue(company.address),
        this.sanitizeValue(company.logo_path),
        company.id
      );

      return company;
    } catch (error) {
      console.error('Error updating company:', error);
      return null;
    }
  }

  deleteCompany(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM companies WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting company:', error);
      return false;
    }
  }

  // Clinic CRUD operations
  createClinic(clinic: Omit<Clinic, 'id'>): Clinic | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO clinics (company_id, name, location, phone_number, email, unique_id, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        clinic.company_id,
        clinic.name,
        clinic.location,
        this.sanitizeValue(clinic.phone_number),
        this.sanitizeValue(clinic.email),
        clinic.unique_id,
        this.sanitizeValue(clinic.is_active ?? true)
      );

      return { ...clinic, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating clinic:', error);
      return null;
    }
  }

  getClinicById(id: number): Clinic | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM clinics WHERE id = ?');
      return stmt.get(id) as Clinic | null;
    } catch (error) {
      console.error('Error getting clinic:', error);
      return null;
    }
  }

  getAllClinics(): Clinic[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM clinics ORDER BY name');
      return stmt.all() as Clinic[];
    } catch (error) {
      console.error('Error getting all clinics:', error);
      return [];
    }
  }

  getClinicsByCompanyId(companyId: number): Clinic[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM clinics WHERE company_id = ? ORDER BY name');
      return stmt.all(companyId) as Clinic[];
    } catch (error) {
      console.error('Error getting clinics by company:', error);
      return [];
    }
  }

  getActiveClinics(): Clinic[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM clinics WHERE is_active = 1 ORDER BY name');
      return stmt.all() as Clinic[];
    } catch (error) {
      console.error('Error getting active clinics:', error);
      return [];
    }
  }

  getClinicByUniqueId(uniqueId: string): Clinic | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM clinics WHERE unique_id = ? AND is_active = 1');
      return stmt.get(uniqueId) as Clinic | null;
    } catch (error) {
      console.error('Error getting clinic by unique ID:', error);
      return null;
    }
  }

  updateClinic(clinic: Clinic): Clinic | null {
    if (!this.db || !clinic.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE clinics SET
        company_id = ?, name = ?, location = ?, phone_number = ?, email = ?,
        unique_id = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        clinic.company_id,
        clinic.name,
        clinic.location,
        this.sanitizeValue(clinic.phone_number),
        this.sanitizeValue(clinic.email),
        clinic.unique_id,
        this.sanitizeValue(clinic.is_active ?? true),
        clinic.id
      );

      return clinic;
    } catch (error) {
      console.error('Error updating clinic:', error);
      return null;
    }
  }

  deleteClinic(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('UPDATE clinics SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deactivating clinic:', error);
      return false;
    }
  }

  // Helper method to check if app is in multi-clinic mode
  isMultiClinicMode(): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM companies');
      const result = stmt.get() as { count: number };
      return result.count > 0;
    } catch (error) {
      console.error('Error checking multi-clinic mode:', error);
      return false;
    }
  }

  // Helper method to get the first company (for single company setups)
  getFirstCompany(): Company | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM companies ORDER BY created_at ASC LIMIT 1');
      return stmt.get() as Company | null;
    } catch (error) {
      console.error('Error getting first company:', error);
      return null;
    }
  }

  // Family CRUD operations
  createFamily(family: Omit<Family, 'id'>): Family | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO families (name, created_date, notes)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(
        family.name,
        family.created_date || new Date().toISOString().split('T')[0],
        family.notes
      );

      return { ...family, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating family:', error);
      return null;
    }
  }

  getFamilyById(id: number): Family | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM families WHERE id = ?');
      return stmt.get(id) as Family | null;
    } catch (error) {
      console.error('Error getting family:', error);
      return null;
    }
  }

  getAllFamilies(): Family[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM families ORDER BY name');
      return stmt.all() as Family[];
    } catch (error) {
      console.error('Error getting all families:', error);
      return [];
    }
  }

  updateFamily(family: Family): Family | null {
    if (!this.db || !family.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE families SET 
        name = ?, notes = ?
        WHERE id = ?
      `);

      stmt.run(family.name, family.notes, family.id);
      return family;
    } catch (error) {
      console.error('Error updating family:', error);
      return null;
    }
  }

  deleteFamily(id: number): boolean {
    if (!this.db) return false;

    try {
      // First remove all clients from this family
      const removeClientsStmt = this.db.prepare('UPDATE clients SET family_id = NULL, family_role = NULL WHERE family_id = ?');
      removeClientsStmt.run(id);

      // Then delete the family
      const stmt = this.db.prepare('DELETE FROM families WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting family:', error);
      return false;
    }
  }

  getFamilyMembers(familyId: number): Client[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM clients WHERE family_id = ? ORDER BY first_name');
      return stmt.all(familyId) as Client[];
    } catch (error) {
      console.error('Error getting family members:', error);
      return [];
    }
  }

  addClientToFamily(clientId: number, familyId: number, role: string): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('UPDATE clients SET family_id = ?, family_role = ? WHERE id = ?');
      const result = stmt.run(familyId, role, clientId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error adding client to family:', error);
      return false;
    }
  }

  removeClientFromFamily(clientId: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('UPDATE clients SET family_id = NULL, family_role = NULL WHERE id = ?');
      const result = stmt.run(clientId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error removing client from family:', error);
      return false;
    }
  }

  updateClientUpdatedDate(clientId: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('UPDATE clients SET client_updated_date = CURRENT_TIMESTAMP WHERE id = ?');
      const result = stmt.run(clientId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating client updated date:', error);
      return false;
    }
  }

  updateClientAiStates(clientId: number, aiStates: { [key: string]: string }): boolean {
    if (!this.db) return false;

    try {
      const validParts = ['exam', 'order', 'referral', 'contact_lens', 'appointment', 'file', 'medical'];
      const setParts: string[] = [];
      const values: unknown[] = [];

      // Build the SET clause dynamically based on provided states
      for (const [part, state] of Object.entries(aiStates)) {
        if (validParts.includes(part)) {
          setParts.push(`ai_${part}_state = ?`);
          values.push(state);
        }
      }

      if (setParts.length === 0) {
        console.error('No valid AI states provided');
        return false;
      }

      // Add the ai_updated_date update and clientId
      setParts.push('ai_updated_date = CURRENT_TIMESTAMP');
      values.push(clientId);

      const stmt = this.db.prepare(`UPDATE clients SET ${setParts.join(', ')} WHERE id = ?`);
      const result = stmt.run(...values);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating client AI states:', error);
      return false;
    }
  }

  updateClientAiPartState(clientId: number, part: string, aiPartState: string): boolean {
    if (!this.db) return false;

    try {
      const validParts = ['exam', 'order', 'referral', 'contact_lens', 'appointment', 'file', 'medical'];
      if (!validParts.includes(part)) {
        console.error('Invalid part name:', part);
        return false;
      }

      const stmt = this.db.prepare(`UPDATE clients SET ai_${part}_state = ?, ai_updated_date = CURRENT_TIMESTAMP WHERE id = ?`);
      const result = stmt.run(aiPartState, clientId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating client AI part state:', error);
      return false;
    }
  }

  getAllClientDataForAi(clientId: number): unknown {
    if (!this.db) return null;

    try {
      const client = this.getClientById(clientId);
      if (!client) return null;

      const exams = this.getExamsByClientId(clientId);
      const orders = this.getOrdersByClientId(clientId);
      const referrals = this.getReferralsByClientId(clientId);
      const appointments = this.getAppointmentsByClientId(clientId);
      const files = this.getFilesByClientId(clientId);
      const medicalLogs = this.getMedicalLogsByClientId(clientId);
      const billings = this.getBillingsByClientId(clientId);

      const examDetails = exams.map(exam => {
        const layoutInstances = this.getExamLayoutInstancesByExamId(exam.id!);
        const examData = { ...exam, layoutInstances: [] as unknown[] };
        
        layoutInstances.forEach(instance => {
          const instanceData = {
            ...instance,
            oldRefraction: this.getOldRefractionExamByLayoutInstanceId(instance.id!),
            oldRefractionExtension: this.getOldRefractionExtensionExamByLayoutInstanceId(instance.id!),
            objective: this.getObjectiveExamByLayoutInstanceId(instance.id!),
            subjective: this.getSubjectiveExamByLayoutInstanceId(instance.id!),
            addition: this.getAdditionExamByLayoutInstanceId(instance.id!),
            retinoscop: this.getRetinoscopExamByLayoutInstanceId(instance.id!),
            retinoscopDilation: this.getRetinoscopDilationExamByLayoutInstanceId(instance.id!),
            finalSubjective: this.getFinalSubjectiveExamByLayoutInstanceId(instance.id!),
            finalPrescription: this.getFinalPrescriptionExamByLayoutInstanceId(instance.id!),
            compactPrescription: this.getCompactPrescriptionExamByLayoutInstanceId(instance.id!),
            uncorrectedVA: this.getUncorrectedVAExamByLayoutInstanceId(instance.id!),
            keratometer: this.getKeratometerExamByLayoutInstanceId(instance.id!),
            coverTest: this.getCoverTestExamByLayoutInstanceId(instance.id!),
            notes: this.getNotesExamByLayoutInstanceId(instance.id!)
          };
          examData.layoutInstances.push(instanceData);
        });
        
        return examData;
      });

      const orderDetails = orders.map(order => ({
        ...order,
        eyes: this.getOrderEyesByOrderId(order.id!),
        frame: this.getFrameByOrderId(order.id!),
        details: this.getOrderDetailsByOrderId(order.id!)
      }));

      const referralDetails = referrals.map(referral => ({
        ...referral,
        eyes: this.getReferralEyesByReferralId(referral.id!)
      }));


      const billingDetails = billings.map(billing => ({
        ...billing,
        lineItems: this.getOrderLineItemsByBillingId(billing.id!)
      }));

      const filteredClient = {
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        gender: client.gender,
        national_id: client.national_id,
        date_of_birth: client.date_of_birth,
        health_fund: client.health_fund,
        address_city: client.address_city,
        address_street: client.address_street,
        address_number: client.address_number,
        postal_code: client.postal_code,
        phone_home: client.phone_home,
        phone_work: client.phone_work,
        phone_mobile: client.phone_mobile,
        fax: client.fax,
        email: client.email,
        service_center: client.service_center,
        file_creation_date: client.file_creation_date,
        membership_end: client.membership_end,
        service_end: client.service_end,
        price_list: client.price_list,
        discount_percent: client.discount_percent,
        blocked_checks: client.blocked_checks,
        blocked_credit: client.blocked_credit,
        sorting_group: client.sorting_group,
        referring_party: client.referring_party,
        file_location: client.file_location,
        occupation: client.occupation,
        status: client.status,
        notes: client.notes,
        profile_picture: client.profile_picture,
        family_id: client.family_id,
        family_role: client.family_role
      };

      return {
        client: filteredClient,
        exams: examDetails,
        orders: orderDetails,
        referrals: referralDetails,
        appointments,
        files,
        medicalLogs,
        billings: billingDetails
      };
    } catch (error) {
      console.error('Error getting all client data for AI:', error);
      return null;
    }
  }

  getBillingsByClientId(clientId: number): Billing[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT b.* FROM billings b
        LEFT JOIN orders o ON b.order_id = o.id
        LEFT JOIN contact_lens cl ON b.contact_lens_id = cl.id
        WHERE o.client_id = ? OR cl.client_id = ?
      `);
      return stmt.all(clientId, clientId) as Billing[];
    } catch (error) {
      console.error('Error getting billings by client ID:', error);
      return [];
    }
  }

  // Optical Exam CRUD operations
  createExam(exam: Omit<OpticalExam, 'id'>): OpticalExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO optical_exams (
          client_id, clinic, user_id, exam_date, test_name, dominant_eye, type
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.client_id, exam.clinic, this.sanitizeValue(exam.user_id), exam.exam_date, exam.test_name,
        exam.dominant_eye, exam.type || 'exam'
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating exam:', error);
      return null;
    }
  }

  getExamById(id: number): OpticalExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM optical_exams WHERE id = ?');
      return stmt.get(id) as OpticalExam | null;
    } catch (error) {
      console.error('Error getting exam:', error);
      return null;
    }
  }

  getExamsByClientId(clientId: number, type?: string): OpticalExam[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM optical_exams WHERE client_id = ? AND type = ? ORDER BY exam_date DESC');
      return stmt.all(clientId, type) as OpticalExam[];
    } catch (error) {
      console.error('Error getting exams by client:', error);
      return [];
    }
  }

  getAllExams(type?: string, clinicId?: number): OpticalExam[] {
    if (!this.db) return [];

    try {
      if (clinicId) {
        const stmt = this.db.prepare(`
          SELECT e.* FROM optical_exams e
          JOIN clients c ON e.client_id = c.id
          WHERE e.type = ? AND c.clinic_id = ?
          ORDER BY e.exam_date DESC
        `);
        return stmt.all(type, clinicId) as OpticalExam[];
      } else {
        const stmt = this.db.prepare('SELECT * FROM optical_exams WHERE type = ? ORDER BY exam_date DESC');
        return stmt.all(type) as OpticalExam[];
      }
    } catch (error) {
      console.error('Error getting all exams:', error);
      return [];
    }
  }


  updateExam(exam: OpticalExam): OpticalExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE optical_exams SET 
        client_id = ?, clinic = ?, user_id = ?, exam_date = ?, test_name = ?, 
        dominant_eye = ?, type = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.client_id, exam.clinic, this.sanitizeValue(exam.user_id), exam.exam_date, exam.test_name,
        exam.dominant_eye, exam.type || 'exam', exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating exam:', error);
      return null;
    }
  }

  deleteExam(id: number): boolean {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare('DELETE FROM optical_exams WHERE id = ?');
      stmt.run(id);
      return true;
    } catch (error) {
      console.error('Error deleting exam:', error);
      return false;
    }
  }

  // Old Refraction Exam CRUD operations
  createOldRefractionExam(exam: Omit<OldRefractionExam, 'id'>): OldRefractionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO old_refraction_exams (
          layout_instance_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax, r_pris, l_pris, r_base, l_base,
          r_va, l_va, r_ad, l_ad, comb_va
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
        exam.r_pris, exam.l_pris, exam.r_base, exam.l_base, exam.r_va, exam.l_va,
        exam.r_ad, exam.l_ad, exam.comb_va
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating old refraction exam:', error);
      return null;
    }
  }

  getOldRefractionExamByExamId(examId: number): OldRefractionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT ore.* FROM old_refraction_exams ore
        JOIN exam_layout_instances eli ON ore.layout_instance_id = eli.id
        WHERE eli.exam_id = ? AND eli.is_active = 1
      `);
      return stmt.get(examId) as OldRefractionExam | null;
    } catch (error) {
      console.error('Error getting old refraction exam:', error);
      return null;
    }
  }

  getOldRefractionExamByLayoutInstanceId(layoutInstanceId: number): OldRefractionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM old_refraction_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as OldRefractionExam | null;
    } catch (error) {
      console.error('Error getting old refraction exam by layout instance ID:', error);
      return null;
    }
  }

  updateOldRefractionExam(exam: OldRefractionExam): OldRefractionExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE old_refraction_exams SET 
        layout_instance_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?,
        r_pris = ?, l_pris = ?, r_base = ?, l_base = ?, r_va = ?, l_va = ?, r_ad = ?, l_ad = ?, comb_va = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
        exam.r_pris, exam.l_pris, exam.r_base, exam.l_base, exam.r_va, exam.l_va,
        exam.r_ad, exam.l_ad, exam.comb_va, exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating old refraction exam:', error);
      return null;
    }
  }

  createOldRefExam(exam: Omit<OldRefExam, 'id'>): OldRefExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO old_ref_exams (layout_instance_id, role, source, contacts)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id,
        exam.role,
        exam.source,
        exam.contacts
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating old ref exam:', error);
      return null;
    }
  }

  getOldRefExamById(id: number): OldRefExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM old_ref_exams WHERE id = ?');
      return stmt.get(id) as OldRefExam | null;
    } catch (error) {
      console.error('Error getting old ref exam by id:', error);
      return null;
    }
  }

  getOldRefExamByLayoutInstanceId(layoutInstanceId: number): OldRefExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM old_ref_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as OldRefExam | null;
    } catch (error) {
      console.error('Error getting old ref exam by layout instance id:', error);
      return null;
    }
  }

  updateOldRefExam(exam: OldRefExam): OldRefExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE old_ref_exams SET 
        layout_instance_id = ?, role = ?, source = ?, contacts = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id,
        exam.role,
        exam.source,
        exam.contacts,
        exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating old ref exam:', error);
      return null;
    }
  }

  // Old Refraction Extension Exam CRUD operations
  createOldRefractionExtensionExam(exam: Omit<OldRefractionExtensionExam, 'id'>): OldRefractionExtensionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO old_refraction_extension_exams (
          layout_instance_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax, 
          r_pr_h, l_pr_h, r_base_h, l_base_h, r_pr_v, l_pr_v, r_base_v, l_base_v,
          r_va, l_va, r_ad, l_ad, r_j, l_j, r_pd_far, l_pd_far, r_pd_close, l_pd_close,
          comb_va, comb_pd_far, comb_pd_close
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
        exam.r_pr_h, exam.l_pr_h, exam.r_base_h, exam.l_base_h, exam.r_pr_v, exam.l_pr_v, exam.r_base_v, exam.l_base_v,
        exam.r_va, exam.l_va, exam.r_ad, exam.l_ad, exam.r_j, exam.l_j, exam.r_pd_far, exam.l_pd_far, exam.r_pd_close, exam.l_pd_close,
        exam.comb_va, exam.comb_pd_far, exam.comb_pd_close
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating old refraction extension exam:', error);
      return null;
    }
  }

  getOldRefractionExtensionExamByExamId(examId: number): OldRefractionExtensionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT ore.* FROM old_refraction_extension_exams ore
        JOIN exam_layout_instances eli ON ore.layout_instance_id = eli.id
        WHERE eli.exam_id = ? AND eli.is_active = 1
      `);
      return stmt.get(examId) as OldRefractionExtensionExam | null;
    } catch (error) {
      console.error('Error getting old refraction extension exam:', error);
      return null;
    }
  }

  getOldRefractionExtensionExamByLayoutInstanceId(layoutInstanceId: number): OldRefractionExtensionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM old_refraction_extension_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as OldRefractionExtensionExam | null;
    } catch (error) {
      console.error('Error getting old refraction extension exam by layout instance ID:', error);
      return null;
    }
  }

  updateOldRefractionExtensionExam(exam: OldRefractionExtensionExam): OldRefractionExtensionExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE old_refraction_extension_exams SET 
        layout_instance_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?,
        r_pr_h = ?, l_pr_h = ?, r_base_h = ?, l_base_h = ?, r_pr_v = ?, l_pr_v = ?, r_base_v = ?, l_base_v = ?,
        r_va = ?, l_va = ?, r_ad = ?, l_ad = ?, r_j = ?, l_j = ?, r_pd_far = ?, l_pd_far = ?, r_pd_close = ?, l_pd_close = ?,
        comb_va = ?, comb_pd_far = ?, comb_pd_close = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
        exam.r_pr_h, exam.l_pr_h, exam.r_base_h, exam.l_base_h, exam.r_pr_v, exam.l_pr_v, exam.r_base_v, exam.l_base_v,
        exam.r_va, exam.l_va, exam.r_ad, exam.l_ad, exam.r_j, exam.l_j, exam.r_pd_far, exam.l_pd_far, exam.r_pd_close, exam.l_pd_close,
        exam.comb_va, exam.comb_pd_far, exam.comb_pd_close, exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating old refraction extension exam:', error);
      return null;
    }
  }

  // Objective Exam CRUD operations
  createObjectiveExam(exam: Omit<ObjectiveExam, 'id'>): ObjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO objective_exams (
          layout_instance_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax, r_se, l_se
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl,
        exam.r_ax, exam.l_ax, exam.r_se, exam.l_se
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating objective exam:', error);
      return null;
    }
  }

  getObjectiveExamByExamId(examId: number): ObjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT oe.* FROM objective_exams oe
        JOIN exam_layout_instances eli ON oe.layout_instance_id = eli.id
        WHERE eli.exam_id = ? AND eli.is_active = 1
      `);
      return stmt.get(examId) as ObjectiveExam | null;
    } catch (error) {
      console.error('Error getting objective exam:', error);
      return null;
    }
  }

  getObjectiveExamByLayoutInstanceId(layoutInstanceId: number): ObjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM objective_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as ObjectiveExam | null;
    } catch (error) {
      console.error('Error getting objective exam by layout instance ID:', error);
      return null;
    }
  }

  updateObjectiveExam(exam: ObjectiveExam): ObjectiveExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE objective_exams SET 
        layout_instance_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?, r_se = ?, l_se = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl,
        exam.r_ax, exam.l_ax, exam.r_se, exam.l_se, exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating objective exam:', error);
      return null;
    }
  }

  // Subjective Exam CRUD operations
  createSubjectiveExam(exam: Omit<SubjectiveExam, 'id'>): SubjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO subjective_exams (
          layout_instance_id, r_fa, l_fa, r_fa_tuning, l_fa_tuning, r_sph, l_sph, r_cyl, l_cyl,
          r_ax, l_ax, r_pris, l_pris, r_base, l_base, r_va, l_va, r_ph, l_ph, r_pd_close,
          l_pd_close, r_pd_far, l_pd_far, comb_va, comb_fa, comb_fa_tuning, comb_pd_close, comb_pd_far
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, exam.r_fa, exam.l_fa, exam.r_fa_tuning, exam.l_fa_tuning,
        exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
        exam.r_pris, exam.l_pris, exam.r_base, exam.l_base, exam.r_va, exam.l_va,
        exam.r_ph, exam.l_ph, exam.r_pd_close, exam.l_pd_close, exam.r_pd_far,
        exam.l_pd_far, exam.comb_va, exam.comb_fa, exam.comb_fa_tuning,
        exam.comb_pd_close, exam.comb_pd_far
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating subjective exam:', error);
      return null;
    }
  }

  getSubjectiveExamByExamId(examId: number): SubjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT se.* FROM subjective_exams se
        JOIN exam_layout_instances eli ON se.layout_instance_id = eli.id
        WHERE eli.exam_id = ? AND eli.is_active = 1
      `);
      return stmt.get(examId) as SubjectiveExam | null;
    } catch (error) {
      console.error('Error getting subjective exam:', error);
      return null;
    }
  }

  getSubjectiveExamByLayoutInstanceId(layoutInstanceId: number): SubjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM subjective_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as SubjectiveExam | null;
    } catch (error) {
      console.error('Error getting subjective exam by layout instance ID:', error);
      return null;
    }
  }

  updateSubjectiveExam(exam: SubjectiveExam): SubjectiveExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE subjective_exams SET
        layout_instance_id = ?, r_fa = ?, l_fa = ?, r_fa_tuning = ?, l_fa_tuning = ?,
        r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?,
        r_pris = ?, l_pris = ?, r_base = ?, l_base = ?, r_va = ?, l_va = ?,
        r_ph = ?, l_ph = ?, r_pd_close = ?, l_pd_close = ?, r_pd_far = ?, l_pd_far = ?,
        comb_va = ?, comb_fa = ?, comb_fa_tuning = ?, comb_pd_close = ?, comb_pd_far = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, exam.r_fa, exam.l_fa, exam.r_fa_tuning, exam.l_fa_tuning,
        exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
        exam.r_pris, exam.l_pris, exam.r_base, exam.l_base, exam.r_va, exam.l_va,
        exam.r_ph, exam.l_ph, exam.r_pd_close, exam.l_pd_close, exam.r_pd_far,
        exam.l_pd_far, exam.comb_va, exam.comb_fa, exam.comb_fa_tuning,
        exam.comb_pd_close, exam.comb_pd_far, exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating subjective exam:', error);
      return null;
    }
  }

  // Addition Exam CRUD operations
  createAdditionExam(exam: Omit<AdditionExam, 'id'>): AdditionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO addition_exams (
          layout_instance_id, r_fcc, l_fcc, r_read, l_read, r_int, l_int,
          r_bif, l_bif, r_mul, l_mul, r_j, l_j, r_iop, l_iop
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, exam.r_fcc, exam.l_fcc, exam.r_read, exam.l_read,
        exam.r_int, exam.l_int, exam.r_bif, exam.l_bif, exam.r_mul, exam.l_mul,
        exam.r_j, exam.l_j, exam.r_iop, exam.l_iop
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating addition exam:', error);
      return null;
    }
  }

  getAdditionExamByExamId(examId: number): AdditionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT ae.* FROM addition_exams ae
        JOIN exam_layout_instances eli ON ae.layout_instance_id = eli.id
        WHERE eli.exam_id = ? AND eli.is_active = 1
      `);
      return stmt.get(examId) as AdditionExam | null;
    } catch (error) {
      console.error('Error getting addition exam:', error);
      return null;
    }
  }

  getAdditionExamByLayoutInstanceId(layoutInstanceId: number): AdditionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM addition_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as AdditionExam | null;
    } catch (error) {
      console.error('Error getting addition exam by layout instance ID:', error);
      return null;
    }
  }

  updateAdditionExam(exam: AdditionExam): AdditionExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE addition_exams SET
        layout_instance_id = ?, r_fcc = ?, l_fcc = ?, r_read = ?, l_read = ?, r_int = ?, l_int = ?,
        r_bif = ?, l_bif = ?, r_mul = ?, l_mul = ?, r_j = ?, l_j = ?, r_iop = ?, l_iop = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, exam.r_fcc, exam.l_fcc, exam.r_read, exam.l_read,
        exam.r_int, exam.l_int, exam.r_bif, exam.l_bif, exam.r_mul, exam.l_mul,
        exam.r_j, exam.l_j, exam.r_iop, exam.l_iop, exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating addition exam:', error);
      return null;
    }
  }

  // Retinoscop Exam CRUD operations
  createRetinoscopExam(exam: Omit<RetinoscopExam, 'id'>): RetinoscopExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO retinoscop_exams (
          layout_instance_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax, r_reflex, l_reflex
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl,
        exam.r_ax, exam.l_ax, exam.r_reflex, exam.l_reflex
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating retinoscop exam:', error);
      return null;
    }
  }

  getRetinoscopExamByExamId(examId: number): RetinoscopExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT re.* FROM retinoscop_exams re
        JOIN exam_layout_instances eli ON re.layout_instance_id = eli.id
        WHERE eli.exam_id = ? AND eli.is_active = 1
      `);
      return stmt.get(examId) as RetinoscopExam | null;
    } catch (error) {
      console.error('Error getting retinoscop exam:', error);
      return null;
    }
  }

  getRetinoscopExamByLayoutInstanceId(layoutInstanceId: number): RetinoscopExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM retinoscop_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as RetinoscopExam | null;
    } catch (error) {
      console.error('Error getting retinoscop exam by layout instance ID:', error);
      return null;
    }
  }

  updateRetinoscopExam(exam: RetinoscopExam): RetinoscopExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE retinoscop_exams SET
        layout_instance_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?, r_reflex = ?, l_reflex = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl,
        exam.r_ax, exam.l_ax, exam.r_reflex, exam.l_reflex, exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating retinoscop exam:', error);
      return null;
    }
  }

  // Retinoscop Dilation Exam CRUD operations
  createRetinoscopDilationExam(exam: Omit<RetinoscopDilationExam, 'id'>): RetinoscopDilationExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO retinoscop_dilation_exams (
          layout_instance_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax, r_reflex, l_reflex
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl,
        exam.r_ax, exam.l_ax, exam.r_reflex, exam.l_reflex
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating retinoscop dilation exam:', error);
      return null;
    }
  }

  getRetinoscopDilationExamByExamId(examId: number): RetinoscopDilationExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT re.* FROM retinoscop_dilation_exams re
        JOIN exam_layout_instances eli ON re.layout_instance_id = eli.id
        WHERE eli.exam_id = ? AND eli.is_active = 1
      `);
      return stmt.get(examId) as RetinoscopDilationExam | null;
    } catch (error) {
      console.error('Error getting retinoscop dilation exam:', error);
      return null;
    }
  }

  getRetinoscopDilationExamByLayoutInstanceId(layoutInstanceId: number): RetinoscopDilationExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM retinoscop_dilation_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as RetinoscopDilationExam | null;
    } catch (error) {
      console.error('Error getting retinoscop dilation exam by layout instance ID:', error);
      return null;
    }
  }

  updateRetinoscopDilationExam(exam: RetinoscopDilationExam): RetinoscopDilationExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE retinoscop_dilation_exams SET
        layout_instance_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?, r_reflex = ?, l_reflex = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl,
        exam.r_ax, exam.l_ax, exam.r_reflex, exam.l_reflex, exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating retinoscop dilation exam:', error);
      return null;
    }
  }

  // Final Subjective Exam CRUD operations
  createFinalSubjectiveExam(exam: Omit<FinalSubjectiveExam, 'id'>): FinalSubjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO final_subjective_exams (
          layout_instance_id, order_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax,
          r_pr_h, l_pr_h, r_base_h, l_base_h, r_pr_v, l_pr_v, r_base_v, l_base_v,
          r_va, l_va, r_j, l_j, r_pd_far, l_pd_far, r_pd_close, l_pd_close,
          comb_pd_far, comb_pd_close, comb_va
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, this.sanitizeValue(exam.order_id), exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
        exam.r_pr_h, exam.l_pr_h, exam.r_base_h, exam.l_base_h, exam.r_pr_v, exam.l_pr_v, exam.r_base_v, exam.l_base_v,
        exam.r_va, exam.l_va, exam.r_j, exam.l_j, exam.r_pd_far, exam.l_pd_far, exam.r_pd_close, exam.l_pd_close,
        exam.comb_pd_far, exam.comb_pd_close, exam.comb_va
      );

      return { ...exam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating final subjective exam:', error);
      return null;
    }
  }

  getFinalSubjectiveExamByExamId(examId: number): FinalSubjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT fse.* FROM final_subjective_exams fse
        JOIN exam_layout_instances eli ON fse.layout_instance_id = eli.id
        WHERE eli.exam_id = ? AND eli.is_active = 1
      `);
      return stmt.get(examId) as FinalSubjectiveExam | null;
    } catch (error) {
      console.error('Error getting final subjective exam:', error);
      return null;
    }
  }

  getFinalSubjectiveExamByLayoutInstanceId(layoutInstanceId: number): FinalSubjectiveExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM final_subjective_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as FinalSubjectiveExam | null;
    } catch (error) {
      console.error('Error getting final subjective exam by layout instance ID:', error);
      return null;
    }
  }

  updateFinalSubjectiveExam(exam: FinalSubjectiveExam): FinalSubjectiveExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE final_subjective_exams SET
        layout_instance_id = ?, order_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?,
        r_pr_h = ?, l_pr_h = ?, r_base_h = ?, l_base_h = ?, r_pr_v = ?, l_pr_v = ?, r_base_v = ?, l_base_v = ?,
        r_va = ?, l_va = ?, r_j = ?, l_j = ?, r_pd_far = ?, l_pd_far = ?, r_pd_close = ?, l_pd_close = ?,
        comb_pd_far = ?, comb_pd_close = ?, comb_va = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, this.sanitizeValue(exam.order_id), exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
        exam.r_pr_h, exam.l_pr_h, exam.r_base_h, exam.l_base_h, exam.r_pr_v, exam.l_pr_v, exam.r_base_v, exam.l_base_v,
        exam.r_va, exam.l_va, exam.r_j, exam.l_j, exam.r_pd_far, exam.l_pd_far, exam.r_pd_close, exam.l_pd_close,
        exam.comb_pd_far, exam.comb_pd_close, exam.comb_va, exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating final subjective exam:', error);
      return null;
    }
  }

  // Final Prescription Exam CRUD operations
  createFinalPrescriptionExam(exam: Omit<FinalPrescriptionExam, 'id'>): FinalPrescriptionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO final_prescription_exams (
          layout_instance_id, order_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax,
          r_pris, l_pris, r_base, l_base, r_va, l_va, r_ad, l_ad, r_pd, l_pd,
          r_high, l_high, r_diam, l_diam, comb_va, comb_pd, comb_high
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, this.sanitizeValue(exam.order_id), 
        this.sanitizeValue(exam.r_sph), this.sanitizeValue(exam.l_sph), 
        this.sanitizeValue(exam.r_cyl), this.sanitizeValue(exam.l_cyl), 
        this.sanitizeValue(exam.r_ax), this.sanitizeValue(exam.l_ax),
        this.sanitizeValue(exam.r_pris), this.sanitizeValue(exam.l_pris), 
        this.sanitizeValue(exam.r_base), this.sanitizeValue(exam.l_base), 
        this.sanitizeValue(exam.r_va), this.sanitizeValue(exam.l_va), 
        this.sanitizeValue(exam.r_ad), this.sanitizeValue(exam.l_ad), 
        this.sanitizeValue(exam.r_pd), this.sanitizeValue(exam.l_pd),
        this.sanitizeValue(exam.r_high), this.sanitizeValue(exam.l_high), 
        this.sanitizeValue(exam.r_diam), this.sanitizeValue(exam.l_diam), 
        this.sanitizeValue(exam.comb_va), this.sanitizeValue(exam.comb_pd), this.sanitizeValue(exam.comb_high)
      );

      return this.getFinalPrescriptionExamById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating final prescription exam:', error);
      return null;
    }
  }

  getFinalPrescriptionExamById(id: number): FinalPrescriptionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM final_prescription_exams WHERE id = ?');
      return stmt.get(id) as FinalPrescriptionExam | null;
    } catch (error) {
      console.error('Error getting final prescription exam by ID:', error);
      return null;
    }
  }

  getFinalPrescriptionExamByOrderId(orderId: number): FinalPrescriptionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM final_prescription_exams WHERE order_id = ?');
      return stmt.get(orderId) as FinalPrescriptionExam | null;
    } catch (error) {
      console.error('Error getting final prescription exam by order ID:', error);
      return null;
    }
  }

  getFinalPrescriptionExamByLayoutInstanceId(layoutInstanceId: number): FinalPrescriptionExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM final_prescription_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as FinalPrescriptionExam | null;
    } catch (error) {
      console.error('Error getting final prescription exam by layout instance ID:', error);
      return null;
    }
  }

  updateFinalPrescriptionExam(exam: FinalPrescriptionExam): FinalPrescriptionExam | null {
    if (!this.db || !exam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE final_prescription_exams SET
        layout_instance_id = ?, order_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?,
        r_pris = ?, l_pris = ?, r_base = ?, l_base = ?, r_va = ?, l_va = ?, r_ad = ?, l_ad = ?, r_pd = ?, l_pd = ?,
        r_high = ?, l_high = ?, r_diam = ?, l_diam = ?, comb_va = ?, comb_pd = ?, comb_high = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, this.sanitizeValue(exam.order_id), 
        this.sanitizeValue(exam.r_sph), this.sanitizeValue(exam.l_sph), 
        this.sanitizeValue(exam.r_cyl), this.sanitizeValue(exam.l_cyl), 
        this.sanitizeValue(exam.r_ax), this.sanitizeValue(exam.l_ax),
        this.sanitizeValue(exam.r_pris), this.sanitizeValue(exam.l_pris), 
        this.sanitizeValue(exam.r_base), this.sanitizeValue(exam.l_base), 
        this.sanitizeValue(exam.r_va), this.sanitizeValue(exam.l_va), 
        this.sanitizeValue(exam.r_ad), this.sanitizeValue(exam.l_ad), 
        this.sanitizeValue(exam.r_pd), this.sanitizeValue(exam.l_pd),
        this.sanitizeValue(exam.r_high), this.sanitizeValue(exam.l_high), 
        this.sanitizeValue(exam.r_diam), this.sanitizeValue(exam.l_diam), 
        this.sanitizeValue(exam.comb_va), this.sanitizeValue(exam.comb_pd), this.sanitizeValue(exam.comb_high),
        exam.id
      );

      return exam;
    } catch (error) {
      console.error('Error updating final prescription exam:', error);
      return null;
    }
  }

  deleteFinalPrescriptionExam(id: number): boolean {
    if (!this.db) return false;
    
    try {
      const stmt = this.db.prepare('DELETE FROM final_prescription_exams WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting final prescription exam:', error);
      return false;
    }
  }

  createCompactPrescriptionExam(data: Omit<CompactPrescriptionExam, 'id'>): CompactPrescriptionExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO compact_prescription_exams (
          layout_instance_id, referral_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax,
          r_pris, l_pris, r_base, l_base, r_va, l_va, r_ad, l_ad, r_pd, l_pd,
          comb_va, comb_pd
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        data.layout_instance_id, data.referral_id, data.r_sph, data.l_sph, data.r_cyl, data.l_cyl,
        data.r_ax, data.l_ax, data.r_pris, data.l_pris, data.r_base, data.l_base,
        data.r_va, data.l_va, data.r_ad, data.l_ad, data.r_pd, data.l_pd,
        data.comb_va, data.comb_pd
      );
      return { id: Number(result.lastInsertRowid), ...data };
    } catch (error) {
      console.error('Error creating compact prescription exam:', error);
      return null;
    }
  }

  getCompactPrescriptionExamById(id: number): CompactPrescriptionExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM compact_prescription_exams WHERE id = ?');
      return stmt.get(id) as CompactPrescriptionExam || null;
    } catch (error) {
      console.error('Error getting compact prescription exam:', error);
      return null;
    }
  }

  getCompactPrescriptionExamByReferralId(referralId: number): CompactPrescriptionExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM compact_prescription_exams WHERE referral_id = ?');
      return stmt.get(referralId) as CompactPrescriptionExam || null;
    } catch (error) {
      console.error('Error getting compact prescription exam by referral ID:', error);
      return null;
    }
  }

  getCompactPrescriptionExamByLayoutInstanceId(layoutInstanceId: number): CompactPrescriptionExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM compact_prescription_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as CompactPrescriptionExam || null;
    } catch (error) {
      console.error('Error getting compact prescription exam by layout instance ID:', error);
      return null;
    }
  }

  updateCompactPrescriptionExam(data: CompactPrescriptionExam): CompactPrescriptionExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        UPDATE compact_prescription_exams SET
          layout_instance_id = ?, referral_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?,
          r_ax = ?, l_ax = ?, r_pris = ?, l_pris = ?, r_base = ?, l_base = ?,
          r_va = ?, l_va = ?, r_ad = ?, l_ad = ?, r_pd = ?, l_pd = ?,
          comb_va = ?, comb_pd = ?
        WHERE id = ?
      `);
      const result = stmt.run(
        data.layout_instance_id, data.referral_id, data.r_sph, data.l_sph, data.r_cyl, data.l_cyl,
        data.r_ax, data.l_ax, data.r_pris, data.l_pris, data.r_base, data.l_base,
        data.r_va, data.l_va, data.r_ad, data.l_ad, data.r_pd, data.l_pd,
        data.comb_va, data.comb_pd, data.id
      );
      return result.changes > 0 ? data : null;
    } catch (error) {
      console.error('Error updating compact prescription exam:', error);
      return null;
    }
  }

  deleteCompactPrescriptionExam(id: number): boolean {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare('DELETE FROM compact_prescription_exams WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting compact prescription exam:', error);
      return false;
    }
  }

  // Order CRUD operations
  createOrder(order: Omit<Order, 'id'>): Order | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO orders (client_id, order_date, type, dominant_eye, user_id, lens_id, frame_id, comb_va, comb_high, comb_pd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        order.client_id, order.order_date, order.type, order.dominant_eye, this.sanitizeValue(order.user_id), order.lens_id, order.frame_id,
        order.comb_va, order.comb_high, order.comb_pd
      );

      return { ...order, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating order:', error);
      return null;
    }
  }

  getOrderById(id: number): Order | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM orders WHERE id = ?');
      return stmt.get(id) as Order | null;
    } catch (error) {
      console.error('Error getting order:', error);
      return null;
    }
  }

  getOrdersByClientId(clientId: number): Order[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM orders 
        WHERE client_id = ?
        ORDER BY order_date DESC
      `);
      return stmt.all(clientId) as Order[];
    } catch (error) {
      console.error('Error getting orders by client:', error);
      return [];
    }
  }

  getAllOrders(clinicId?: number): Order[] {
    if (!this.db) return [];

    try {
      if (clinicId) {
        const stmt = this.db.prepare(`
          SELECT o.* FROM orders o
          JOIN clients c ON o.client_id = c.id
          WHERE c.clinic_id = ?
          ORDER BY o.order_date DESC
        `);
        return stmt.all(clinicId) as Order[];
      } else {
        const stmt = this.db.prepare('SELECT * FROM orders ORDER BY order_date DESC');
        return stmt.all() as Order[];
      }
    } catch (error) {
      console.error('Error getting all orders:', error);
      return [];
    }
  }

  updateOrder(order: Order): Order | null {
    if (!this.db || !order.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE orders SET client_id = ?, order_date = ?, type = ?, dominant_eye = ?, user_id = ?, lens_id = ?, frame_id = ?, comb_va = ?, comb_high = ?, comb_pd = ?
        WHERE id = ?
      `);

      stmt.run(
        order.client_id, order.order_date, order.type, order.dominant_eye, this.sanitizeValue(order.user_id), order.lens_id, order.frame_id,
        order.comb_va, order.comb_high, order.comb_pd, order.id
      );

      return order;
    } catch (error) {
      console.error('Error updating order:', error);
      return null;
    }
  }

  deleteOrder(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM orders WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting order:', error);
      return false;
    }
  }

  // Order Eye CRUD operations
  createOrderEye(orderEye: Omit<OrderEye, 'id'>): OrderEye | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO order_eyes (order_id, eye, sph, cyl, ax, pris, base, va, ad, diam, s_base, high, pd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        orderEye.order_id, orderEye.eye, orderEye.sph, orderEye.cyl, orderEye.ax,
        orderEye.pris, orderEye.base, orderEye.va, orderEye.ad, orderEye.diam,
        orderEye.s_base, orderEye.high, orderEye.pd
      );

      return { ...orderEye, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating order eye:', error);
      return null;
    }
  }

  getOrderEyesByOrderId(orderId: number): OrderEye[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM order_eyes WHERE order_id = ? ORDER BY eye');
      return stmt.all(orderId) as OrderEye[];
    } catch (error) {
      console.error('Error getting order eyes:', error);
      return [];
    }
  }

  updateOrderEye(orderEye: OrderEye): OrderEye | null {
    if (!this.db || !orderEye.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE order_eyes SET order_id = ?, eye = ?, sph = ?, cyl = ?, ax = ?, pris = ?, base = ?, va = ?, ad = ?, diam = ?, s_base = ?, high = ?, pd = ?
        WHERE id = ?
      `);

      stmt.run(
        orderEye.order_id, orderEye.eye, orderEye.sph, orderEye.cyl, orderEye.ax,
        orderEye.pris, orderEye.base, orderEye.va, orderEye.ad, orderEye.diam,
        orderEye.s_base, orderEye.high, orderEye.pd, orderEye.id
      );

      return orderEye;
    } catch (error) {
      console.error('Error updating order eye:', error);
      return null;
    }
  }

  // Medical Log operations
  createMedicalLog(log: Omit<MedicalLog, 'id'>): MedicalLog | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO medical_logs (client_id, user_id, log_date, log)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(log.client_id, this.sanitizeValue(log.user_id), log.log_date, log.log);
      return { ...log, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating medical log:', error);
      return null;
    }
  }

  getMedicalLogsByClientId(clientId: number): MedicalLog[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM medical_logs WHERE client_id = ? ORDER BY log_date DESC');
      return stmt.all(clientId) as MedicalLog[];
    } catch (error) {
      console.error('Error getting medical logs:', error);
      return [];
    }
  }

  getAllMedicalLogs(clinicId?: number): MedicalLog[] {
    if (!this.db) return [];

    try {
      if (clinicId) {
        const stmt = this.db.prepare(`
          SELECT m.* FROM medical_logs m
          JOIN clients c ON m.client_id = c.id
          WHERE c.clinic_id = ?
          ORDER BY m.log_date DESC
        `);
        return stmt.all(clinicId) as MedicalLog[];
      } else {
        const stmt = this.db.prepare('SELECT * FROM medical_logs ORDER BY log_date DESC');
        return stmt.all() as MedicalLog[];
      }
    } catch (error) {
      console.error('Error getting all medical logs:', error);
      return [];
    }
  }

  getMedicalLogById(id: number): MedicalLog | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM medical_logs WHERE id = ?');
      return stmt.get(id) as MedicalLog | null;
    } catch (error) {
      console.error('Error getting medical log by id:', error);
      return null;
    }
  }

  deleteMedicalLog(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM medical_logs WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting medical log:', error);
      return false;
    }
  }

  updateMedicalLog(log: MedicalLog): MedicalLog | null {
    if (!this.db || !log.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE medical_logs SET client_id = ?, user_id = ?, log_date = ?, log = ?
        WHERE id = ?
      `);

      stmt.run(log.client_id, this.sanitizeValue(log.user_id), log.log_date, log.log, log.id);
      return log;
    } catch (error) {
      console.error('Error updating medical log:', error);
      return null;
    }
  }

  // Utility methods
  // Order Details CRUD operations
  createOrderDetails(orderDetails: Omit<OrderDetails, 'id'>): OrderDetails | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO order_details (
          order_id, branch, supplier_status, bag_number, advisor, delivered_by,
          technician, delivered_at, warranty_expiration, delivery_location,
          manufacturing_lab, order_status, priority, promised_date, approval_date,
          notes, lens_order_notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        orderDetails.order_id, orderDetails.branch, orderDetails.supplier_status,
        orderDetails.bag_number, orderDetails.advisor, orderDetails.delivered_by,
        orderDetails.technician, orderDetails.delivered_at, orderDetails.warranty_expiration,
        orderDetails.delivery_location, orderDetails.manufacturing_lab, orderDetails.order_status,
        orderDetails.priority, orderDetails.promised_date, orderDetails.approval_date,
        orderDetails.notes, orderDetails.lens_order_notes
      );

      return { ...orderDetails, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating order details:', error);
      return null;
    }
  }

  getOrderDetailsByOrderId(orderId: number): OrderDetails | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM order_details WHERE order_id = ?');
      return stmt.get(orderId) as OrderDetails | null;
    } catch (error) {
      console.error('Error getting order details:', error);
      return null;
    }
  }

  updateOrderDetails(orderDetails: OrderDetails): OrderDetails | null {
    if (!this.db || !orderDetails.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE order_details SET 
          order_id = ?, branch = ?, supplier_status = ?, bag_number = ?, advisor = ?, delivered_by = ?,
          technician = ?, delivered_at = ?, warranty_expiration = ?, delivery_location = ?,
          manufacturing_lab = ?, order_status = ?, priority = ?, promised_date = ?, approval_date = ?,
          notes = ?, lens_order_notes = ?
        WHERE id = ?
      `);

      stmt.run(
        orderDetails.order_id, orderDetails.branch, orderDetails.supplier_status,
        orderDetails.bag_number, orderDetails.advisor, orderDetails.delivered_by,
        orderDetails.technician, orderDetails.delivered_at, orderDetails.warranty_expiration,
        orderDetails.delivery_location, orderDetails.manufacturing_lab, orderDetails.order_status,
        orderDetails.priority, orderDetails.promised_date, orderDetails.approval_date,
        orderDetails.notes, orderDetails.lens_order_notes,
        orderDetails.id
      );

      return orderDetails;
    } catch (error) {
      console.error('Error updating order details:', error);
      return null;
    }
  }

  // Billing CRUD operations
  createBilling(billing: Omit<Billing, 'id'>): Billing | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO billings (
          contact_lens_id, optical_exams_id, order_id, total_before_discount, discount_amount, 
          discount_percent, total_after_discount, prepayment_amount, installment_count, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        this.sanitizeValue(billing.contact_lens_id),
        this.sanitizeValue(billing.optical_exams_id),
        this.sanitizeValue(billing.order_id),
        this.sanitizeValue(billing.total_before_discount),
        this.sanitizeValue(billing.discount_amount),
        this.sanitizeValue(billing.discount_percent),
        this.sanitizeValue(billing.total_after_discount),
        this.sanitizeValue(billing.prepayment_amount),
        this.sanitizeValue(billing.installment_count),
        this.sanitizeValue(billing.notes)
      );

      return { ...billing, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating billing:', error);
      return null;
    }
  }

  getBillingByOrderId(orderId: number): Billing | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM billings WHERE order_id = ?');
      return stmt.get(orderId) as Billing | null;
    } catch (error) {
      console.error('Error getting billing by order:', error);
      return null;
    }
  }

  getBillingByContactLensId(contactLensId: number): Billing | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM billings WHERE contact_lens_id = ?');
      return stmt.get(contactLensId) as Billing | null;
    } catch (error) {
      console.error('Error getting billing by contact lens:', error);
      return null;
    }
  }

  updateBilling(billing: Billing): Billing | null {
    if (!this.db || !billing.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE billings SET 
          contact_lens_id = ?, optical_exams_id = ?, order_id = ?, total_before_discount = ?, discount_amount = ?,
          discount_percent = ?, total_after_discount = ?, prepayment_amount = ?, installment_count = ?, notes = ?
        WHERE id = ?
      `);

      stmt.run(
        this.sanitizeValue(billing.contact_lens_id),
        this.sanitizeValue(billing.optical_exams_id),
        this.sanitizeValue(billing.order_id),
        this.sanitizeValue(billing.total_before_discount),
        this.sanitizeValue(billing.discount_amount),
        this.sanitizeValue(billing.discount_percent),
        this.sanitizeValue(billing.total_after_discount),
        this.sanitizeValue(billing.prepayment_amount),
        this.sanitizeValue(billing.installment_count),
        this.sanitizeValue(billing.notes),
        billing.id
      );

      return billing;
    } catch (error) {
      console.error('Error updating billing:', error);
      return null;
    }
  }

  // Order Line Item CRUD operations
  createOrderLineItem(orderLineItem: Omit<OrderLineItem, 'id'>): OrderLineItem | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO order_line_item (
          billings_id, sku, description, supplied_by, supplied, price, quantity, discount, line_total
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        orderLineItem.billings_id,
        this.sanitizeValue(orderLineItem.sku),
        this.sanitizeValue(orderLineItem.description),
        this.sanitizeValue(orderLineItem.supplied_by),
        this.sanitizeValue(orderLineItem.supplied),
        this.sanitizeValue(orderLineItem.price),
        this.sanitizeValue(orderLineItem.quantity),
        this.sanitizeValue(orderLineItem.discount),
        this.sanitizeValue(orderLineItem.line_total)
      );

      return { ...orderLineItem, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating order line item:', error);
      return null;
    }
  }

  getOrderLineItemsByBillingId(billingId: number): OrderLineItem[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM order_line_item WHERE billings_id = ?');
      return stmt.all(billingId) as OrderLineItem[];
    } catch (error) {
      console.error('Error getting order line items by billing:', error);
      return [];
    }
  }

  updateOrderLineItem(orderLineItem: OrderLineItem): OrderLineItem | null {
    if (!this.db || !orderLineItem.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE order_line_item SET 
          billings_id = ?, sku = ?, description = ?, supplied_by = ?, supplied = ?, 
          price = ?, quantity = ?, discount = ?, line_total = ?
        WHERE id = ?
      `);

      stmt.run(
        orderLineItem.billings_id,
        this.sanitizeValue(orderLineItem.sku),
        this.sanitizeValue(orderLineItem.description),
        this.sanitizeValue(orderLineItem.supplied_by),
        this.sanitizeValue(orderLineItem.supplied),
        this.sanitizeValue(orderLineItem.price),
        this.sanitizeValue(orderLineItem.quantity),
        this.sanitizeValue(orderLineItem.discount),
        this.sanitizeValue(orderLineItem.line_total),
        orderLineItem.id
      );

      return orderLineItem;
    } catch (error) {
      console.error('Error updating order line item:', error);
      return null;
    }
  }

  deleteOrderLineItem(orderLineItemId: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM order_line_item WHERE id = ?');
      const result = stmt.run(orderLineItemId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting order line item:', error);
      return false;
    }
  }

  // ContactLensDiameters CRUD operations
  createContactLensDiameters(data: Omit<ContactLensDiameters, 'id'>): ContactLensDiameters | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO contact_lens_diameters (
          layout_instance_id, pupil_diameter, corneal_diameter, eyelid_aperture
        ) VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.pupil_diameter),
        this.sanitizeValue(data.corneal_diameter),
        this.sanitizeValue(data.eyelid_aperture)
      );

      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating contact lens diameters:', error);
      return null;
    }
  }

  getContactLensDiametersById(id: number): ContactLensDiameters | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens_diameters WHERE id = ?');
      return stmt.get(id) as ContactLensDiameters | null;
    } catch (error) {
      console.error('Error getting contact lens diameters by ID:', error);
      return null;
    }
  }

  getContactLensDiametersByLayoutInstanceId(layoutInstanceId: number): ContactLensDiameters | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens_diameters WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as ContactLensDiameters | null;
    } catch (error) {
      console.error('Error getting contact lens diameters by layout instance ID:', error);
      return null;
    }
  }

  updateContactLensDiameters(data: ContactLensDiameters): ContactLensDiameters | null {
    if (!this.db || !data.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE contact_lens_diameters SET
        layout_instance_id = ?, pupil_diameter = ?, corneal_diameter = ?, eyelid_aperture = ?
        WHERE id = ?
      `);

      stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.pupil_diameter),
        this.sanitizeValue(data.corneal_diameter),
        this.sanitizeValue(data.eyelid_aperture),
        data.id
      );

      return data;
    } catch (error) {
      console.error('Error updating contact lens diameters:', error);
      return null;
    }
  }

  // ContactLensDetails CRUD operations
  createContactLensDetails(data: Omit<ContactLensDetails, 'id'>): ContactLensDetails | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO contact_lens_details (
          layout_instance_id, r_lens_type, l_lens_type, r_model, l_model, r_supplier, l_supplier,
          r_material, l_material, r_color, l_color, r_quantity, l_quantity,
          r_order_quantity, l_order_quantity, r_dx, l_dx
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.r_lens_type),
        this.sanitizeValue(data.l_lens_type),
        this.sanitizeValue(data.r_model),
        this.sanitizeValue(data.l_model),
        this.sanitizeValue(data.r_supplier),
        this.sanitizeValue(data.l_supplier),
        this.sanitizeValue(data.r_material),
        this.sanitizeValue(data.l_material),
        this.sanitizeValue(data.r_color),
        this.sanitizeValue(data.l_color),
        this.sanitizeValue(data.r_quantity),
        this.sanitizeValue(data.l_quantity),
        this.sanitizeValue(data.r_order_quantity),
        this.sanitizeValue(data.l_order_quantity),
        this.sanitizeValue(data.r_dx),
        this.sanitizeValue(data.l_dx)
      );

      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating contact lens details:', error);
      return null;
    }
  }

  getContactLensDetailsById(id: number): ContactLensDetails | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens_details WHERE id = ?');
      return stmt.get(id) as ContactLensDetails | null;
    } catch (error) {
      console.error('Error getting contact lens details by ID:', error);
      return null;
    }
  }

  getContactLensDetailsByLayoutInstanceId(layoutInstanceId: number): ContactLensDetails | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens_details WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as ContactLensDetails | null;
    } catch (error) {
      console.error('Error getting contact lens details by layout instance ID:', error);
      return null;
    }
  }

  updateContactLensDetails(data: ContactLensDetails): ContactLensDetails | null {
    if (!this.db || !data.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE contact_lens_details SET
        layout_instance_id = ?, r_lens_type = ?, l_lens_type = ?, r_model = ?, l_model = ?, r_supplier = ?, l_supplier = ?,
        r_material = ?, l_material = ?, r_color = ?, l_color = ?, r_quantity = ?, l_quantity = ?,
        r_order_quantity = ?, l_order_quantity = ?, r_dx = ?, l_dx = ?
        WHERE id = ?
      `);

      stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.r_lens_type),
        this.sanitizeValue(data.l_lens_type),
        this.sanitizeValue(data.r_model),
        this.sanitizeValue(data.l_model),
        this.sanitizeValue(data.r_supplier),
        this.sanitizeValue(data.l_supplier),
        this.sanitizeValue(data.r_material),
        this.sanitizeValue(data.l_material),
        this.sanitizeValue(data.r_color),
        this.sanitizeValue(data.l_color),
        this.sanitizeValue(data.r_quantity),
        this.sanitizeValue(data.l_quantity),
        this.sanitizeValue(data.r_order_quantity),
        this.sanitizeValue(data.l_order_quantity),
        this.sanitizeValue(data.r_dx),
        this.sanitizeValue(data.l_dx),
        data.id
      );

      return data;
    } catch (error) {
      console.error('Error updating contact lens details:', error);
      return null;
    }
  }

  // KeratometerContactLens CRUD operations
  createKeratometerContactLens(data: Omit<KeratometerContactLens, 'id'>): KeratometerContactLens | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO keratometer_contact_lens (
          layout_instance_id, r_rh, l_rh, r_rv, l_rv, r_avg, l_avg,
          r_cyl, l_cyl, r_ax, l_ax, r_ecc, l_ecc
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.r_rh),
        this.sanitizeValue(data.l_rh),
        this.sanitizeValue(data.r_rv),
        this.sanitizeValue(data.l_rv),
        this.sanitizeValue(data.r_avg),
        this.sanitizeValue(data.l_avg),
        this.sanitizeValue(data.r_cyl),
        this.sanitizeValue(data.l_cyl),
        this.sanitizeValue(data.r_ax),
        this.sanitizeValue(data.l_ax),
        this.sanitizeValue(data.r_ecc),
        this.sanitizeValue(data.l_ecc)
      );

      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating keratometer contact lens:', error);
      return null;
    }
  }

  getKeratometerContactLensById(id: number): KeratometerContactLens | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM keratometer_contact_lens WHERE id = ?');
      return stmt.get(id) as KeratometerContactLens | null;
    } catch (error) {
      console.error('Error getting keratometer contact lens by ID:', error);
      return null;
    }
  }

  getKeratometerContactLensByLayoutInstanceId(layoutInstanceId: number): KeratometerContactLens | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM keratometer_contact_lens WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as KeratometerContactLens | null;
    } catch (error) {
      console.error('Error getting keratometer contact lens by layout instance ID:', error);
      return null;
    }
  }

  updateKeratometerContactLens(data: KeratometerContactLens): KeratometerContactLens | null {
    if (!this.db || !data.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE keratometer_contact_lens SET
        layout_instance_id = ?, r_rh = ?, l_rh = ?, r_rv = ?, l_rv = ?, r_avg = ?, l_avg = ?,
        r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?, r_ecc = ?, l_ecc = ?
        WHERE id = ?
      `);

      stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.r_rh),
        this.sanitizeValue(data.l_rh),
        this.sanitizeValue(data.r_rv),
        this.sanitizeValue(data.l_rv),
        this.sanitizeValue(data.r_avg),
        this.sanitizeValue(data.l_avg),
        this.sanitizeValue(data.r_cyl),
        this.sanitizeValue(data.l_cyl),
        this.sanitizeValue(data.r_ax),
        this.sanitizeValue(data.l_ax),
        this.sanitizeValue(data.r_ecc),
        this.sanitizeValue(data.l_ecc),
        data.id
      );

      return data;
    } catch (error) {
      console.error('Error updating keratometer contact lens:', error);
      return null;
    }
  }

  // ContactLensExam CRUD operations
  createContactLensExam(data: Omit<ContactLensExam, 'id'>): ContactLensExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO contact_lens_exam (
          layout_instance_id, r_bc, l_bc, r_oz, l_oz, r_diam, l_diam,
          r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax, r_read_ad, l_read_ad,
          r_va, l_va, r_j, l_j, comb_va
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.r_bc),
        this.sanitizeValue(data.l_bc),
        this.sanitizeValue(data.r_oz),
        this.sanitizeValue(data.l_oz),
        this.sanitizeValue(data.r_diam),
        this.sanitizeValue(data.l_diam),
        this.sanitizeValue(data.r_sph),
        this.sanitizeValue(data.l_sph),
        this.sanitizeValue(data.r_cyl),
        this.sanitizeValue(data.l_cyl),
        this.sanitizeValue(data.r_ax),
        this.sanitizeValue(data.l_ax),
        this.sanitizeValue(data.r_read_ad),
        this.sanitizeValue(data.l_read_ad),
        this.sanitizeValue(data.r_va),
        this.sanitizeValue(data.l_va),
        this.sanitizeValue(data.r_j),
        this.sanitizeValue(data.l_j),
        this.sanitizeValue(data.comb_va)
      );

      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating contact lens exam:', error);
      return null;
    }
  }

  getContactLensExamById(id: number): ContactLensExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens_exam WHERE id = ?');
      return stmt.get(id) as ContactLensExam | null;
    } catch (error) {
      console.error('Error getting contact lens exam by ID:', error);
      return null;
    }
  }

  getContactLensExamByLayoutInstanceId(layoutInstanceId: number): ContactLensExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens_exam WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as ContactLensExam | null;
    } catch (error) {
      console.error('Error getting contact lens exam by layout instance ID:', error);
      return null;
    }
  }

  updateContactLensExam(data: ContactLensExam): ContactLensExam | null {
    if (!this.db || !data.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE contact_lens_exam SET
        layout_instance_id = ?, r_bc = ?, l_bc = ?, r_oz = ?, l_oz = ?, r_diam = ?, l_diam = ?,
        r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?, r_read_ad = ?, l_read_ad = ?,
        r_va = ?, l_va = ?, r_j = ?, l_j = ?, comb_va = ?
        WHERE id = ?
      `);

      stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.r_bc),
        this.sanitizeValue(data.l_bc),
        this.sanitizeValue(data.r_oz),
        this.sanitizeValue(data.l_oz),
        this.sanitizeValue(data.r_diam),
        this.sanitizeValue(data.l_diam),
        this.sanitizeValue(data.r_sph),
        this.sanitizeValue(data.l_sph),
        this.sanitizeValue(data.r_cyl),
        this.sanitizeValue(data.l_cyl),
        this.sanitizeValue(data.r_ax),
        this.sanitizeValue(data.l_ax),
        this.sanitizeValue(data.r_read_ad),
        this.sanitizeValue(data.l_read_ad),
        this.sanitizeValue(data.r_va),
        this.sanitizeValue(data.l_va),
        this.sanitizeValue(data.r_j),
        this.sanitizeValue(data.l_j),
        this.sanitizeValue(data.comb_va),
        data.id
      );

      return data;
    } catch (error) {
      console.error('Error updating contact lens exam:', error);
      return null;
    }
  }

  // Contact Lens Order CRUD operations
  createContactLensOrder(contactLensOrder: Omit<ContactLensOrder, 'id'>): ContactLensOrder | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO contact_lens_order (
          layout_instance_id, branch, supply_in_branch, order_status, advisor, deliverer, delivery_date,
          priority, guaranteed_date, approval_date, cleaning_solution, disinfection_solution, rinsing_solution
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        contactLensOrder.layout_instance_id,
        this.sanitizeValue(contactLensOrder.branch),
        this.sanitizeValue(contactLensOrder.supply_in_branch),
        this.sanitizeValue(contactLensOrder.order_status),
        this.sanitizeValue(contactLensOrder.advisor),
        this.sanitizeValue(contactLensOrder.deliverer),
        this.sanitizeValue(contactLensOrder.delivery_date),
        this.sanitizeValue(contactLensOrder.priority),
        this.sanitizeValue(contactLensOrder.guaranteed_date),
        this.sanitizeValue(contactLensOrder.approval_date),
        this.sanitizeValue(contactLensOrder.cleaning_solution),
        this.sanitizeValue(contactLensOrder.disinfection_solution),
        this.sanitizeValue(contactLensOrder.rinsing_solution)
      );

      return { ...contactLensOrder, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating contact lens order:', error);
      return null;
    }
  }

  getContactLensOrderByLayoutInstanceId(layoutInstanceId: number): ContactLensOrder | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens_order WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as ContactLensOrder | null;
    } catch (error) {
      console.error('Error getting contact lens order by contact lens ID:', error);
      return null;
    }
  }

  updateContactLensOrder(contactLensOrder: ContactLensOrder): ContactLensOrder | null {
    if (!this.db || !contactLensOrder.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE contact_lens_order SET 
          layout_instance_id = ?, branch = ?, supply_in_branch = ?, order_status = ?, advisor = ?,
          deliverer = ?, delivery_date = ?, priority = ?, guaranteed_date = ?, approval_date = ?,
          cleaning_solution = ?, disinfection_solution = ?, rinsing_solution = ?
        WHERE id = ?
      `);

      stmt.run(
        contactLensOrder.layout_instance_id,
        this.sanitizeValue(contactLensOrder.branch),
        this.sanitizeValue(contactLensOrder.supply_in_branch),
        this.sanitizeValue(contactLensOrder.order_status),
        this.sanitizeValue(contactLensOrder.advisor),
        this.sanitizeValue(contactLensOrder.deliverer),
        this.sanitizeValue(contactLensOrder.delivery_date),
        this.sanitizeValue(contactLensOrder.priority),
        this.sanitizeValue(contactLensOrder.guaranteed_date),
        this.sanitizeValue(contactLensOrder.approval_date),
        this.sanitizeValue(contactLensOrder.cleaning_solution),
        this.sanitizeValue(contactLensOrder.disinfection_solution),
        this.sanitizeValue(contactLensOrder.rinsing_solution),
        contactLensOrder.id
      );

      return contactLensOrder;
    } catch (error) {
      console.error('Error updating contact lens order:', error);
      return null;
    }
  }

  // Referral CRUD operations
  createReferral(referral: Omit<Referral, 'id'>): Referral | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO referrals (
          client_id, user_id, referral_notes, prescription_notes,
          date, type, branch, recipient
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        referral.client_id,
        this.sanitizeValue(referral.user_id),
        this.sanitizeValue(referral.referral_notes),
        this.sanitizeValue(referral.prescription_notes),
        this.sanitizeValue(referral.date),
        this.sanitizeValue(referral.type),
        this.sanitizeValue(referral.branch),
        this.sanitizeValue(referral.recipient)
      );

      return { ...referral, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating referral:', error);
      return null;
    }
  }

  getReferralById(id: number): Referral | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM referrals WHERE id = ?');
      return stmt.get(id) as Referral | null;
    } catch (error) {
      console.error('Error getting referral:', error);
      return null;
    }
  }

  getReferralsByClientId(clientId: number): Referral[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM referrals WHERE client_id = ? ORDER BY date DESC');
      return stmt.all(clientId) as Referral[];
    } catch (error) {
      console.error('Error getting referrals by client:', error);
      return [];
    }
  }

  getAllReferrals(clinicId?: number): Referral[] {
    if (!this.db) return [];

    try {
      if (clinicId) {
        const stmt = this.db.prepare(`
          SELECT r.* FROM referrals r
          JOIN clients c ON r.client_id = c.id
          WHERE c.clinic_id = ?
          ORDER BY r.date DESC
        `);
        return stmt.all(clinicId) as Referral[];
      } else {
        const stmt = this.db.prepare('SELECT * FROM referrals ORDER BY date DESC');
        return stmt.all() as Referral[];
      }
    } catch (error) {
      console.error('Error getting all referrals:', error);
      return [];
    }
  }

  updateReferral(referral: Referral): Referral | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE referrals SET
          client_id = ?, user_id = ?, referral_notes = ?, prescription_notes = ?,
          date = ?, type = ?, branch = ?, recipient = ?
        WHERE id = ?
      `);

      stmt.run(
        referral.client_id,
        this.sanitizeValue(referral.user_id),
        this.sanitizeValue(referral.referral_notes),
        this.sanitizeValue(referral.prescription_notes),
        this.sanitizeValue(referral.date),
        this.sanitizeValue(referral.type),
        this.sanitizeValue(referral.branch),
        this.sanitizeValue(referral.recipient),
        referral.id
      );

      return referral;
    } catch (error) {
      console.error('Error updating referral:', error);
      return null;
    }
  }

  deleteReferral(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM referrals WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting referral:', error);
      return false;
    }
  }

  // ReferralEye CRUD operations
  createReferralEye(referralEye: Omit<ReferralEye, 'id'>): ReferralEye | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO referral_eye (
          referral_id, eye, sph, cyl, ax, pris, base, va, add_power, decent, s_base, high, pd
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        referralEye.referral_id,
        referralEye.eye,
        this.sanitizeValue(referralEye.sph),
        this.sanitizeValue(referralEye.cyl),
        this.sanitizeValue(referralEye.ax),
        this.sanitizeValue(referralEye.pris),
        this.sanitizeValue(referralEye.base),
        this.sanitizeValue(referralEye.va),
        this.sanitizeValue(referralEye.add),
        this.sanitizeValue(referralEye.decent),
        this.sanitizeValue(referralEye.s_base),
        this.sanitizeValue(referralEye.high),
        this.sanitizeValue(referralEye.pd)
      );

      return { ...referralEye, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating referral eye:', error);
      return null;
    }
  }

  getReferralEyesByReferralId(referralId: number): ReferralEye[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT id, referral_id, eye, sph, cyl, ax, pris, base, va, add_power as "add", decent, s_base, high, pd FROM referral_eye WHERE referral_id = ? ORDER BY eye');
      return stmt.all(referralId) as ReferralEye[];
    } catch (error) {
      console.error('Error getting referral eyes by referral:', error);
      return [];
    }
  }

  updateReferralEye(referralEye: ReferralEye): ReferralEye | null {
    if (!this.db || !referralEye.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE referral_eye SET 
        referral_id = ?, eye = ?, sph = ?, cyl = ?, ax = ?, pris = ?, base = ?, va = ?, 
        add_power = ?, decent = ?, s_base = ?, high = ?, pd = ?
        WHERE id = ?
      `);

      stmt.run(
        referralEye.referral_id,
        referralEye.eye,
        this.sanitizeValue(referralEye.sph),
        this.sanitizeValue(referralEye.cyl),
        this.sanitizeValue(referralEye.ax),
        this.sanitizeValue(referralEye.pris),
        this.sanitizeValue(referralEye.base),
        this.sanitizeValue(referralEye.va),
        this.sanitizeValue(referralEye.add),
        this.sanitizeValue(referralEye.decent),
        this.sanitizeValue(referralEye.s_base),
        this.sanitizeValue(referralEye.high),
        this.sanitizeValue(referralEye.pd),
        referralEye.id
      );

      return referralEye;
    } catch (error) {
      console.error('Error updating referral eye:', error);
      return null;
    }
  }

  // Appointment CRUD operations
  createAppointment(appointment: Omit<Appointment, 'id'>): Appointment | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO appointments (client_id, user_id, date, time, duration, exam_name, note, google_calendar_event_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        appointment.client_id,
        this.sanitizeValue(appointment.user_id),
        this.sanitizeValue(appointment.date),
        this.sanitizeValue(appointment.time),
        this.sanitizeValue(appointment.duration || 30),
        this.sanitizeValue(appointment.exam_name),
        this.sanitizeValue(appointment.note),
        this.sanitizeValue(appointment.google_calendar_event_id)
      );

      const createdAppointment = { ...appointment, id: result.lastInsertRowid as number };

      // Sync to Google Calendar if user has Google account connected
      if (appointment.user_id) {
        // Note: Google Calendar sync happens asynchronously to avoid blocking the UI
        // The google_calendar_event_id will be updated separately once sync completes
        this.syncAppointmentToGoogleCalendar(createdAppointment, 'create').catch(console.error);
      }

      return createdAppointment;
    } catch (error) {
      console.error('Error creating appointment:', error);
      return null;
    }
  }

  getAppointmentById(id: number): Appointment | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM appointments WHERE id = ?');
      return stmt.get(id) as Appointment || null;
    } catch (error) {
      console.error('Error getting appointment:', error);
      return null;
    }
  }

  getAppointmentsByClientId(clientId: number): Appointment[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM appointments WHERE client_id = ? ORDER BY date DESC');
      return stmt.all(clientId) as Appointment[];
    } catch (error) {
      console.error('Error getting appointments by client:', error);
      return [];
    }
  }

  getAllAppointments(clinicId?: number): Appointment[] {
    if (!this.db) return [];

    try {
      if (clinicId) {
        const stmt = this.db.prepare(`
          SELECT a.* FROM appointments a
          JOIN clients c ON a.client_id = c.id
          WHERE c.clinic_id = ?
          ORDER BY a.date DESC
        `);
        return stmt.all(clinicId) as Appointment[];
      } else {
        const stmt = this.db.prepare('SELECT * FROM appointments ORDER BY date DESC');
        return stmt.all() as Appointment[];
      }
    } catch (error) {
      console.error('Error getting all appointments:', error);
      return [];
    }
  }

  updateAppointment(appointment: Appointment): Appointment | null {
    if (!this.db || !appointment.id) return null;

    try {
      // Get the current appointment to preserve the Google Calendar event ID
      const currentAppointment = this.getAppointmentById(appointment.id);
      if (!currentAppointment) {
        console.error('Appointment not found for update');
        return null;
      }

      // Preserve the Google Calendar event ID from the current appointment
      const updatedAppointment = {
        ...appointment,
        google_calendar_event_id: appointment.google_calendar_event_id || currentAppointment.google_calendar_event_id
      };

      const stmt = this.db.prepare(`
        UPDATE appointments SET
          client_id = ?, user_id = ?, date = ?, time = ?, duration = ?, exam_name = ?, note = ?, google_calendar_event_id = ?
        WHERE id = ?
      `);

      stmt.run(
        updatedAppointment.client_id,
        this.sanitizeValue(updatedAppointment.user_id),
        this.sanitizeValue(updatedAppointment.date),
        this.sanitizeValue(updatedAppointment.time),
        this.sanitizeValue(updatedAppointment.duration || 30),
        this.sanitizeValue(updatedAppointment.exam_name),
        this.sanitizeValue(updatedAppointment.note),
        this.sanitizeValue(updatedAppointment.google_calendar_event_id),
        updatedAppointment.id
      );

      // Sync to Google Calendar if user has Google account connected
      if (updatedAppointment.user_id) {
        this.syncAppointmentToGoogleCalendar(updatedAppointment, 'update').catch(console.error);
      }

      return updatedAppointment;
    } catch (error) {
      console.error('Error updating appointment:', error);
      return null;
    }
  }

  deleteAppointment(id: number): boolean {
    if (!this.db) return false;

    try {
      // Get appointment before deleting for Google Calendar sync
      const appointment = this.getAppointmentById(id);
      
      const stmt = this.db.prepare('DELETE FROM appointments WHERE id = ?');
      const result = stmt.run(id);
      
      // Sync deletion to Google Calendar if user has Google account connected
      if (result.changes > 0 && appointment?.user_id) {
        this.syncAppointmentToGoogleCalendar(appointment, 'delete').catch(console.error);
      }
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting appointment:', error);
      return false;
    }
  }

  updateAppointmentGoogleEventId(appointmentId: number, googleEventId: string | null): boolean {
    if (!this.db) return false;

    try {
      console.log(`📝 Updating appointment ${appointmentId} with Google event ID: ${googleEventId}`);
      const stmt = this.db.prepare('UPDATE appointments SET google_calendar_event_id = ? WHERE id = ?');
      const result = stmt.run(this.sanitizeValue(googleEventId), appointmentId);
      console.log(`📊 Update result: ${result.changes} rows affected`);
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating appointment Google event ID:', error);
      return false;
    }
  }

  private async syncAppointmentToGoogleCalendar(appointment: Appointment, action: 'create' | 'update' | 'delete'): Promise<void> {
    try {
      if (!appointment.user_id) {
        console.log('No user assigned to appointment, skipping Google Calendar sync');
        return;
      }

      const user = this.getUserById(appointment.user_id);
      if (!user) {
        console.log('Assigned user not found, skipping Google Calendar sync');
        return;
      }

      if (!user.google_account_connected) {
        console.log(`User ${user.username} (ID: ${user.id}) is not connected to Google Calendar, skipping sync`);
        return;
      }

      const client = this.getClientById(appointment.client_id);

      switch (action) {
        case 'create': {
          const eventId = await googleCalendarSync.syncAppointmentCreated(appointment, client, user);
          if (eventId && appointment.id) {
            console.log(`🔄 Storing Google Calendar event ID ${eventId} for appointment ${appointment.id}`);
            const success = this.updateAppointmentGoogleEventId(appointment.id, eventId);
            if (success) {
              console.log(`✅ Successfully stored Google Calendar event ID for appointment ${appointment.id}`);
            } else {
              console.log(`❌ Failed to store Google Calendar event ID for appointment ${appointment.id}`);
            }
          } else {
            console.log(`❌ No event ID returned or appointment ID missing. EventId: ${eventId}, AppointmentId: ${appointment.id}`);
          }
          break;
        }
        case 'update':
          console.log(`🔄 Syncing appointment update. Appointment ID: ${appointment.id}, Google event ID: ${appointment.google_calendar_event_id}`);
          await googleCalendarSync.syncAppointmentUpdated(appointment, client, user, appointment.google_calendar_event_id);
          break;
        case 'delete':
          await googleCalendarSync.syncAppointmentDeleted(user, appointment.google_calendar_event_id);
          break;
      }
    } catch (error) {
      console.error('Error syncing appointment to Google Calendar:', error);
    }
  }

  getDatabase(): Database.Database | null {
    return this.db;
  }

  // Settings CRUD operations
  getSettings(): Settings | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM settings WHERE id = 1');
      return stmt.get() as Settings || null;
    } catch (error) {
      console.error('Error getting settings:', error);
      return null;
    }
  }

  updateSettings(settings: Settings): Settings | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE settings SET 
        clinic_name = ?, clinic_position = ?, clinic_email = ?, clinic_phone = ?,
        clinic_address = ?, clinic_city = ?, clinic_postal_code = ?, clinic_directions = ?, clinic_website = ?,
        manager_name = ?, license_number = ?, clinic_logo_path = ?,
        primary_theme_color = ?, secondary_theme_color = ?,
        work_start_time = ?, work_end_time = ?, appointment_duration = ?,
        send_email_before_appointment = ?, email_days_before = ?, email_time = ?,
        working_days = ?, break_start_time = ?, break_end_time = ?, max_appointments_per_day = ?,
        email_provider = ?, email_smtp_host = ?, email_smtp_port = ?, email_smtp_secure = ?,
        email_username = ?, email_password = ?, email_from_name = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = 1
      `);

      stmt.run(
        this.sanitizeValue(settings.clinic_name),
        this.sanitizeValue(settings.clinic_position),
        this.sanitizeValue(settings.clinic_email),
        this.sanitizeValue(settings.clinic_phone),
        this.sanitizeValue(settings.clinic_address),
        this.sanitizeValue(settings.clinic_city),
        this.sanitizeValue(settings.clinic_postal_code),
        this.sanitizeValue(settings.clinic_directions),
        this.sanitizeValue(settings.clinic_website),
        this.sanitizeValue(settings.manager_name),
        this.sanitizeValue(settings.license_number),
        this.sanitizeValue(settings.clinic_logo_path),
        this.sanitizeValue(settings.primary_theme_color),
        this.sanitizeValue(settings.secondary_theme_color),
        this.sanitizeValue(settings.work_start_time),
        this.sanitizeValue(settings.work_end_time),
        this.sanitizeValue(settings.appointment_duration),
        this.sanitizeValue(settings.send_email_before_appointment),
        this.sanitizeValue(settings.email_days_before),
        this.sanitizeValue(settings.email_time),
        this.sanitizeValue(settings.working_days),
        this.sanitizeValue(settings.break_start_time),
        this.sanitizeValue(settings.break_end_time),
        this.sanitizeValue(settings.max_appointments_per_day),
        this.sanitizeValue(settings.email_provider),
        this.sanitizeValue(settings.email_smtp_host),
        this.sanitizeValue(settings.email_smtp_port),
        this.sanitizeValue(settings.email_smtp_secure),
        this.sanitizeValue(settings.email_username),
        this.sanitizeValue(settings.email_password),
        this.sanitizeValue(settings.email_from_name)
      );

      return this.getSettings();
    } catch (error) {
      console.error('Error updating settings:', error);
      return null;
    }
  }

  // User CRUD operations
  createUser(user: Omit<User, 'id' | 'created_at' | 'updated_at'>): User | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO users (clinic_id, username, email, phone, password, role, is_active, profile_picture, primary_theme_color, secondary_theme_color, theme_preference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        this.sanitizeValue(user.clinic_id),
        user.username,
        this.sanitizeValue(user.email),
        this.sanitizeValue(user.phone),
        this.sanitizeValue(user.password),
        user.role,
        this.sanitizeValue(user.is_active ?? true),
        this.sanitizeValue(user.profile_picture),
        this.sanitizeValue(user.primary_theme_color),
        this.sanitizeValue(user.secondary_theme_color),
        this.sanitizeValue(user.theme_preference || 'system')
      );

      return { ...user, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  getUserById(id: number): User | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
      return stmt.get(id) as User | null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  getUserByUsername(username: string, companyId?: number): User | null {
    if (!this.db) return null;

    try {
      if (companyId) {
        // Get users that belong to clinics of the specified company OR are company admin users (clinic_id is null)
        const stmt = this.db.prepare(`
          SELECT u.* FROM users u 
          LEFT JOIN clinics c ON u.clinic_id = c.id 
          WHERE u.username = ? AND (c.company_id = ? OR u.clinic_id IS NULL)
        `);
        return stmt.get(username, companyId) as User | null;
      } else {
        const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
        return stmt.get(username) as User | null;
      }
    } catch (error) {
      console.error('Error getting user by username:', error);
      return null;
    }
  }

  getAllUsers(): User[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE is_active = 1 ORDER BY username');
      return stmt.all() as User[];
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  getUsersByClinicId(clinicId: number): User[] {
    if (!this.db) return [];

    try {
      // Get users that belong to the specific clinic OR global users (clinic_id is null)
      const stmt = this.db.prepare('SELECT * FROM users WHERE (clinic_id = ? OR clinic_id IS NULL) AND is_active = 1 ORDER BY username');
      return stmt.all(clinicId) as User[];
    } catch (error) {
      console.error('Error getting users by clinic ID:', error);
      return [];
    }
  }

  updateUser(user: User): User | null {
    if (!this.db || !user.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE users SET 
        username = ?, email = ?, phone = ?, password = ?, role = ?, is_active = ?, profile_picture = ?, primary_theme_color = ?, secondary_theme_color = ?, theme_preference = ?,
        google_account_connected = ?, google_account_email = ?, google_access_token = ?, google_refresh_token = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        user.username,
        this.sanitizeValue(user.email),
        this.sanitizeValue(user.phone),
        this.sanitizeValue(user.password),
        user.role,
        this.sanitizeValue(user.is_active ?? true),
        this.sanitizeValue(user.profile_picture),
        this.sanitizeValue(user.primary_theme_color),
        this.sanitizeValue(user.secondary_theme_color),
        this.sanitizeValue(user.theme_preference || 'system'),
        this.sanitizeValue(user.google_account_connected || false),
        this.sanitizeValue(user.google_account_email),
        this.sanitizeValue(user.google_access_token),
        this.sanitizeValue(user.google_refresh_token),
        user.id
      );

      return user;
    } catch (error) {
      console.error('Error updating user:', error);
      return null;
    }
  }

  deleteUser(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('UPDATE users SET is_active = 0 WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  authenticateUser(username: string, password?: string): User | null {
    if (!this.db) return null;

    try {
      let stmt;
      let user;

      if (password && password.trim() !== '') {
        stmt = this.db.prepare('SELECT * FROM users WHERE username = ? AND password = ? AND is_active = 1');
        user = stmt.get(username, password) as User | null;
      } else {
        stmt = this.db.prepare(`SELECT * FROM users WHERE username = ? AND (password IS NULL OR password = '' OR TRIM(password) = '') AND is_active = 1`);
        user = stmt.get(username) as User | null;
      }

      return user;
    } catch (error) {
      console.error('Error authenticating user:', error);
      return null;
    }
  }

  // Google Calendar integration methods
  connectGoogleAccount(userId: number, googleEmail: string, accessToken: string, refreshToken: string): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        UPDATE users SET 
        google_account_connected = 1,
        google_account_email = ?,
        google_access_token = ?,
        google_refresh_token = ?,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = stmt.run(googleEmail, accessToken, refreshToken, userId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error connecting Google account:', error);
      return false;
    }
  }

  disconnectGoogleAccount(userId: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        UPDATE users SET 
        google_account_connected = 0,
        google_account_email = NULL,
        google_access_token = NULL,
        google_refresh_token = NULL,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      const result = stmt.run(userId);
      return result.changes > 0;
    } catch (error) {
      console.error('Error disconnecting Google account:', error);
      return false;
    }
  }

  getAppointmentsByUserId(userId: number): Appointment[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM appointments WHERE user_id = ? ORDER BY date DESC, time DESC');
      return stmt.all(userId) as Appointment[];
    } catch (error) {
      console.error('Error getting appointments by user ID:', error);
      return [];
    }
  }

  // Email Log CRUD operations
  createEmailLog(emailLog: Omit<EmailLog, 'id'>): EmailLog | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO email_logs (appointment_id, email_address, success, error_message)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        emailLog.appointment_id,
        this.sanitizeValue(emailLog.email_address),
        emailLog.success ? 1 : 0,
        this.sanitizeValue(emailLog.error_message)
      );

      return { ...emailLog, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating email log:', error);
      return null;
    }
  }

  getEmailLogsByAppointment(appointmentId: number): EmailLog[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM email_logs WHERE appointment_id = ? ORDER BY sent_at DESC');
      return stmt.all(appointmentId) as EmailLog[];
    } catch (error) {
      console.error('Error getting email logs by appointment:', error);
      return [];
    }
  }

  getAllEmailLogs(): EmailLog[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM email_logs ORDER BY sent_at DESC');
      return stmt.all() as EmailLog[];
    } catch (error) {
      console.error('Error getting all email logs:', error);
      return [];
    }
  }

  // Chat CRUD operations
  createChat(title: string): Chat | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO chats (title) VALUES (?)
      `);

      const result = stmt.run(title);
      return { id: result.lastInsertRowid as number, title };
    } catch (error) {
      console.error('Error creating chat:', error);
      return null;
    }
  }

  getChatById(id: number): Chat | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM chats WHERE id = ?');
      return stmt.get(id) as Chat | null;
    } catch (error) {
      console.error('Error getting chat:', error);
      return null;
    }
  }

  getAllChats(): Chat[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM chats ORDER BY updated_at DESC');
      return stmt.all() as Chat[];
    } catch (error) {
      console.error('Error getting all chats:', error);
      return [];
    }
  }

  updateChat(chat: Chat): Chat | null {
    if (!this.db || !chat.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE chats SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `);

      stmt.run(chat.title, chat.id);
      return chat;
    } catch (error) {
      console.error('Error updating chat:', error);
      return null;
    }
  }

  deleteChat(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM chats WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting chat:', error);
      return false;
    }
  }

  // Chat Message CRUD operations
  createChatMessage(chatMessage: Omit<ChatMessage, 'id' | 'timestamp'>): ChatMessage | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO chat_messages (chat_id, type, content, data) VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        chatMessage.chat_id,
        chatMessage.type,
        chatMessage.content,
        this.sanitizeValue(chatMessage.data)
      );

      // Update chat's updated_at timestamp
      this.db.prepare('UPDATE chats SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(chatMessage.chat_id);

      return { ...chatMessage, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating chat message:', error);
      return null;
    }
  }

  getChatMessagesByChatId(chatId: number): ChatMessage[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM chat_messages WHERE chat_id = ? ORDER BY timestamp ASC');
      return stmt.all(chatId) as ChatMessage[];
    } catch (error) {
      console.error('Error getting chat messages:', error);
      return [];
    }
  }

  updateChatMessage(chatMessage: ChatMessage): ChatMessage | null {
    if (!this.db || !chatMessage.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE chat_messages SET chat_id = ?, type = ?, content = ?, data = ? WHERE id = ?
      `);

      stmt.run(
        chatMessage.chat_id,
        chatMessage.type,
        chatMessage.content,
        this.sanitizeValue(chatMessage.data),
        chatMessage.id
      );

      return chatMessage;
    } catch (error) {
      console.error('Error updating chat message:', error);
      return null;
    }
  }

  deleteChatMessage(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM chat_messages WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting chat message:', error);
      return false;
    }
  }

  emailTestConnection(): boolean {
    try {
      return true
    } catch (error) {
      console.error('Error testing email connection:', error)
      return false
    }
  }

  // Lookup table methods
  getAllLookupSuppliers(): LookupSupplier[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_supplier ORDER BY name');
      return stmt.all() as LookupSupplier[];
    } catch (error) {
      console.error('Error getting all suppliers:', error);
      return [];
    }
  }

  createLookupSupplier(data: Omit<LookupSupplier, 'id'>): LookupSupplier | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_supplier (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupSupplierById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating supplier:', error);
      return null;
    }
  }

  updateLookupSupplier(data: LookupSupplier): LookupSupplier | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_supplier SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupSupplierById(data.id!);
    } catch (error) {
      console.error('Error updating supplier:', error);
      return null;
    }
  }

  deleteLookupSupplier(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_supplier WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting supplier:', error);
      return false;
    }
  }

  getLookupSupplierById(id: number): LookupSupplier | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_supplier WHERE id = ?');
      return stmt.get(id) as LookupSupplier || null;
    } catch (error) {
      console.error('Error getting supplier by id:', error);
      return null;
    }
  }

  getAllLookupClinics(): LookupClinic[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_clinic ORDER BY name');
      return stmt.all() as LookupClinic[];
    } catch (error) {
      console.error('Error getting all clinics:', error);
      return [];
    }
  }

  createLookupClinic(data: Omit<LookupClinic, 'id'>): LookupClinic | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_clinic (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupClinicById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating clinic:', error);
      return null;
    }
  }

  updateLookupClinic(data: LookupClinic): LookupClinic | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_clinic SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupClinicById(data.id!);
    } catch (error) {
      console.error('Error updating clinic:', error);
      return null;
    }
  }

  deleteLookupClinic(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_clinic WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting clinic:', error);
      return false;
    }
  }

  getLookupClinicById(id: number): LookupClinic | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_clinic WHERE id = ?');
      return stmt.get(id) as LookupClinic || null;
    } catch (error) {
      console.error('Error getting clinic by id:', error);
      return null;
    }
  }

  getAllLookupOrderTypes(): LookupOrderType[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_order_type ORDER BY name');
      return stmt.all() as LookupOrderType[];
    } catch (error) {
      console.error('Error getting all order types:', error);
      return [];
    }
  }

  createLookupOrderType(data: Omit<LookupOrderType, 'id'>): LookupOrderType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_order_type (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupOrderTypeById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating order type:', error);
      return null;
    }
  }

  updateLookupOrderType(data: LookupOrderType): LookupOrderType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_order_type SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupOrderTypeById(data.id!);
    } catch (error) {
      console.error('Error updating order type:', error);
      return null;
    }
  }

  deleteLookupOrderType(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_order_type WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting order type:', error);
      return false;
    }
  }

  getLookupOrderTypeById(id: number): LookupOrderType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_order_type WHERE id = ?');
      return stmt.get(id) as LookupOrderType || null;
    } catch (error) {
      console.error('Error getting order type by id:', error);
      return null;
    }
  }

  getAllLookupReferralTypes(): LookupReferralType[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_referral_type ORDER BY name');
      return stmt.all() as LookupReferralType[];
    } catch (error) {
      console.error('Error getting all referral types:', error);
      return [];
    }
  }

  createLookupReferralType(data: Omit<LookupReferralType, 'id'>): LookupReferralType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_referral_type (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupReferralTypeById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating referral type:', error);
      return null;
    }
  }

  updateLookupReferralType(data: LookupReferralType): LookupReferralType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_referral_type SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupReferralTypeById(data.id!);
    } catch (error) {
      console.error('Error updating referral type:', error);
      return null;
    }
  }

  deleteLookupReferralType(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_referral_type WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting referral type:', error);
      return false;
    }
  }

  getLookupReferralTypeById(id: number): LookupReferralType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_referral_type WHERE id = ?');
      return stmt.get(id) as LookupReferralType || null;
    } catch (error) {
      console.error('Error getting referral type by id:', error);
      return null;
    }
  }

  getAllLookupLensModels(): LookupLensModel[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_lens_model ORDER BY name');
      return stmt.all() as LookupLensModel[];
    } catch (error) {
      console.error('Error getting all lens models:', error);
      return [];
    }
  }

  createLookupLensModel(data: Omit<LookupLensModel, 'id'>): LookupLensModel | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_lens_model (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupLensModelById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating lens model:', error);
      return null;
    }
  }

  updateLookupLensModel(data: LookupLensModel): LookupLensModel | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_lens_model SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupLensModelById(data.id!);
    } catch (error) {
      console.error('Error updating lens model:', error);
      return null;
    }
  }

  deleteLookupLensModel(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_lens_model WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting lens model:', error);
      return false;
    }
  }

  getLookupLensModelById(id: number): LookupLensModel | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_lens_model WHERE id = ?');
      return stmt.get(id) as LookupLensModel || null;
    } catch (error) {
      console.error('Error getting lens model by id:', error);
      return null;
    }
  }

  getAllLookupColors(): LookupColor[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_color ORDER BY name');
      return stmt.all() as LookupColor[];
    } catch (error) {
      console.error('Error getting all colors:', error);
      return [];
    }
  }

  createLookupColor(data: Omit<LookupColor, 'id'>): LookupColor | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_color (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupColorById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating color:', error);
      return null;
    }
  }

  updateLookupColor(data: LookupColor): LookupColor | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_color SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupColorById(data.id!);
    } catch (error) {
      console.error('Error updating color:', error);
      return null;
    }
  }

  deleteLookupColor(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_color WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting color:', error);
      return false;
    }
  }

  getLookupColorById(id: number): LookupColor | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_color WHERE id = ?');
      return stmt.get(id) as LookupColor || null;
    } catch (error) {
      console.error('Error getting color by id:', error);
      return null;
    }
  }

  getAllLookupMaterials(): LookupMaterial[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_material ORDER BY name');
      return stmt.all() as LookupMaterial[];
    } catch (error) {
      console.error('Error getting all materials:', error);
      return [];
    }
  }

  createLookupMaterial(data: Omit<LookupMaterial, 'id'>): LookupMaterial | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_material (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupMaterialById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating material:', error);
      return null;
    }
  }

  updateLookupMaterial(data: LookupMaterial): LookupMaterial | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_material SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupMaterialById(data.id!);
    } catch (error) {
      console.error('Error updating material:', error);
      return null;
    }
  }

  deleteLookupMaterial(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_material WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting material:', error);
      return false;
    }
  }

  getLookupMaterialById(id: number): LookupMaterial | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_material WHERE id = ?');
      return stmt.get(id) as LookupMaterial || null;
    } catch (error) {
      console.error('Error getting material by id:', error);
      return null;
    }
  }

  getAllLookupCoatings(): LookupCoating[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_coating ORDER BY name');
      return stmt.all() as LookupCoating[];
    } catch (error) {
      console.error('Error getting all coatings:', error);
      return [];
    }
  }

  createLookupCoating(data: Omit<LookupCoating, 'id'>): LookupCoating | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_coating (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupCoatingById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating coating:', error);
      return null;
    }
  }

  updateLookupCoating(data: LookupCoating): LookupCoating | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_coating SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupCoatingById(data.id!);
    } catch (error) {
      console.error('Error updating coating:', error);
      return null;
    }
  }

  deleteLookupCoating(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_coating WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting coating:', error);
      return false;
    }
  }

  getLookupCoatingById(id: number): LookupCoating | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_coating WHERE id = ?');
      return stmt.get(id) as LookupCoating || null;
    } catch (error) {
      console.error('Error getting coating by id:', error);
      return null;
    }
  }

  getAllLookupManufacturers(): LookupManufacturer[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_manufacturer ORDER BY name');
      return stmt.all() as LookupManufacturer[];
    } catch (error) {
      console.error('Error getting all manufacturers:', error);
      return [];
    }
  }

  createLookupManufacturer(data: Omit<LookupManufacturer, 'id'>): LookupManufacturer | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_manufacturer (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupManufacturerById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating manufacturer:', error);
      return null;
    }
  }

  updateLookupManufacturer(data: LookupManufacturer): LookupManufacturer | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_manufacturer SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupManufacturerById(data.id!);
    } catch (error) {
      console.error('Error updating manufacturer:', error);
      return null;
    }
  }

  deleteLookupManufacturer(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_manufacturer WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting manufacturer:', error);
      return false;
    }
  }

  getLookupManufacturerById(id: number): LookupManufacturer | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_manufacturer WHERE id = ?');
      return stmt.get(id) as LookupManufacturer || null;
    } catch (error) {
      console.error('Error getting manufacturer by id:', error);
      return null;
    }
  }

  getAllLookupFrameModels(): LookupFrameModel[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_frame_model ORDER BY name');
      return stmt.all() as LookupFrameModel[];
    } catch (error) {
      console.error('Error getting all frame models:', error);
      return [];
    }
  }

  createLookupFrameModel(data: Omit<LookupFrameModel, 'id'>): LookupFrameModel | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_frame_model (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupFrameModelById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating frame model:', error);
      return null;
    }
  }

  updateLookupFrameModel(data: LookupFrameModel): LookupFrameModel | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_frame_model SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupFrameModelById(data.id!);
    } catch (error) {
      console.error('Error updating frame model:', error);
      return null;
    }
  }

  deleteLookupFrameModel(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_frame_model WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting frame model:', error);
      return false;
    }
  }

  getLookupFrameModelById(id: number): LookupFrameModel | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_frame_model WHERE id = ?');
      return stmt.get(id) as LookupFrameModel || null;
    } catch (error) {
      console.error('Error getting frame model by id:', error);
      return null;
    }
  }

  getAllLookupContactLensTypes(): LookupContactLensType[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_contact_lens_type ORDER BY name');
      return stmt.all() as LookupContactLensType[];
    } catch (error) {
      console.error('Error getting all contact lens types:', error);
      return [];
    }
  }

  createLookupContactLensType(data: Omit<LookupContactLensType, 'id'>): LookupContactLensType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_contact_lens_type (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupContactLensTypeById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating contact lens type:', error);
      return null;
    }
  }

  updateLookupContactLensType(data: LookupContactLensType): LookupContactLensType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_contact_lens_type SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupContactLensTypeById(data.id!);
    } catch (error) {
      console.error('Error updating contact lens type:', error);
      return null;
    }
  }

  deleteLookupContactLensType(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_contact_lens_type WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting contact lens type:', error);
      return false;
    }
  }

  getLookupContactLensTypeById(id: number): LookupContactLensType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_contact_lens_type WHERE id = ?');
      return stmt.get(id) as LookupContactLensType || null;
    } catch (error) {
      console.error('Error getting contact lens type by id:', error);
      return null;
    }
  }

  getAllLookupContactEyeLensTypes(): LookupContactEyeLensType[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_contact_eye_lens_type ORDER BY name');
      return stmt.all() as LookupContactEyeLensType[];
    } catch (error) {
      console.error('Error getting all contact eye lens types:', error);
      return [];
    }
  }

  createLookupContactEyeLensType(data: Omit<LookupContactEyeLensType, 'id'>): LookupContactEyeLensType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_contact_eye_lens_type (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupContactEyeLensTypeById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating contact eye lens type:', error);
      return null;
    }
  }

  updateLookupContactEyeLensType(data: LookupContactEyeLensType): LookupContactEyeLensType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_contact_eye_lens_type SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupContactEyeLensTypeById(data.id!);
    } catch (error) {
      console.error('Error updating contact eye lens type:', error);
      return null;
    }
  }

  deleteLookupContactEyeLensType(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_contact_eye_lens_type WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting contact eye lens type:', error);
      return false;
    }
  }

  getLookupContactEyeLensTypeById(id: number): LookupContactEyeLensType | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_contact_eye_lens_type WHERE id = ?');
      return stmt.get(id) as LookupContactEyeLensType || null;
    } catch (error) {
      console.error('Error getting contact eye lens type by id:', error);
      return null;
    }
  }

  getAllLookupContactEyeMaterials(): LookupContactEyeMaterial[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_contact_eye_material ORDER BY name');
      return stmt.all() as LookupContactEyeMaterial[];
    } catch (error) {
      console.error('Error getting all contact eye materials:', error);
      return [];
    }
  }

  createLookupContactEyeMaterial(data: Omit<LookupContactEyeMaterial, 'id'>): LookupContactEyeMaterial | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_contact_eye_material (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupContactEyeMaterialById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating contact eye material:', error);
      return null;
    }
  }

  updateLookupContactEyeMaterial(data: LookupContactEyeMaterial): LookupContactEyeMaterial | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_contact_eye_material SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupContactEyeMaterialById(data.id!);
    } catch (error) {
      console.error('Error updating contact eye material:', error);
      return null;
    }
  }

  deleteLookupContactEyeMaterial(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_contact_eye_material WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting contact eye material:', error);
      return false;
    }
  }

  getLookupContactEyeMaterialById(id: number): LookupContactEyeMaterial | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_contact_eye_material WHERE id = ?');
      return stmt.get(id) as LookupContactEyeMaterial || null;
    } catch (error) {
      console.error('Error getting contact eye material by id:', error);
      return null;
    }
  }

  getAllLookupCleaningSolutions(): LookupCleaningSolution[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_cleaning_solution ORDER BY name');
      return stmt.all() as LookupCleaningSolution[];
    } catch (error) {
      console.error('Error getting all cleaning solutions:', error);
      return [];
    }
  }

  createLookupCleaningSolution(data: Omit<LookupCleaningSolution, 'id'>): LookupCleaningSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_cleaning_solution (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupCleaningSolutionById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating cleaning solution:', error);
      return null;
    }
  }

  updateLookupCleaningSolution(data: LookupCleaningSolution): LookupCleaningSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_cleaning_solution SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupCleaningSolutionById(data.id!);
    } catch (error) {
      console.error('Error updating cleaning solution:', error);
      return null;
    }
  }

  deleteLookupCleaningSolution(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_cleaning_solution WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting cleaning solution:', error);
      return false;
    }
  }

  getLookupCleaningSolutionById(id: number): LookupCleaningSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_cleaning_solution WHERE id = ?');
      return stmt.get(id) as LookupCleaningSolution || null;
    } catch (error) {
      console.error('Error getting cleaning solution by id:', error);
      return null;
    }
  }

  getAllLookupDisinfectionSolutions(): LookupDisinfectionSolution[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_disinfection_solution ORDER BY name');
      return stmt.all() as LookupDisinfectionSolution[];
    } catch (error) {
      console.error('Error getting all disinfection solutions:', error);
      return [];
    }
  }

  createLookupDisinfectionSolution(data: Omit<LookupDisinfectionSolution, 'id'>): LookupDisinfectionSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_disinfection_solution (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupDisinfectionSolutionById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating disinfection solution:', error);
      return null;
    }
  }

  updateLookupDisinfectionSolution(data: LookupDisinfectionSolution): LookupDisinfectionSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_disinfection_solution SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupDisinfectionSolutionById(data.id!);
    } catch (error) {
      console.error('Error updating disinfection solution:', error);
      return null;
    }
  }

  deleteLookupDisinfectionSolution(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_disinfection_solution WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting disinfection solution:', error);
      return false;
    }
  }

  getLookupDisinfectionSolutionById(id: number): LookupDisinfectionSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_disinfection_solution WHERE id = ?');
      return stmt.get(id) as LookupDisinfectionSolution || null;
    } catch (error) {
      console.error('Error getting disinfection solution by id:', error);
      return null;
    }
  }

  getAllLookupRinsingSolutions(): LookupRinsingSolution[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_rinsing_solution ORDER BY name');
      return stmt.all() as LookupRinsingSolution[];
    } catch (error) {
      console.error('Error getting all rinsing solutions:', error);
      return [];
    }
  }

  createLookupRinsingSolution(data: Omit<LookupRinsingSolution, 'id'>): LookupRinsingSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_rinsing_solution (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupRinsingSolutionById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating rinsing solution:', error);
      return null;
    }
  }

  updateLookupRinsingSolution(data: LookupRinsingSolution): LookupRinsingSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_rinsing_solution SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupRinsingSolutionById(data.id!);
    } catch (error) {
      console.error('Error updating rinsing solution:', error);
      return null;
    }
  }

  deleteLookupRinsingSolution(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_rinsing_solution WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting rinsing solution:', error);
      return false;
    }
  }

  getLookupRinsingSolutionById(id: number): LookupRinsingSolution | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_rinsing_solution WHERE id = ?');
      return stmt.get(id) as LookupRinsingSolution || null;
    } catch (error) {
      console.error('Error getting rinsing solution by id:', error);
      return null;
    }
  }

  getAllLookupManufacturingLabs(): LookupManufacturingLab[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_manufacturing_lab ORDER BY name');
      return stmt.all() as LookupManufacturingLab[];
    } catch (error) {
      console.error('Error getting all manufacturing labs:', error);
      return [];
    }
  }

  createLookupManufacturingLab(data: Omit<LookupManufacturingLab, 'id'>): LookupManufacturingLab | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_manufacturing_lab (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupManufacturingLabById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating manufacturing lab:', error);
      return null;
    }
  }

  updateLookupManufacturingLab(data: LookupManufacturingLab): LookupManufacturingLab | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_manufacturing_lab SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupManufacturingLabById(data.id!);
    } catch (error) {
      console.error('Error updating manufacturing lab:', error);
      return null;
    }
  }

  deleteLookupManufacturingLab(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_manufacturing_lab WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting manufacturing lab:', error);
      return false;
    }
  }

  getLookupManufacturingLabById(id: number): LookupManufacturingLab | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_manufacturing_lab WHERE id = ?');
      return stmt.get(id) as LookupManufacturingLab || null;
    } catch (error) {
      console.error('Error getting manufacturing lab by id:', error);
      return null;
    }
  }

  getAllLookupAdvisors(): LookupAdvisor[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_advisor ORDER BY name');
      return stmt.all() as LookupAdvisor[];
    } catch (error) {
      console.error('Error getting all advisors:', error);
      return [];
    }
  }

  createLookupAdvisor(data: Omit<LookupAdvisor, 'id'>): LookupAdvisor | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('INSERT INTO lookup_advisor (name) VALUES (?)');
      const result = stmt.run(this.sanitizeValue(data.name));
      return this.getLookupAdvisorById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating advisor:', error);
      return null;
    }
  }

  updateLookupAdvisor(data: LookupAdvisor): LookupAdvisor | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('UPDATE lookup_advisor SET name = ? WHERE id = ?');
      stmt.run(this.sanitizeValue(data.name), data.id);
      return this.getLookupAdvisorById(data.id!);
    } catch (error) {
      console.error('Error updating advisor:', error);
      return null;
    }
  }

  deleteLookupAdvisor(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM lookup_advisor WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting advisor:', error);
      return false;
    }
  }

  getLookupAdvisorById(id: number): LookupAdvisor | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM lookup_advisor WHERE id = ?');
      return stmt.get(id) as LookupAdvisor || null;
    } catch (error) {
      console.error('Error getting advisor by id:', error);
      return null;
    }
  }

  // File CRUD operations
  createFile(file: Omit<File, 'id'>): File | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO files (
          client_id, file_name, file_path, file_size, file_type, uploaded_by, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        file.client_id,
        this.sanitizeValue(file.file_name),
        this.sanitizeValue(file.file_path),
        this.sanitizeValue(file.file_size),
        this.sanitizeValue(file.file_type),
        this.sanitizeValue(file.uploaded_by),
        this.sanitizeValue(file.notes)
      );

      return { ...file, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating file:', error);
      return null;
    }
  }

  getFileById(id: number): File | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
      return stmt.get(id) as File | null;
    } catch (error) {
      console.error('Error getting file:', error);
      return null;
    }
  }

  getFilesByClientId(clientId: number): File[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM files WHERE client_id = ? ORDER BY upload_date DESC');
      return stmt.all(clientId) as File[];
    } catch (error) {
      console.error('Error getting files by client:', error);
      return [];
    }
  }

  getAllFiles(clinicId?: number): File[] {
    if (!this.db) return [];

    try {
      if (clinicId) {
        const stmt = this.db.prepare(`
          SELECT f.* FROM files f
          JOIN clients c ON f.client_id = c.id
          WHERE c.clinic_id = ?
          ORDER BY f.upload_date DESC
        `);
        return stmt.all(clinicId) as File[];
      } else {
        const stmt = this.db.prepare('SELECT * FROM files ORDER BY upload_date DESC');
        return stmt.all() as File[];
      }
    } catch (error) {
      console.error('Error getting all files:', error);
      return [];
    }
  }

  updateFile(file: File): File | null {
    if (!this.db || !file.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE files SET 
        client_id = ?, file_name = ?, file_path = ?, file_size = ?, 
        file_type = ?, uploaded_by = ?, notes = ?
        WHERE id = ?
      `);

      stmt.run(
        file.client_id,
        this.sanitizeValue(file.file_name),
        this.sanitizeValue(file.file_path),
        this.sanitizeValue(file.file_size),
        this.sanitizeValue(file.file_type),
        this.sanitizeValue(file.uploaded_by),
        this.sanitizeValue(file.notes),
        file.id
      );

      return file;
    } catch (error) {
      console.error('Error updating file:', error);
      return null;
    }
  }

  deleteFile(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM files WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting file:', error);
      return false;
    }
  }

  // Exam Layout CRUD operations
  createExamLayout(layout: Omit<ExamLayout, 'id'>): ExamLayout | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO exam_layouts (name, layout_data, type, is_default)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        layout.name,
        layout.layout_data,
        layout.type || 'exam',
        this.sanitizeValue(layout.is_default)
      );

      return { ...layout, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating exam layout:', error);
      return null;
    }
  }

  getExamLayoutById(id: number): ExamLayout | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM exam_layouts WHERE id = ?');
      return stmt.get(id) as ExamLayout | null;
    } catch (error) {
      console.error('Error getting exam layout by ID:', error);
      return null;
    }
  }

  getAllExamLayouts(): ExamLayout[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM exam_layouts WHERE is_active = 1 ORDER BY created_at DESC');
      return stmt.all() as ExamLayout[];
    } catch (error) {
      console.error('Error getting all exam layouts:', error);
      return [];
    }
  }

  getExamLayoutsByType(type: 'opticlens' | 'exam'): ExamLayout[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM exam_layouts WHERE type = ? AND is_active = 1 ORDER BY created_at DESC');
      return stmt.all(type) as ExamLayout[];
    } catch (error) {
      console.error('Error getting exam layouts by type:', error);
      return [];
    }
  }

  updateExamLayout(layout: ExamLayout): ExamLayout | null {
    if (!this.db || !layout.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE exam_layouts 
        SET name = ?, layout_data = ?, type = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        layout.name,
        layout.layout_data,
        layout.type || 'exam',
        this.sanitizeValue(layout.is_default),
        layout.id
      );

      return layout;
    } catch (error) {
      console.error('Error updating exam layout:', error);
      return null;
    }
  }

  deleteExamLayout(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('UPDATE exam_layouts SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deactivating exam layout:', error);
      return false;
    }
  }

  getDefaultExamLayout(): ExamLayout | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM exam_layouts WHERE is_default = 1 LIMIT 1');
      return stmt.get() as ExamLayout | null;
    } catch (error) {
      console.error('Error getting default exam layout:', error);
      return null;
    }
  }

  getDefaultExamLayouts(): ExamLayout[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM exam_layouts WHERE is_default = 1 ORDER BY created_at ASC');
      return stmt.all() as ExamLayout[];
    } catch (error) {
      console.error('Error getting default exam layouts:', error);
      return [];
    }
  }

  // Get all layouts for a specific exam
  getLayoutsByExamId(examId: number): ExamLayout[] {
    if (!this.db) return [];

    try {
      // First get instances for the exam
      const instances = this.getExamLayoutInstancesByExamId(examId);
      if (instances.length === 0) return [];
      
      // Then get the layouts from those instances
      const layouts: ExamLayout[] = [];
      for (const instance of instances) {
        const layout = this.getExamLayoutById(instance.layout_id);
        if (layout) layouts.push(layout);
      }
      
      return layouts;
    } catch (error) {
      console.error('Error getting layouts for exam:', error);
      return [];
    }
  }

  // Deactivate all layouts for a specific exam
  deactivateAllLayoutsForExam(examId: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare(`
        UPDATE exam_layout_instances 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE exam_id = ?
      `);

      stmt.run(examId);
      return true;
    } catch (error) {
      console.error('Error deactivating exam layout instances:', error);
      return false;
    }
  }

  // ExamLayoutInstance CRUD operations
  
  createExamLayoutInstance(data: Omit<ExamLayoutInstance, 'id'>): ExamLayoutInstance | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO exam_layout_instances (exam_id, layout_id, is_active, \`order\`)
        VALUES (?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.exam_id,
        data.layout_id,
        this.sanitizeValue(data.is_active),
        this.sanitizeValue(data.order)
      );

      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating exam layout instance:', error);
      return null;
    }
  }

  getExamLayoutInstanceById(id: number): ExamLayoutInstance | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM exam_layout_instances WHERE id = ?');
      return stmt.get(id) as ExamLayoutInstance | null;
    } catch (error) {
      console.error('Error getting exam layout instance by ID:', error);
      return null;
    }
  }

  getExamLayoutInstancesByExamId(examId: number): ExamLayoutInstance[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM exam_layout_instances WHERE exam_id = ? ORDER BY `order` ASC');
      return stmt.all(examId) as ExamLayoutInstance[];
    } catch (error) {
      console.error('Error getting exam layout instances by exam ID:', error);
      return [];
    }
  }

  getActiveExamLayoutInstanceByExamId(examId: number): ExamLayoutInstance | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM exam_layout_instances WHERE exam_id = ? AND is_active = 1 LIMIT 1');
      return stmt.get(examId) as ExamLayoutInstance | null;
    } catch (error) {
      console.error('Error getting active exam layout instance by exam ID:', error);
      return null;
    }
  }

  updateExamLayoutInstance(data: ExamLayoutInstance): ExamLayoutInstance | null {
    if (!this.db || !data.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE exam_layout_instances 
        SET exam_id = ?, layout_id = ?, is_active = ?, \`order\` = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        data.exam_id,
        data.layout_id,
        this.sanitizeValue(data.is_active),
        this.sanitizeValue(data.order),
        data.id
      );

      return data;
    } catch (error) {
      console.error('Error updating exam layout instance:', error);
      return null;
    }
  }

  deleteExamLayoutInstance(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM exam_layout_instances WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting exam layout instance:', error);
      return false;
    }
  }

  setActiveExamLayoutInstance(examId: number, layoutInstanceId: number): boolean {
    if (!this.db) return false;

    try {
      // First, set all instances for this exam to not active
      this.db.prepare(`
        UPDATE exam_layout_instances 
        SET is_active = 0, updated_at = CURRENT_TIMESTAMP
        WHERE exam_id = ?
      `).run(examId);

      // Then set the specified layout instance to active
      const stmt = this.db.prepare(`
        UPDATE exam_layout_instances 
        SET is_active = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND exam_id = ?
      `);
      const result = stmt.run(layoutInstanceId, examId);

      return result.changes > 0;
    } catch (error) {
      console.error('Error setting active exam layout instance:', error);
      return false;
    }
  }

  // Helper method to ensure an exam has at least one layout
  ensureExamHasLayout(examId: number): ExamLayoutInstance | null {
    if (!this.db) return null;

    try {
      // Check if exam already has layouts
      const existingLayouts = this.getExamLayoutInstancesByExamId(examId);
      
      if (existingLayouts.length > 0) {
        // If there's no active layout, set the first one as active
        const activeLayout = existingLayouts.find(l => l.is_active);
        if (!activeLayout) {
          this.setActiveExamLayoutInstance(examId, existingLayouts[0].id!);
          return { ...existingLayouts[0], is_active: true };
        }
        return activeLayout;
      }
      
      // No layouts found, create one from the default template
      const defaultLayout = this.getDefaultExamLayout();
      if (!defaultLayout) return null;
      
      // Create a layout instance using the default layout
      const layoutInstance = this.createExamLayoutInstance({
        exam_id: examId,
        layout_id: defaultLayout.id!,
        is_active: true,
        order: 0
      });
      
      return layoutInstance;
    } catch (error) {
      console.error('Error ensuring exam has layout:', error);
      return null;
    }
  }

  deleteFinalSubjectiveExam(id: number): boolean {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare('DELETE FROM final_subjective_exams WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting final subjective exam:', error);
      return false;
    }
  }

  createUncorrectedVAExam(exam: Omit<UncorrectedVAExam, 'id'>): UncorrectedVAExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'INSERT INTO uncorrected_va_exams (layout_instance_id, r_fv, l_fv, r_iv, l_iv, r_nv_j, l_nv_j) VALUES (@layout_instance_id, @r_fv, @l_fv, @r_iv, @l_iv, @r_nv_j, @l_nv_j)'
      );
      const result = stmt.run({
        ...exam,
        r_fv: this.sanitizeValue(exam.r_fv),
        l_fv: this.sanitizeValue(exam.l_fv),
        r_iv: this.sanitizeValue(exam.r_iv),
        l_iv: this.sanitizeValue(exam.l_iv),
        r_nv_j: this.sanitizeValue(exam.r_nv_j),
        l_nv_j: this.sanitizeValue(exam.l_nv_j),
      });
      return this.getUncorrectedVAExamById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating uncorrected VA exam:', error);
      return null;
    }
  }

  getUncorrectedVAExamById(id: number): UncorrectedVAExam | null {
    if (!this.db) return null;
    try {
      return this.db.prepare('SELECT * FROM uncorrected_va_exams WHERE id = ?').get(id) as UncorrectedVAExam || null;
    } catch (error) {
      console.error('Error getting uncorrected VA exam by id:', error);
      return null;
    }
  }

  getUncorrectedVAExamByLayoutInstanceId(layoutInstanceId: number): UncorrectedVAExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM uncorrected_va_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as UncorrectedVAExam || null;
    } catch (error) {
      console.error('Error getting uncorrected VA exam:', error);
      return null;
    }
  }

  updateUncorrectedVAExam(exam: UncorrectedVAExam): UncorrectedVAExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'UPDATE uncorrected_va_exams SET layout_instance_id = @layout_instance_id, r_fv = @r_fv, l_fv = @l_fv, r_iv = @r_iv, l_iv = @l_iv, r_nv_j = @r_nv_j, l_nv_j = @l_nv_j WHERE id = @id'
      );
      stmt.run({
        ...exam,
        r_fv: this.sanitizeValue(exam.r_fv),
        l_fv: this.sanitizeValue(exam.l_fv),
        r_iv: this.sanitizeValue(exam.r_iv),
        l_iv: this.sanitizeValue(exam.l_iv),
        r_nv_j: this.sanitizeValue(exam.r_nv_j),
        l_nv_j: this.sanitizeValue(exam.l_nv_j),
      });
      return this.getUncorrectedVAExamById(exam.id!);
    } catch (error) {
      console.error('Error updating uncorrected VA exam:', error);
      return null;
    }
  }

  createKeratometerExam(exam: Omit<KeratometerExam, 'id'>): KeratometerExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'INSERT INTO keratometer_exams (layout_instance_id, r_k1, r_k2, r_axis, l_k1, l_k2, l_axis) VALUES (@layout_instance_id, @r_k1, @r_k2, @r_axis, @l_k1, @l_k2, @l_axis)'
      );
      const result = stmt.run({
        ...exam,
        r_k1: this.sanitizeValue(exam.r_k1),
        r_k2: this.sanitizeValue(exam.r_k2),
        r_axis: this.sanitizeValue(exam.r_axis),
        l_k1: this.sanitizeValue(exam.l_k1),
        l_k2: this.sanitizeValue(exam.l_k2),
        l_axis: this.sanitizeValue(exam.l_axis),
      });
      return this.getKeratometerExamById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating keratometer exam:', error);
      return null;
    }
  }

  getKeratometerExamById(id: number): KeratometerExam | null {
    if (!this.db) return null;
    try {
      return this.db.prepare('SELECT * FROM keratometer_exams WHERE id = ?').get(id) as KeratometerExam || null;
    } catch (error) {
      console.error('Error getting keratometer exam by id:', error);
      return null;
    }
  }

  getKeratometerExamByLayoutInstanceId(layoutInstanceId: number): KeratometerExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM keratometer_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as KeratometerExam || null;
    } catch (error) {
      console.error('Error getting keratometer exam:', error);
      return null;
    }
  }

  updateKeratometerExam(exam: KeratometerExam): KeratometerExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'UPDATE keratometer_exams SET layout_instance_id = @layout_instance_id, r_k1 = @r_k1, r_k2 = @r_k2, r_axis = @r_axis, l_k1 = @l_k1, l_k2 = @l_k2, l_axis = @l_axis WHERE id = @id'
      );
      stmt.run({
        ...exam,
        r_k1: this.sanitizeValue(exam.r_k1),
        r_k2: this.sanitizeValue(exam.r_k2),
        r_axis: this.sanitizeValue(exam.r_axis),
        l_k1: this.sanitizeValue(exam.l_k1),
        l_k2: this.sanitizeValue(exam.l_k2),
        l_axis: this.sanitizeValue(exam.l_axis),
      });
      return this.getKeratometerExamById(exam.id!);
    } catch (error) {
      console.error('Error updating keratometer exam:', error);
      return null;
    }
  }

  createKeratometerFullExam(exam: Omit<KeratometerFullExam, 'id'>): KeratometerFullExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'INSERT INTO keratometer_full_exams (layout_instance_id, r_dpt_k1, r_dpt_k2, l_dpt_k1, l_dpt_k2, r_mm_k1, r_mm_k2, l_mm_k1, l_mm_k2, r_mer_k1, r_mer_k2, l_mer_k1, l_mer_k2, r_astig, l_astig) VALUES (@layout_instance_id, @r_dpt_k1, @r_dpt_k2, @l_dpt_k1, @l_dpt_k2, @r_mm_k1, @r_mm_k2, @l_mm_k1, @l_mm_k2, @r_mer_k1, @r_mer_k2, @l_mer_k1, @l_mer_k2, @r_astig, @l_astig)'
      );
      const result = stmt.run({
        ...exam,
        r_dpt_k1: this.sanitizeValue(exam.r_dpt_k1),
        r_dpt_k2: this.sanitizeValue(exam.r_dpt_k2),
        l_dpt_k1: this.sanitizeValue(exam.l_dpt_k1),
        l_dpt_k2: this.sanitizeValue(exam.l_dpt_k2),
        r_mm_k1: this.sanitizeValue(exam.r_mm_k1),
        r_mm_k2: this.sanitizeValue(exam.r_mm_k2),
        l_mm_k1: this.sanitizeValue(exam.l_mm_k1),
        l_mm_k2: this.sanitizeValue(exam.l_mm_k2),
        r_mer_k1: this.sanitizeValue(exam.r_mer_k1),
        r_mer_k2: this.sanitizeValue(exam.r_mer_k2),
        l_mer_k1: this.sanitizeValue(exam.l_mer_k1),
        l_mer_k2: this.sanitizeValue(exam.l_mer_k2),
        r_astig: exam.r_astig,
        l_astig: exam.l_astig,
      });
      return this.getKeratometerFullExamById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating keratometer full exam:', error);
      return null;
    }
  }

  getKeratometerFullExamById(id: number): KeratometerFullExam | null {
    if (!this.db) return null;
    try {
      return this.db.prepare('SELECT * FROM keratometer_full_exams WHERE id = ?').get(id) as KeratometerFullExam || null;
    } catch (error) {
      console.error('Error getting keratometer full exam by id:', error);
      return null;
    }
  }

  getKeratometerFullExamByLayoutInstanceId(layoutInstanceId: number): KeratometerFullExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM keratometer_full_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as KeratometerFullExam || null;
    } catch (error) {
      console.error('Error getting keratometer full exam:', error);
      return null;
    }
  }

  updateKeratometerFullExam(exam: KeratometerFullExam): KeratometerFullExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'UPDATE keratometer_full_exams SET layout_instance_id = @layout_instance_id, r_dpt_k1 = @r_dpt_k1, r_dpt_k2 = @r_dpt_k2, l_dpt_k1 = @l_dpt_k1, l_dpt_k2 = @l_dpt_k2, r_mm_k1 = @r_mm_k1, r_mm_k2 = @r_mm_k2, l_mm_k1 = @l_mm_k1, l_mm_k2 = @l_mm_k2, r_mer_k1 = @r_mer_k1, r_mer_k2 = @r_mer_k2, l_mer_k1 = @l_mer_k1, l_mer_k2 = @l_mer_k2, r_astig = @r_astig, l_astig = @l_astig WHERE id = @id'
      );
      stmt.run({
        ...exam,
        r_dpt_k1: this.sanitizeValue(exam.r_dpt_k1),
        r_dpt_k2: this.sanitizeValue(exam.r_dpt_k2),
        l_dpt_k1: this.sanitizeValue(exam.l_dpt_k1),
        l_dpt_k2: this.sanitizeValue(exam.l_dpt_k2),
        r_mm_k1: this.sanitizeValue(exam.r_mm_k1),
        r_mm_k2: this.sanitizeValue(exam.r_mm_k2),
        l_mm_k1: this.sanitizeValue(exam.l_mm_k1),
        l_mm_k2: this.sanitizeValue(exam.l_mm_k2),
        r_mer_k1: this.sanitizeValue(exam.r_mer_k1),
        r_mer_k2: this.sanitizeValue(exam.r_mer_k2),
        l_mer_k1: this.sanitizeValue(exam.l_mer_k1),
        l_mer_k2: this.sanitizeValue(exam.l_mer_k2),
        r_astig: exam.r_astig,
        l_astig: exam.l_astig,
      });
      return this.getKeratometerFullExamById(exam.id!);
    } catch (error) {
      console.error('Error updating keratometer full exam:', error);
      return null;
    }
  }

  createCornealTopographyExam(exam: Omit<CornealTopographyExam, 'id'>): CornealTopographyExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'INSERT INTO corneal_topography_exams (layout_instance_id, l_note, r_note, title) VALUES (@layout_instance_id, @l_note, @r_note, @title)'
      );
      const result = stmt.run({
        ...exam,
        l_note: exam.l_note || null,
        r_note: exam.r_note || null,
        title: exam.title || null,
      });
      return this.getCornealTopographyExamById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating corneal topography exam:', error);
      return null;
    }
  }

  getCornealTopographyExamById(id: number): CornealTopographyExam | null {
    if (!this.db) return null;
    try {
      return this.db.prepare('SELECT * FROM corneal_topography_exams WHERE id = ?').get(id) as CornealTopographyExam || null;
    } catch (error) {
      console.error('Error getting corneal topography exam by id:', error);
      return null;
    }
  }

  getCornealTopographyExamByLayoutInstanceId(layoutInstanceId: number): CornealTopographyExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM corneal_topography_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as CornealTopographyExam || null;
    } catch (error) {
      console.error('Error getting corneal topography exam:', error);
      return null;
    }
  }

  updateCornealTopographyExam(exam: CornealTopographyExam): CornealTopographyExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'UPDATE corneal_topography_exams SET layout_instance_id = @layout_instance_id, l_note = @l_note, r_note = @r_note, title = @title WHERE id = @id'
      );
      stmt.run({
        ...exam,
        l_note: exam.l_note || null,
        r_note: exam.r_note || null,
        title: exam.title || null,
      });
      return this.getCornealTopographyExamById(exam.id!);
    } catch (error) {
      console.error('Error updating corneal topography exam:', error);
      return null;
    }
  }

  createCoverTestExam(exam: Omit<CoverTestExam, 'id'>): CoverTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO cover_test_exams (layout_instance_id, card_instance_id, card_id, tab_index, deviation_type, deviation_direction, fv_1, fv_2, nv_1, nv_2) VALUES (@layout_instance_id, @card_instance_id, @card_id, @tab_index, @deviation_type, @deviation_direction, @fv_1, @fv_2, @nv_1, @nv_2)`
      );
      const result = stmt.run({
        ...exam,
        deviation_type: this.sanitizeValue(exam.deviation_type),
        deviation_direction: this.sanitizeValue(exam.deviation_direction),
        fv_1: this.sanitizeValue(exam.fv_1),
        fv_2: this.sanitizeValue(exam.fv_2),
        nv_1: this.sanitizeValue(exam.nv_1),
        nv_2: this.sanitizeValue(exam.nv_2),
        card_instance_id: exam.card_instance_id,
        card_id: exam.card_id,
        tab_index: exam.tab_index,
      });
      return this.getCoverTestExamById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating cover test exam:', error);
      return null;
    }
  }

  getCoverTestExamById(id: number): CoverTestExam | null {
    if (!this.db) return null;
    try {
      return this.db.prepare('SELECT * FROM cover_test_exams WHERE id = ?').get(id) as CoverTestExam || null;
    } catch (error) {
      console.error('Error getting cover test exam by id:', error);
      return null;
    }
  }

  getCoverTestExamByLayoutInstanceId(layoutInstanceId: number, cardInstanceId?: string): CoverTestExam | null {
    if (!this.db) return null;
    try {
      if (cardInstanceId) {
        const stmt = this.db.prepare('SELECT * FROM cover_test_exams WHERE layout_instance_id = ? AND card_instance_id = ?');
        return stmt.get(layoutInstanceId, cardInstanceId) as CoverTestExam || null;
      } else {
        const stmt = this.db.prepare('SELECT * FROM cover_test_exams WHERE layout_instance_id = ?');
        return stmt.get(layoutInstanceId) as CoverTestExam || null;
      }
    } catch (error) {
      console.error('Error getting cover test exam:', error);
      return null;
    }
  }

  getAllCoverTestExamsByLayoutInstanceId(layoutInstanceId: number): CoverTestExam[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare('SELECT * FROM cover_test_exams WHERE layout_instance_id = ?');
      return stmt.all(layoutInstanceId) as CoverTestExam[];
    } catch (error) {
      console.error('Error getting all cover test exams:', error);
      return [];
    }
  }

  updateCoverTestExam(exam: CoverTestExam): CoverTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        UPDATE cover_test_exams SET layout_instance_id = @layout_instance_id, card_instance_id = @card_instance_id, card_id = @card_id, tab_index = @tab_index, deviation_type = @deviation_type, deviation_direction = @deviation_direction, fv_1 = @fv_1, fv_2 = @fv_2, nv_1 = @nv_1, nv_2 = @nv_2 WHERE id = @id
      `);
      stmt.run({
        ...exam,
        deviation_type: this.sanitizeValue(exam.deviation_type),
        deviation_direction: this.sanitizeValue(exam.deviation_direction),
        fv_1: this.sanitizeValue(exam.fv_1),
        fv_2: this.sanitizeValue(exam.fv_2),
        nv_1: this.sanitizeValue(exam.nv_1),
        nv_2: this.sanitizeValue(exam.nv_2),
      });
      return this.getCoverTestExamById(exam.id!);
    } catch (error) {
      console.error('Error updating cover test exam:', error);
      return null;
    }
  }
  // Work Shift CRUD operations
  createWorkShift(workShift: Omit<WorkShift, 'id' | 'created_at' | 'updated_at'>): WorkShift | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO work_shifts (
          user_id, start_time, end_time, duration_minutes, date, status
        ) VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        workShift.user_id,
        workShift.start_time,
        this.sanitizeValue(workShift.end_time),
        this.sanitizeValue(workShift.duration_minutes),
        workShift.date,
        workShift.status
      );

      return this.getWorkShiftById(result.lastInsertRowid as number);
    } catch (error) {
      console.error('Error creating work shift:', error);
      return null;
    }
  }

  getWorkShiftById(id: number): WorkShift | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM work_shifts WHERE id = ?');
      return stmt.get(id) as WorkShift | null;
    } catch (error) {
      console.error('Error getting work shift by ID:', error);
      return null;
    }
  }

  getActiveWorkShiftByUserId(userId: number): WorkShift | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM work_shifts 
        WHERE user_id = ? AND status = 'active' 
        ORDER BY created_at DESC LIMIT 1
      `);
      return stmt.get(userId) as WorkShift | null;
    } catch (error) {
      console.error('Error getting active work shift:', error);
      return null;
    }
  }

  getWorkShiftsByUserId(userId: number): WorkShift[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM work_shifts 
        WHERE user_id = ? 
        ORDER BY date DESC, start_time DESC
      `);
      return stmt.all(userId) as WorkShift[];
    } catch (error) {
      console.error('Error getting work shifts by user ID:', error);
      return [];
    }
  }

  getWorkShiftsByUserAndMonth(userId: number, year: number, month: number): WorkShift[] {
    if (!this.db) return [];

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      
      const stmt = this.db.prepare(`
        SELECT * FROM work_shifts 
        WHERE user_id = ? AND date >= ? AND date < ? AND status = 'completed'
        ORDER BY date DESC, start_time DESC
      `);
      return stmt.all(userId, startDate, endDate) as WorkShift[];
    } catch (error) {
      console.error('Error getting work shifts by user and month:', error);
      return [];
    }
  }

  getWorkShiftsByUserAndDate(userId: number, date: string): WorkShift[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT * FROM work_shifts 
        WHERE user_id = ? AND date = ?
        ORDER BY start_time ASC
      `);
      return stmt.all(userId, date) as WorkShift[];
    } catch (error) {
      console.error('Error getting work shifts by user and date:', error);
      return [];
    }
  }

  updateWorkShift(workShift: WorkShift): WorkShift | null {
    if (!this.db || !workShift.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE work_shifts SET 
          end_time = ?, duration_minutes = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        this.sanitizeValue(workShift.end_time),
        this.sanitizeValue(workShift.duration_minutes),
        workShift.status,
        workShift.id
      );

      return this.getWorkShiftById(workShift.id);
    } catch (error) {
      console.error('Error updating work shift:', error);
      return null;
    }
  }

  deleteWorkShift(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM work_shifts WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting work shift:', error);
      return false;
    }
  }

  getWorkShiftStats(userId: number, year: number, month: number): {
    totalShifts: number;
    totalMinutes: number;
    averageMinutes: number;
  } {
    if (!this.db) return { totalShifts: 0, totalMinutes: 0, averageMinutes: 0 };

    try {
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      
      const stmt = this.db.prepare(`
        SELECT 
          COUNT(*) as totalShifts,
          COALESCE(SUM(duration_minutes), 0) as totalMinutes,
          COALESCE(AVG(duration_minutes), 0) as averageMinutes
        FROM work_shifts 
        WHERE user_id = ? AND date >= ? AND date < ? AND status = 'completed'
      `);
      
      const result = stmt.get(userId, startDate, endDate) as {
        totalShifts: number;
        totalMinutes: number;
        averageMinutes: number;
      };
      return {
        totalShifts: result.totalShifts || 0,
        totalMinutes: result.totalMinutes || 0,
        averageMinutes: Math.round(result.averageMinutes || 0)
      };
    } catch (error) {
      console.error('Error getting work shift stats:', error);
      return { totalShifts: 0, totalMinutes: 0, averageMinutes: 0 };
    }
  }

  // Campaign CRUD operations
  createCampaign(campaign: Omit<Campaign, 'id'>): Campaign | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO campaigns (name, filters, email_enabled, email_content, sms_enabled, sms_content, active, active_since, mail_sent, sms_sent, execute_once_per_client)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        campaign.name,
        campaign.filters,
        this.sanitizeValue(campaign.email_enabled),
        campaign.email_content,
        this.sanitizeValue(campaign.sms_enabled),
        campaign.sms_content,
        this.sanitizeValue(campaign.active),
        this.sanitizeValue(campaign.active_since),
        this.sanitizeValue(campaign.mail_sent),
        this.sanitizeValue(campaign.sms_sent),
        this.sanitizeValue(campaign.execute_once_per_client)
      );
      return { ...campaign, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating campaign:', error);
      return null;
    }
  }

  getCampaignById(id: number): Campaign | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM campaigns WHERE id = ?');
      return stmt.get(id) as Campaign | null;
    } catch (error) {
      console.error('Error getting campaign:', error);
      return null;
    }
  }

  getAllCampaigns(clinicId?: number): Campaign[] {
    if (!this.db) return [];
    try {
      if (clinicId) {
        // For now, campaigns are global but we can add clinic_id filtering later if needed
        // This maintains backward compatibility while allowing future clinic-specific campaigns
        const stmt = this.db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC');
        return stmt.all() as Campaign[];
      } else {
        const stmt = this.db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC');
        return stmt.all() as Campaign[];
      }
    } catch (error) {
      console.error('Error getting all campaigns:', error);
      return [];
    }
  }

  updateCampaign(campaign: Campaign): Campaign | null {
    if (!this.db || !campaign.id) return null;
    try {
      const stmt = this.db.prepare(`
        UPDATE campaigns SET 
        name = ?, filters = ?, email_enabled = ?, email_content = ?, sms_enabled = ?, sms_content = ?, active = ?, active_since = ?, mail_sent = ?, sms_sent = ?, execute_once_per_client = ?
        WHERE id = ?
      `);
      stmt.run(
        campaign.name,
        campaign.filters,
        this.sanitizeValue(campaign.email_enabled),
        campaign.email_content,
        this.sanitizeValue(campaign.sms_enabled),
        campaign.sms_content,
        this.sanitizeValue(campaign.active),
        this.sanitizeValue(campaign.active_since),
        this.sanitizeValue(campaign.mail_sent),
        this.sanitizeValue(campaign.sms_sent),
        this.sanitizeValue(campaign.execute_once_per_client),
        campaign.id
      );
      return campaign;
    } catch (error) {
      console.error('Error updating campaign:', error);
      return null;
    }
  }

  deleteCampaign(id: number): boolean {
    if (!this.db) return false;
    try {
      this.deleteCampaignClientExecutionsForCampaign(id);
      const stmt = this.db.prepare('DELETE FROM campaigns WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting campaign:', error);
      return false;
    }
  }

  deleteCoverTestExam(id: number) {
    if (!this.db) return false;

    this.db.prepare('DELETE FROM cover_test_exams WHERE id = ?').run(id);
    return true;
  }

  createSchirmerTestExam(exam: Omit<SchirmerTestExam, 'id'>): SchirmerTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO schirmer_test_exams (layout_instance_id, r_mm, l_mm, r_but, l_but)
        VALUES (?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        exam.layout_instance_id,
        exam.r_mm,
        exam.l_mm,
        exam.r_but,
        exam.l_but
      );
      
      if (result.changes > 0) {
        return {
          id: result.lastInsertRowid as number,
          ...exam
        };
      }
      return null;
    } catch (error) {
      console.error('Error creating schirmer test exam:', error);
      return null;
    }
  }

  getSchirmerTestExamById(id: number): SchirmerTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM schirmer_test_exams WHERE id = ?');
      return stmt.get(id) as SchirmerTestExam | null;
    } catch (error) {
      console.error('Error getting schirmer test exam by id:', error);
      return null;
    }
  }

  getSchirmerTestExamByLayoutInstanceId(layoutInstanceId: number): SchirmerTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM schirmer_test_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as SchirmerTestExam | null;
    } catch (error) {
      console.error('Error getting schirmer test exam by layout instance id:', error);
      return null;
    }
  }

  updateSchirmerTestExam(exam: SchirmerTestExam): SchirmerTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        UPDATE schirmer_test_exams 
        SET layout_instance_id = ?, r_mm = ?, l_mm = ?, r_but = ?, l_but = ?
        WHERE id = ?
      `);
      const result = stmt.run(
        exam.layout_instance_id,
        exam.r_mm,
        exam.l_mm,
        exam.r_but,
        exam.l_but,
        exam.id
      );
      
      if (result.changes > 0) {
        return exam;
      }
      return null;
    } catch (error) {
      console.error('Error updating schirmer test exam:', error);
      return null;
    }
  }

  // Anamnesis Exam methods
  createAnamnesisExam(data: Omit<AnamnesisExam, 'id'>): AnamnesisExam | null {
    if (!this.db) return null;

    const stmt = this.db.prepare(`
      INSERT INTO anamnesis_exams (
        layout_instance_id, medications, allergies, family_history, previous_treatments,
        lazy_eye, contact_lens_wear, started_wearing_since, stopped_wearing_since, additional_notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(
      data.layout_instance_id,
      data.medications,
      data.allergies,
      data.family_history,
      data.previous_treatments,
      data.lazy_eye ? 1 : 0,
      data.contact_lens_wear ? 1 : 0,
      data.started_wearing_since,
      data.stopped_wearing_since,
      data.additional_notes
    );
    return this.getAnamnesisExamById(info.lastInsertRowid as number);
  }

  getAnamnesisExamById(id: number): AnamnesisExam | null {
    if (!this.db) return null;

    return this.db.prepare('SELECT * FROM anamnesis_exams WHERE id = ?').get(id) as AnamnesisExam | null;
  }

  getAnamnesisExamByLayoutInstanceId(layout_instance_id: number): AnamnesisExam | null {
    if (!this.db) return null;

    const exam = this.db.prepare('SELECT * FROM anamnesis_exams WHERE layout_instance_id = ?').get(layout_instance_id) as AnamnesisExam | null;
    if (exam) {
      exam.contact_lens_wear = Boolean(exam.contact_lens_wear);
    }
    return exam;
  }

  updateAnamnesisExam(data: AnamnesisExam): AnamnesisExam | null {
    if (!this.db) return null;

    const stmt = this.db.prepare(`
      UPDATE anamnesis_exams SET
        medications = ?, allergies = ?, family_history = ?, previous_treatments = ?,
        lazy_eye = ?, contact_lens_wear = ?, started_wearing_since = ?, stopped_wearing_since = ?, additional_notes = ?
      WHERE id = ?
    `);
    stmt.run(
      data.medications,
      data.allergies,
      data.family_history,
      data.previous_treatments,
      data.lazy_eye ? 1 : 0,
      data.contact_lens_wear ? 1 : 0,
      data.started_wearing_since,
      data.stopped_wearing_since,
      data.additional_notes,
      data.id
    );
    return this.getAnamnesisExamById(data.id!);
  }

  deleteAnamnesisExam(id: number) {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare('DELETE FROM anamnesis_exams WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error(`Error deleting AnamnesisExam with ID ${id}:`, error);
      return false;
    }
  }

  createNotesExam(data: Omit<NotesExam, 'id'>): NotesExam | null {
    if (!this.db) return null;
    const { layout_instance_id, card_instance_id, title, note } = data;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO notes_exams (layout_instance_id, card_instance_id, title, note)
        VALUES (?, ?, ?, ?)
      `);
      const result = stmt.run(layout_instance_id, card_instance_id, title, note);
      if (result.changes > 0) {
        return { id: result.lastInsertRowid as number, ...data };
      }
      return null;
    } catch (error) {
      console.error('Error creating NotesExam:', error);
      return null;
    }
  }

  getNotesExamById(id: number): NotesExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM notes_exams WHERE id = ?');
      return stmt.get(id) as NotesExam | null;
    } catch (error) {
      console.error(`Error getting NotesExam by ID ${id}:`, error);
      return null;
    }
  }

  getNotesExamByLayoutInstanceId(layout_instance_id: number, card_instance_id?: string): NotesExam | null {
    if (!this.db) return null;
    try {
      if (card_instance_id) {
        const stmt = this.db.prepare('SELECT * FROM notes_exams WHERE layout_instance_id = ? AND card_instance_id = ?');
        return stmt.get(layout_instance_id, card_instance_id) as NotesExam | null;
      } else {
        const stmt = this.db.prepare('SELECT * FROM notes_exams WHERE layout_instance_id = ? AND card_instance_id IS NULL');
        return stmt.get(layout_instance_id) as NotesExam | null;
      }
    } catch (error) {
      console.error(`Error getting NotesExam by layout_instance_id ${layout_instance_id}:`, error);
      return null;
    }
  }

  getAllNotesExamsByLayoutInstanceId(layout_instance_id: number): NotesExam[] {
    if (!this.db) return [];
    try {
      const stmt = this.db.prepare('SELECT * FROM notes_exams WHERE layout_instance_id = ?');
      return stmt.all(layout_instance_id) as NotesExam[];
    } catch (error) {
      console.error(`Error getting all NotesExams by layout_instance_id ${layout_instance_id}:`, error);
      return [];
    }
  }

  updateNotesExam(data: NotesExam): NotesExam | null {
    if (!this.db) return null;
    const { id, layout_instance_id, card_instance_id, title, note } = data;
    if (!id) {
      console.error('NotesExam ID is required for update.');
      return null;
    }
    try {
      const stmt = this.db.prepare(`
        UPDATE notes_exams
        SET layout_instance_id = ?, card_instance_id = ?, title = ?, note = ?
        WHERE id = ?
      `);
      const result = stmt.run(layout_instance_id, card_instance_id, title, note, id);
      if (result.changes > 0) {
        return data;
      }
      return null;
    } catch (error) {
      console.error(`Error updating NotesExam with ID ${id}:`, error);
      return null;
    }
  }

  deleteNotesExam(id: number): boolean {
    if (!this.db) return false;
    try {
      const stmt = this.db.prepare('DELETE FROM notes_exams WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error(`Error deleting NotesExam with ID ${id}:`, error);
      return false;
    }
  }

  getCampaignClientExecution(campaignId: number, clientId: number): boolean {
    if (!this.db) return false;
    const stmt = this.db.prepare('SELECT 1 FROM campaign_client_executions WHERE campaign_id = ? AND client_id = ?');
    const row = stmt.get(campaignId, clientId);
    return !!row;
  }

  addCampaignClientExecution(campaignId: number, clientId: number): void {
    if (!this.db) return;
    const stmt = this.db.prepare('INSERT OR IGNORE INTO campaign_client_executions (campaign_id, client_id) VALUES (?, ?)');
    stmt.run(campaignId, clientId);
  }

  deleteCampaignClientExecutionsForCampaign(campaignId: number): void {
    if (!this.db) return;
    const stmt = this.db.prepare('DELETE FROM campaign_client_executions WHERE campaign_id = ?');
    stmt.run(campaignId);
  }

  // OldContactLenses CRUD
  createOldContactLenses(data: Omit<OldContactLenses, 'id'>): OldContactLenses | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO old_contact_lenses (
          layout_instance_id, r_lens_type, l_lens_type, r_model, l_model, r_supplier, l_supplier,
          l_bc, l_diam, l_sph, l_cyl, l_ax, l_va, l_j,
          r_bc, r_diam, r_sph, r_cyl, r_ax, r_va, r_j,
          comb_va, comb_j
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        data.layout_instance_id, data.r_lens_type, data.l_lens_type, data.r_model, data.l_model, data.r_supplier, data.l_supplier,
        data.l_bc, data.l_diam, data.l_sph, data.l_cyl, data.l_ax, data.l_va, data.l_j,
        data.r_bc, data.r_diam, data.r_sph, data.r_cyl, data.r_ax, data.r_va, data.r_j,
        data.comb_va, data.comb_j
      );
      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating OldContactLenses:', error);
      return null;
    }
  }

  getOldContactLensesById(id: number): OldContactLenses | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM old_contact_lenses WHERE id = ?');
      return stmt.get(id) as OldContactLenses | null;
    } catch (error) {
      console.error('Error getting OldContactLenses by id:', error);
      return null;
    }
  }

  getOldContactLensesByLayoutInstanceId(layoutInstanceId: number): OldContactLenses | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM old_contact_lenses WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as OldContactLenses | null;
    } catch (error) {
      console.error('Error getting OldContactLenses by layout instance id:', error);
      return null;
    }
  }

  updateOldContactLenses(data: OldContactLenses): OldContactLenses | null {
    if (!this.db || !data.id) return null;
    try {
      const stmt = this.db.prepare(`
        UPDATE old_contact_lenses SET
          layout_instance_id = ?, r_lens_type = ?, l_lens_type = ?, r_model = ?, l_model = ?, r_supplier = ?, l_supplier = ?,
          l_bc = ?, l_diam = ?, l_sph = ?, l_cyl = ?, l_ax = ?, l_va = ?, l_j = ?,
          r_bc = ?, r_diam = ?, r_sph = ?, r_cyl = ?, r_ax = ?, r_va = ?, r_j = ?,
          comb_va = ?, comb_j = ?
        WHERE id = ?
      `);
      stmt.run(
        data.layout_instance_id, data.r_lens_type, data.l_lens_type, data.r_model, data.l_model, data.r_supplier, data.l_supplier,
        data.l_bc, data.l_diam, data.l_sph, data.l_cyl, data.l_ax, data.l_va, data.l_j,
        data.r_bc, data.r_diam, data.r_sph, data.r_cyl, data.r_ax, data.r_va, data.r_j,
        data.comb_va, data.comb_j, data.id
      );
      return data;
    } catch (error) {
      console.error('Error updating OldContactLenses:', error);
      return null;
    }
  }

  // OverRefraction CRUD
  createOverRefraction(data: Omit<OverRefraction, 'id'>): OverRefraction | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO over_refraction (
          layout_instance_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax,
          r_va, l_va, r_j, l_j, comb_va, comb_j, l_add, r_add,
          l_florescent, r_florescent, l_bio_m, r_bio_m
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.r_sph),
        this.sanitizeValue(data.l_sph),
        this.sanitizeValue(data.r_cyl),
        this.sanitizeValue(data.l_cyl),
        this.sanitizeValue(data.r_ax),
        this.sanitizeValue(data.l_ax),
        this.sanitizeValue(data.r_va),
        this.sanitizeValue(data.l_va),
        this.sanitizeValue(data.r_j),
        this.sanitizeValue(data.l_j),
        this.sanitizeValue(data.comb_va),
        this.sanitizeValue(data.comb_j),
        this.sanitizeValue(data.l_add),
        this.sanitizeValue(data.r_add),
        this.sanitizeValue(data.l_florescent),
        this.sanitizeValue(data.r_florescent),
        this.sanitizeValue(data.l_bio_m),
        this.sanitizeValue(data.r_bio_m)
      );

      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating over refraction:', error);
      return null;
    }
  }

  getOverRefraction(id: number): OverRefraction | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'SELECT * FROM over_refraction WHERE id = ?'
      );
      return stmt.get(id) as OverRefraction;
    } catch (error) {
      console.error('Error getting over refraction:', error);
      return null;
    }
  }

  getOverRefractionByLayoutInstanceId(layout_instance_id: number): OverRefraction | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(
        'SELECT * FROM over_refraction WHERE layout_instance_id = ?'
      );
      return stmt.get(layout_instance_id) as OverRefraction;
    } catch (error) {
      console.error('Error getting over refraction by layout instance id:', error);
      return null;
    }
  }

  updateOverRefraction(data: OverRefraction): OverRefraction | null {
    if (!this.db || !data.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE over_refraction SET
          layout_instance_id = ?,
          r_sph = ?,
          l_sph = ?,
          r_cyl = ?,
          l_cyl = ?,
          r_ax = ?,
          l_ax = ?,
          r_va = ?,
          l_va = ?,
          r_j = ?,
          l_j = ?,
          comb_va = ?,
          comb_j = ?,
          l_add = ?,
          r_add = ?,
          l_florescent = ?,
          r_florescent = ?,
          l_bio_m = ?,
          r_bio_m = ?
        WHERE id = ?
      `);

      stmt.run(
        data.layout_instance_id,
        this.sanitizeValue(data.r_sph),
        this.sanitizeValue(data.l_sph),
        this.sanitizeValue(data.r_cyl),
        this.sanitizeValue(data.l_cyl),
        this.sanitizeValue(data.r_ax),
        this.sanitizeValue(data.l_ax),
        this.sanitizeValue(data.r_va),
        this.sanitizeValue(data.l_va),
        this.sanitizeValue(data.r_j),
        this.sanitizeValue(data.l_j),
        this.sanitizeValue(data.comb_va),
        this.sanitizeValue(data.comb_j),
        this.sanitizeValue(data.l_add),
        this.sanitizeValue(data.r_add),
        this.sanitizeValue(data.l_florescent),
        this.sanitizeValue(data.r_florescent),
        this.sanitizeValue(data.l_bio_m),
        this.sanitizeValue(data.r_bio_m),
        data.id
      );

      return data;
    } catch (error) {
      console.error('Error updating over refraction:', error);
      return null;
    }
  }

  deleteOverRefraction(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM over_refraction WHERE id = ?');
      stmt.run(id);
      return true;
    } catch (error) {
      console.error('Error deleting over refraction:', error);
      return false;
    }
  }

  createSensationVisionStabilityExam(data: Omit<SensationVisionStabilityExam, 'id'>): SensationVisionStabilityExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO sensation_vision_stability_exams (
          layout_instance_id, r_sensation, l_sensation, r_vision, l_vision, r_stability, l_stability, r_movement, l_movement, r_recommendations, l_recommendations
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const result = stmt.run(
        data.layout_instance_id,
        data.r_sensation,
        data.l_sensation,
        data.r_vision,
        data.l_vision,
        data.r_stability,
        data.l_stability,
        data.r_movement,
        data.l_movement,
        data.r_recommendations,
        data.l_recommendations
      );
      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating SensationVisionStabilityExam:', error);
      return null;
    }
  }

  getSensationVisionStabilityExamByLayoutInstanceId(layoutInstanceId: number): SensationVisionStabilityExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM sensation_vision_stability_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as SensationVisionStabilityExam | null;
    } catch (error) {
      console.error('Error getting SensationVisionStabilityExam by layoutInstanceId:', error);
      return null;
    }
  }

  updateSensationVisionStabilityExam(data: SensationVisionStabilityExam): SensationVisionStabilityExam | null {
    if (!this.db || !data.id) return null;
    try {
      const stmt = this.db.prepare(`
        UPDATE sensation_vision_stability_exams SET
          layout_instance_id = ?,
          r_sensation = ?,
          l_sensation = ?,
          r_vision = ?,
          l_vision = ?,
          r_stability = ?,
          l_stability = ?,
          r_movement = ?,
          l_movement = ?,
          r_recommendations = ?,
          l_recommendations = ?
        WHERE id = ?
      `);
      stmt.run(
        data.layout_instance_id,
        data.r_sensation,
        data.l_sensation,
        data.r_vision,
        data.l_vision,
        data.r_stability,
        data.l_stability,
        data.r_movement,
        data.l_movement,
        data.r_recommendations,
        data.l_recommendations,
        data.id
      );
      return data;
    } catch (error) {
      console.error('Error updating SensationVisionStabilityExam:', error);
      return null;
    }
  }

  createDiopterAdjustmentPanel(data: Omit<DiopterAdjustmentPanel, 'id'>): DiopterAdjustmentPanel | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO diopter_adjustment_panel (layout_instance_id, right_diopter, left_diopter)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(
        data.layout_instance_id,
        data.right_diopter,
        data.left_diopter
      );
      return { ...data, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating DiopterAdjustmentPanel:', error);
      return null;
    }
  }

  getDiopterAdjustmentPanelByLayoutInstanceId(layoutInstanceId: number): DiopterAdjustmentPanel | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM diopter_adjustment_panel WHERE layout_instance_id = ?
      `);
      return stmt.get(layoutInstanceId) as DiopterAdjustmentPanel | null;
    } catch (error) {
      console.error('Error getting DiopterAdjustmentPanel:', error);
      return null;
    }
  }

  updateDiopterAdjustmentPanel(data: DiopterAdjustmentPanel): DiopterAdjustmentPanel | null {
    if (!this.db || !data.id) return null;
    try {
      const stmt = this.db.prepare(`
        UPDATE diopter_adjustment_panel SET right_diopter = ?, left_diopter = ? WHERE id = ?
      `);
      stmt.run(
        data.right_diopter,
        data.left_diopter,
        data.id
      );
      return data;
    } catch (error) {
      console.error('Error updating DiopterAdjustmentPanel:', error);
      return null;
    }
  }

  createFusionRangeExam(data: Omit<FusionRangeExam, 'id'>): FusionRangeExam | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`INSERT INTO fusion_range_exams (layout_instance_id, fv_base_in, fv_base_in_recovery, fv_base_out, fv_base_out_recovery, nv_base_in, nv_base_in_recovery, nv_base_out, nv_base_out_recovery) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(
      data.layout_instance_id,
      data.fv_base_in,
      data.fv_base_in_recovery,
      data.fv_base_out,
      data.fv_base_out_recovery,
      data.nv_base_in,
      data.nv_base_in_recovery,
      data.nv_base_out,
      data.nv_base_out_recovery
    );
    return { id: result.lastInsertRowid as number, ...data };
  }

  getFusionRangeExamByLayoutInstanceId(layoutInstanceId: number): FusionRangeExam | null {
    if (!this.db) return null;
    const row = this.db.prepare(`SELECT * FROM fusion_range_exams WHERE layout_instance_id = ?`).get(layoutInstanceId);
    return row || null;
  }

  updateFusionRangeExam(data: FusionRangeExam): FusionRangeExam | null {
    if (!this.db || !data.id) return null;
    this.db.prepare(`UPDATE fusion_range_exams SET fv_base_in = ?, fv_base_in_recovery = ?, fv_base_out = ?, fv_base_out_recovery = ?, nv_base_in = ?, nv_base_in_recovery = ?, nv_base_out = ?, nv_base_out_recovery = ? WHERE id = ?`).run(
      data.fv_base_in,
      data.fv_base_in_recovery,
      data.fv_base_out,
      data.fv_base_out_recovery,
      data.nv_base_in,
      data.nv_base_in_recovery,
      data.nv_base_out,
      data.nv_base_out_recovery,
      data.id
    );
    return data;
  }

  createMaddoxRodExam(data: Omit<MaddoxRodExam, 'id'>): MaddoxRodExam | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`INSERT INTO maddox_rod_exams (layout_instance_id, c_r_h, c_r_v, c_l_h, c_l_v, wc_r_h, wc_r_v, wc_l_h, wc_l_v) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(
      data.layout_instance_id,
      data.c_r_h,
      data.c_r_v,
      data.c_l_h,
      data.c_l_v,
      data.wc_r_h,
      data.wc_r_v,
      data.wc_l_h,
      data.wc_l_v
    );
    return { id: result.lastInsertRowid as number, ...data };
  }

  getMaddoxRodExamByLayoutInstanceId(layoutInstanceId: number): MaddoxRodExam | null {
    if (!this.db) return null;
    const row = this.db.prepare(`SELECT * FROM maddox_rod_exams WHERE layout_instance_id = ?`).get(layoutInstanceId);
    return row || null;
  }

  updateMaddoxRodExam(data: MaddoxRodExam): MaddoxRodExam | null {
    if (!this.db || !data.id) return null;
    this.db.prepare(`UPDATE maddox_rod_exams SET c_r_h = ?, c_r_v = ?, c_l_h = ?, c_l_v = ?, wc_r_h = ?, wc_r_v = ?, wc_l_h = ?, wc_l_v = ? WHERE id = ?`).run(
      data.c_r_h,
      data.c_r_v,
      data.c_l_h,
      data.c_l_v,
      data.wc_r_h,
      data.wc_r_v,
      data.wc_l_h,
      data.wc_l_v,
      data.id
    );
    return data;
  }

  createStereoTestExam(data: Omit<StereoTestExam, 'id'>): StereoTestExam | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`INSERT INTO stereo_test_exams (layout_instance_id, fly_result, circle_score, circle_max) VALUES (?, ?, ?, ?)`);
    const result = stmt.run(
      data.layout_instance_id,
      data.fly_result ? 1 : 0,
      data.circle_score,
      data.circle_max
    );
    return { id: result.lastInsertRowid as number, ...data };
  }

  getStereoTestExamByLayoutInstanceId(layoutInstanceId: number): StereoTestExam | null {
    if (!this.db) return null;
    const row = this.db.prepare(`SELECT * FROM stereo_test_exams WHERE layout_instance_id = ?`).get(layoutInstanceId);
    if (row) {
      return {
        ...row,
        fly_result: row.fly_result === 1
      };
    }
    return null;
  }

  updateStereoTestExam(data: StereoTestExam): StereoTestExam | null {
    if (!this.db || !data.id) return null;
    this.db.prepare(`UPDATE stereo_test_exams SET fly_result = ?, circle_score = ?, circle_max = ? WHERE id = ?`).run(
      data.fly_result ? 1 : 0,
      data.circle_score,
      data.circle_max,
      data.id
    );
    return data;
  }

  createRGExam(data: Omit<RGExam, 'id'>): RGExam | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`INSERT INTO rg_exams (layout_instance_id, rg_status, suppressed_eye) VALUES (?, ?, ?)`);
    const result = stmt.run(
      data.layout_instance_id,
      data.rg_status,
      data.suppressed_eye
    );
    return { id: result.lastInsertRowid as number, ...data };
  }

  getRGExamByLayoutInstanceId(layoutInstanceId: number): RGExam | null {
    if (!this.db) return null;
    const row = this.db.prepare(`SELECT * FROM rg_exams WHERE layout_instance_id = ?`).get(layoutInstanceId);
    return row || null;
  }

  updateRGExam(data: RGExam): RGExam | null {
    if (!this.db || !data.id) return null;
    this.db.prepare(`UPDATE rg_exams SET rg_status = ?, suppressed_eye = ? WHERE id = ?`).run(
      data.rg_status,
      data.suppressed_eye,
      data.id
    );
    return data;
  }

  createOcularMotorAssessmentExam(data: Omit<OcularMotorAssessmentExam, 'id'>): OcularMotorAssessmentExam | null {
    if (!this.db) return null;
    const stmt = this.db.prepare(`INSERT INTO ocular_motor_assessment_exams (layout_instance_id, ocular_motility, acc_od, acc_os, npc_break, npc_recovery) VALUES (?, ?, ?, ?, ?, ?)`);
    const result = stmt.run(
      data.layout_instance_id,
      data.ocular_motility,
      data.acc_od,
      data.acc_os,
      data.npc_break,
      data.npc_recovery
    );
    return { id: result.lastInsertRowid as number, ...data };
  }

  getOcularMotorAssessmentExamByLayoutInstanceId(layoutInstanceId: number): OcularMotorAssessmentExam | null {
    if (!this.db) return null;
    const row = this.db.prepare(`SELECT * FROM ocular_motor_assessment_exams WHERE layout_instance_id = ?`).get(layoutInstanceId);
    return row || null;
  }

  updateOcularMotorAssessmentExam(data: OcularMotorAssessmentExam): OcularMotorAssessmentExam | null {
    if (!this.db || !data.id) return null;
    this.db.prepare(`UPDATE ocular_motor_assessment_exams SET ocular_motility = ?, acc_od = ?, acc_os = ?, npc_break = ?, npc_recovery = ? WHERE id = ?`).run(
      data.ocular_motility,
      data.acc_od,
      data.acc_os,
      data.npc_break,
      data.npc_recovery,
      data.id
    );
    return data;
  }

  // Settings CRUD operations for multi-clinic support
  createSettings(settings: Omit<Settings, 'id'>): Settings | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO settings (
          clinic_id, clinic_name, clinic_position, clinic_email, clinic_phone,
          clinic_address, clinic_city, clinic_postal_code, clinic_directions, clinic_website,
          manager_name, license_number, clinic_logo_path,
          primary_theme_color, secondary_theme_color,
          work_start_time, work_end_time, appointment_duration,
          send_email_before_appointment, email_days_before, email_time,
          working_days, break_start_time, break_end_time, max_appointments_per_day,
          email_provider, email_smtp_host, email_smtp_port, email_smtp_secure,
          email_username, email_password, email_from_name
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        this.sanitizeValue(settings.clinic_id),
        this.sanitizeValue(settings.clinic_name),
        this.sanitizeValue(settings.clinic_position),
        this.sanitizeValue(settings.clinic_email),
        this.sanitizeValue(settings.clinic_phone),
        this.sanitizeValue(settings.clinic_address),
        this.sanitizeValue(settings.clinic_city),
        this.sanitizeValue(settings.clinic_postal_code),
        this.sanitizeValue(settings.clinic_directions),
        this.sanitizeValue(settings.clinic_website),
        this.sanitizeValue(settings.manager_name),
        this.sanitizeValue(settings.license_number),
        this.sanitizeValue(settings.clinic_logo_path),
        this.sanitizeValue(settings.primary_theme_color),
        this.sanitizeValue(settings.secondary_theme_color),
        this.sanitizeValue(settings.work_start_time),
        this.sanitizeValue(settings.work_end_time),
        this.sanitizeValue(settings.appointment_duration),
        this.sanitizeValue(settings.send_email_before_appointment),
        this.sanitizeValue(settings.email_days_before),
        this.sanitizeValue(settings.email_time),
        this.sanitizeValue(settings.working_days),
        this.sanitizeValue(settings.break_start_time),
        this.sanitizeValue(settings.break_end_time),
        this.sanitizeValue(settings.max_appointments_per_day),
        this.sanitizeValue(settings.email_provider),
        this.sanitizeValue(settings.email_smtp_host),
        this.sanitizeValue(settings.email_smtp_port),
        this.sanitizeValue(settings.email_smtp_secure),
        this.sanitizeValue(settings.email_username),
        this.sanitizeValue(settings.email_password),
        this.sanitizeValue(settings.email_from_name)
      );

      return { ...settings, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating settings:', error);
      return null;
    }
  }

  getSettingsByClinicId(clinicId: number): Settings | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM settings WHERE clinic_id = ?');
      return stmt.get(clinicId) as Settings | null;
    } catch (error) {
      console.error('Error getting settings by clinic ID:', error);
      return null;
    }
  }

  getAllSettingsByCompanyId(companyId: number): Settings[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare(`
        SELECT s.* FROM settings s
        JOIN clinics c ON s.clinic_id = c.id
        WHERE c.company_id = ?
        ORDER BY c.name
      `);
      return stmt.all(companyId) as Settings[];
    } catch (error) {
      console.error('Error getting all settings by company ID:', error);
      return [];
    }
  }
}

export const dbService = new DatabaseService();
export type DBServiceType = typeof dbService;