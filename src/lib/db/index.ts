import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import {
  createTables,
  Client,
  OpticalExam,
  OldRefractionExam,
  OldRefractionExtensionExam,
  ObjectiveExam,
  SubjectiveExam,
  AdditionExam,
  FinalSubjectiveExam,
  RetinoscopExam,
  RetinoscopDilationExam,
  Order,
  OrderEye,
  OrderLens,
  Frame,
  OrderDetails,
  MedicalLog,
  ContactLens,
  ContactEye,
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
  CoverTestExam,
  WorkShift
} from './schema';

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
      const orderDetailsInfo = this.db.prepare("PRAGMA table_info(order_details)").all() as any[];
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

      // Check if appointments table has redundant client fields that should be removed
      const appointmentsInfo = this.db.prepare("PRAGMA table_info(appointments)").all() as any[];
      const hasFirstNameColumn = appointmentsInfo.some(col => col.name === 'first_name');
      const hasLastNameColumn = appointmentsInfo.some(col => col.name === 'last_name');
      const hasPhoneMobileColumn = appointmentsInfo.some(col => col.name === 'phone_mobile');
      const hasEmailColumn = appointmentsInfo.some(col => col.name === 'email');

      // If redundant client fields exist, migrate to new structure
      if (hasFirstNameColumn || hasLastNameColumn || hasPhoneMobileColumn || hasEmailColumn) {
        console.log('Migrating appointments table to remove redundant client fields...');

        // Create backup of existing data
        const existingAppointments = this.db.prepare('SELECT * FROM appointments').all() as any[];

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
      const clientCount = this.db.prepare('SELECT COUNT(*) as count FROM clients').get() as { count: number };

      if (clientCount.count === 0) {
        console.log('Seeding database with initial data...');

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
              notes: "בדיקה ראשונית"
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

        console.log('Initial data seeded successfully');
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

  private sanitizeValue(value: any): any {
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
          first_name, last_name, gender, national_id, date_of_birth,
          address_city, address_street, address_number, postal_code,
          phone_home, phone_work, phone_mobile, fax, email,
          service_center, file_creation_date, membership_end, service_end,
          price_list, discount_percent, blocked_checks, blocked_credit,
          sorting_group, referring_party, file_location, occupation, status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
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

  getAllClients(): Client[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM clients ORDER BY first_name, last_name');
      return stmt.all() as Client[];
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
        sorting_group = ?, referring_party = ?, file_location = ?, occupation = ?, status = ?, notes = ?
        WHERE id = ?
      `);

      stmt.run(
        this.sanitizeValue(client.first_name), this.sanitizeValue(client.last_name), this.sanitizeValue(client.gender), this.sanitizeValue(client.national_id), this.sanitizeValue(client.date_of_birth),
        this.sanitizeValue(client.address_city), this.sanitizeValue(client.address_street), this.sanitizeValue(client.address_number), this.sanitizeValue(client.postal_code),
        this.sanitizeValue(client.phone_home), this.sanitizeValue(client.phone_work), this.sanitizeValue(client.phone_mobile), this.sanitizeValue(client.fax), this.sanitizeValue(client.email),
        this.sanitizeValue(client.service_center), this.sanitizeValue(client.file_creation_date), this.sanitizeValue(client.membership_end), this.sanitizeValue(client.service_end),
        this.sanitizeValue(client.price_list), this.sanitizeValue(client.discount_percent), this.sanitizeValue(client.blocked_checks), this.sanitizeValue(client.blocked_credit),
        this.sanitizeValue(client.sorting_group), this.sanitizeValue(client.referring_party), this.sanitizeValue(client.file_location), this.sanitizeValue(client.occupation), this.sanitizeValue(client.status), this.sanitizeValue(client.notes),
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

  // Optical Exam CRUD operations
  createExam(exam: Omit<OpticalExam, 'id'>): OpticalExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO optical_exams (
          client_id, clinic, user_id, exam_date, test_name, dominant_eye, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.client_id, exam.clinic, this.sanitizeValue(exam.user_id), exam.exam_date, exam.test_name,
        exam.dominant_eye, exam.notes
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

  getExamsByClientId(clientId: number): OpticalExam[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM optical_exams WHERE client_id = ? ORDER BY exam_date DESC');
      return stmt.all(clientId) as OpticalExam[];
    } catch (error) {
      console.error('Error getting exams by client:', error);
      return [];
    }
  }

  getAllExams(): OpticalExam[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM optical_exams ORDER BY exam_date DESC');
      return stmt.all() as OpticalExam[];
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
        dominant_eye = ?, notes = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.client_id, exam.clinic, this.sanitizeValue(exam.user_id), exam.exam_date, exam.test_name,
        exam.dominant_eye, exam.notes, exam.id
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
          layout_instance_id, r_sph, l_sph, r_cyl, l_cyl, r_ax, l_ax,
          r_pr_h, l_pr_h, r_base_h, l_base_h, r_pr_v, l_pr_v, r_base_v, l_base_v,
          r_va, l_va, r_j, l_j, r_pd_far, l_pd_far, r_pd_close, l_pd_close,
          comb_pd_far, comb_pd_close, comb_va
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
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
        layout_instance_id = ?, r_sph = ?, l_sph = ?, r_cyl = ?, l_cyl = ?, r_ax = ?, l_ax = ?,
        r_pr_h = ?, l_pr_h = ?, r_base_h = ?, l_base_h = ?, r_pr_v = ?, l_pr_v = ?, r_base_v = ?, l_base_v = ?,
        r_va = ?, l_va = ?, r_j = ?, l_j = ?, r_pd_far = ?, l_pd_far = ?, r_pd_close = ?, l_pd_close = ?,
        comb_pd_far = ?, comb_pd_close = ?, comb_va = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.layout_instance_id, exam.r_sph, exam.l_sph, exam.r_cyl, exam.l_cyl, exam.r_ax, exam.l_ax,
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

  getAllOrders(): Order[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM orders ORDER BY order_date DESC');
      return stmt.all() as Order[];
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

  // Order Lens CRUD operations
  createOrderLens(orderLens: Omit<OrderLens, 'id'>): OrderLens | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO order_lens (order_id, right_model, left_model, color, coating, material, supplier)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        orderLens.order_id, orderLens.right_model, orderLens.left_model,
        orderLens.color, orderLens.coating, orderLens.material, orderLens.supplier
      );

      return { ...orderLens, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating order lens:', error);
      return null;
    }
  }

  getOrderLensByOrderId(orderId: number): OrderLens | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM order_lens WHERE order_id = ?');
      return stmt.get(orderId) as OrderLens | null;
    } catch (error) {
      console.error('Error getting order lens:', error);
      return null;
    }
  }

  updateOrderLens(orderLens: OrderLens): OrderLens | null {
    if (!this.db || !orderLens.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE order_lens SET order_id = ?, right_model = ?, left_model = ?, color = ?, coating = ?, material = ?, supplier = ?
        WHERE id = ?
      `);

      stmt.run(
        orderLens.order_id, orderLens.right_model, orderLens.left_model,
        orderLens.color, orderLens.coating, orderLens.material, orderLens.supplier,
        orderLens.id
      );

      return orderLens;
    } catch (error) {
      console.error('Error updating order lens:', error);
      return null;
    }
  }

  // Frame CRUD operations
  createFrame(frame: Omit<Frame, 'id'>): Frame | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO frames (order_id, color, supplier, model, manufacturer, supplied_by, bridge, width, height, length)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        frame.order_id, frame.color, frame.supplier, frame.model, frame.manufacturer,
        frame.supplied_by, frame.bridge, frame.width, frame.height, frame.length
      );

      return { ...frame, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating frame:', error);
      return null;
    }
  }

  getFrameByOrderId(orderId: number): Frame | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM frames WHERE order_id = ?');
      return stmt.get(orderId) as Frame | null;
    } catch (error) {
      console.error('Error getting frame:', error);
      return null;
    }
  }

  updateFrame(frame: Frame): Frame | null {
    if (!this.db || !frame.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE frames SET order_id = ?, color = ?, supplier = ?, model = ?, manufacturer = ?, supplied_by = ?, bridge = ?, width = ?, height = ?, length = ?
        WHERE id = ?
      `);

      stmt.run(
        frame.order_id, frame.color, frame.supplier, frame.model, frame.manufacturer,
        frame.supplied_by, frame.bridge, frame.width, frame.height, frame.length,
        frame.id
      );

      return frame;
    } catch (error) {
      console.error('Error updating frame:', error);
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

  // Contact Lens CRUD operations
  createContactLens(contactLens: Omit<ContactLens, 'id'>): ContactLens | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO contact_lens (
          client_id, exam_date, type, user_id, comb_va, pupil_diameter, corneal_diameter, eyelid_aperture, notes, notes_for_supplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        contactLens.client_id,
        this.sanitizeValue(contactLens.exam_date),
        this.sanitizeValue(contactLens.type),
        this.sanitizeValue(contactLens.user_id),
        this.sanitizeValue(contactLens.comb_va),
        this.sanitizeValue(contactLens.pupil_diameter),
        this.sanitizeValue(contactLens.corneal_diameter),
        this.sanitizeValue(contactLens.eyelid_aperture),
        this.sanitizeValue(contactLens.notes),
        this.sanitizeValue(contactLens.notes_for_supplier)
      );

      return { ...contactLens, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating contact lens:', error);
      return null;
    }
  }

  getContactLensById(id: number): ContactLens | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens WHERE id = ?');
      return stmt.get(id) as ContactLens | null;
    } catch (error) {
      console.error('Error getting contact lens by ID:', error);
      return null;
    }
  }

  getContactLensesByClientId(clientId: number): ContactLens[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens WHERE client_id = ? ORDER BY exam_date DESC');
      return stmt.all(clientId) as ContactLens[];
    } catch (error) {
      console.error('Error getting contact lenses by client:', error);
      return [];
    }
  }

  getAllContactLenses(): ContactLens[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens ORDER BY exam_date DESC');
      return stmt.all() as ContactLens[];
    } catch (error) {
      console.error('Error getting all contact lenses:', error);
      return [];
    }
  }

  updateContactLens(contactLens: ContactLens): ContactLens | null {
    if (!this.db || !contactLens.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE contact_lens SET 
        client_id = ?, exam_date = ?, type = ?, user_id = ?, comb_va = ?, pupil_diameter = ?, corneal_diameter = ?,
        eyelid_aperture = ?, notes = ?, notes_for_supplier = ?
        WHERE id = ?
      `);

      stmt.run(
        contactLens.client_id,
        this.sanitizeValue(contactLens.exam_date),
        this.sanitizeValue(contactLens.type),
        this.sanitizeValue(contactLens.user_id),
        this.sanitizeValue(contactLens.comb_va),
        this.sanitizeValue(contactLens.pupil_diameter),
        this.sanitizeValue(contactLens.corneal_diameter),
        this.sanitizeValue(contactLens.eyelid_aperture),
        this.sanitizeValue(contactLens.notes),
        this.sanitizeValue(contactLens.notes_for_supplier),
        contactLens.id
      );

      return contactLens;
    } catch (error) {
      console.error('Error updating contact lens:', error);
      return null;
    }
  }

  deleteContactLens(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM contact_lens WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting contact lens:', error);
      return false;
    }
  }

  // Contact Eye CRUD operations
  createContactEye(contactEye: Omit<ContactEye, 'id'>): ContactEye | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO contact_eye (
          contact_lens_id, eye, schirmer_test, schirmer_but, k_h, k_v, k_avg, k_cyl, k_ax, k_ecc,
          lens_type, model, supplier, material, color, quantity, order_quantity, dx, bc, bc_2, oz, diam,
          sph, cyl, ax, read_ad, va, j
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        contactEye.contact_lens_id,
        this.sanitizeValue(contactEye.eye),
        this.sanitizeValue(contactEye.schirmer_test),
        this.sanitizeValue(contactEye.schirmer_but),
        this.sanitizeValue(contactEye.k_h),
        this.sanitizeValue(contactEye.k_v),
        this.sanitizeValue(contactEye.k_avg),
        this.sanitizeValue(contactEye.k_cyl),
        this.sanitizeValue(contactEye.k_ax),
        this.sanitizeValue(contactEye.k_ecc),
        this.sanitizeValue(contactEye.lens_type),
        this.sanitizeValue(contactEye.model),
        this.sanitizeValue(contactEye.supplier),
        this.sanitizeValue(contactEye.material),
        this.sanitizeValue(contactEye.color),
        this.sanitizeValue(contactEye.quantity),
        this.sanitizeValue(contactEye.order_quantity),
        this.sanitizeValue(contactEye.dx),
        this.sanitizeValue(contactEye.bc),
        this.sanitizeValue(contactEye.bc_2),
        this.sanitizeValue(contactEye.oz),
        this.sanitizeValue(contactEye.diam),
        this.sanitizeValue(contactEye.sph),
        this.sanitizeValue(contactEye.cyl),
        this.sanitizeValue(contactEye.ax),
        this.sanitizeValue(contactEye.read_ad),
        this.sanitizeValue(contactEye.va),
        this.sanitizeValue(contactEye.j)
      );

      return { ...contactEye, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating contact eye:', error);
      return null;
    }
  }

  getContactEyesByContactLensId(contactLensId: number): ContactEye[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_eye WHERE contact_lens_id = ?');
      return stmt.all(contactLensId) as ContactEye[];
    } catch (error) {
      console.error('Error getting contact eyes by contact lens ID:', error);
      return [];
    }
  }

  updateContactEye(contactEye: ContactEye): ContactEye | null {
    if (!this.db || !contactEye.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE contact_eye SET 
          contact_lens_id = ?, eye = ?, schirmer_test = ?, schirmer_but = ?, k_h = ?, k_v = ?, k_avg = ?,
          k_cyl = ?, k_ax = ?, k_ecc = ?, lens_type = ?, model = ?, supplier = ?, material = ?, color = ?,
          quantity = ?, order_quantity = ?, dx = ?, bc = ?, bc_2 = ?, oz = ?, diam = ?, sph = ?, cyl = ?, ax = ?,
          read_ad = ?, va = ?, j = ?
        WHERE id = ?
      `);

      stmt.run(
        contactEye.contact_lens_id,
        this.sanitizeValue(contactEye.eye),
        this.sanitizeValue(contactEye.schirmer_test),
        this.sanitizeValue(contactEye.schirmer_but),
        this.sanitizeValue(contactEye.k_h),
        this.sanitizeValue(contactEye.k_v),
        this.sanitizeValue(contactEye.k_avg),
        this.sanitizeValue(contactEye.k_cyl),
        this.sanitizeValue(contactEye.k_ax),
        this.sanitizeValue(contactEye.k_ecc),
        this.sanitizeValue(contactEye.lens_type),
        this.sanitizeValue(contactEye.model),
        this.sanitizeValue(contactEye.supplier),
        this.sanitizeValue(contactEye.material),
        this.sanitizeValue(contactEye.color),
        this.sanitizeValue(contactEye.quantity),
        this.sanitizeValue(contactEye.order_quantity),
        this.sanitizeValue(contactEye.dx),
        this.sanitizeValue(contactEye.bc),
        this.sanitizeValue(contactEye.bc_2),
        this.sanitizeValue(contactEye.oz),
        this.sanitizeValue(contactEye.diam),
        this.sanitizeValue(contactEye.sph),
        this.sanitizeValue(contactEye.cyl),
        this.sanitizeValue(contactEye.ax),
        this.sanitizeValue(contactEye.read_ad),
        this.sanitizeValue(contactEye.va),
        this.sanitizeValue(contactEye.j),
        contactEye.id
      );

      return contactEye;
    } catch (error) {
      console.error('Error updating contact eye:', error);
      return null;
    }
  }

  // Contact Lens Order CRUD operations
  createContactLensOrder(contactLensOrder: Omit<ContactLensOrder, 'id'>): ContactLensOrder | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO contact_lens_order (
          contact_lens_id, branch, supply_in_branch, order_status, advisor, deliverer, delivery_date,
          priority, guaranteed_date, approval_date, cleaning_solution, disinfection_solution, rinsing_solution
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        contactLensOrder.contact_lens_id,
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

  getContactLensOrderByContactLensId(contactLensId: number): ContactLensOrder | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM contact_lens_order WHERE contact_lens_id = ?');
      return stmt.get(contactLensId) as ContactLensOrder | null;
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
          contact_lens_id = ?, branch = ?, supply_in_branch = ?, order_status = ?, advisor = ?,
          deliverer = ?, delivery_date = ?, priority = ?, guaranteed_date = ?, approval_date = ?,
          cleaning_solution = ?, disinfection_solution = ?, rinsing_solution = ?
        WHERE id = ?
      `);

      stmt.run(
        contactLensOrder.contact_lens_id,
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
          client_id, user_id, referral_notes, prescription_notes, comb_va, comb_high, comb_pd,
          date, type, branch, recipient
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        referral.client_id,
        this.sanitizeValue(referral.user_id),
        this.sanitizeValue(referral.referral_notes),
        this.sanitizeValue(referral.prescription_notes),
        this.sanitizeValue(referral.comb_va),
        this.sanitizeValue(referral.comb_high),
        this.sanitizeValue(referral.comb_pd),
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

  getAllReferrals(): Referral[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM referrals ORDER BY date DESC');
      return stmt.all() as Referral[];
    } catch (error) {
      console.error('Error getting all referrals:', error);
      return [];
    }
  }

  updateReferral(referral: Referral): Referral | null {
    if (!this.db || !referral.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE referrals SET 
        client_id = ?, user_id = ?, referral_notes = ?, prescription_notes = ?, comb_va = ?, comb_high = ?, comb_pd = ?,
        date = ?, type = ?, branch = ?, recipient = ?
        WHERE id = ?
      `);

      stmt.run(
        referral.client_id,
        this.sanitizeValue(referral.user_id),
        this.sanitizeValue(referral.referral_notes),
        this.sanitizeValue(referral.prescription_notes),
        this.sanitizeValue(referral.comb_va),
        this.sanitizeValue(referral.comb_high),
        this.sanitizeValue(referral.comb_pd),
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
        INSERT INTO appointments (client_id, user_id, date, time, exam_name, note)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        appointment.client_id,
        this.sanitizeValue(appointment.user_id),
        this.sanitizeValue(appointment.date),
        this.sanitizeValue(appointment.time),
        this.sanitizeValue(appointment.exam_name),
        this.sanitizeValue(appointment.note)
      );

      return { ...appointment, id: result.lastInsertRowid as number };
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

  getAllAppointments(): Appointment[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM appointments ORDER BY date DESC');
      return stmt.all() as Appointment[];
    } catch (error) {
      console.error('Error getting all appointments:', error);
      return [];
    }
  }

  updateAppointment(appointment: Appointment): Appointment | null {
    if (!this.db || !appointment.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE appointments SET
          client_id = ?, user_id = ?, date = ?, time = ?, exam_name = ?, note = ?
        WHERE id = ?
      `);

      stmt.run(
        appointment.client_id,
        this.sanitizeValue(appointment.user_id),
        this.sanitizeValue(appointment.date),
        this.sanitizeValue(appointment.time),
        this.sanitizeValue(appointment.exam_name),
        this.sanitizeValue(appointment.note),
        appointment.id
      );

      return appointment;
    } catch (error) {
      console.error('Error updating appointment:', error);
      return null;
    }
  }

  deleteAppointment(id: number): boolean {
    if (!this.db) return false;

    try {
      const stmt = this.db.prepare('DELETE FROM appointments WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting appointment:', error);
      return false;
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
        INSERT INTO users (username, email, phone, password, role, is_active, profile_picture, primary_theme_color, secondary_theme_color, theme_preference)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
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

  getUserByUsername(username: string): User | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
      return stmt.get(username) as User | null;
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

  updateUser(user: User): User | null {
    if (!this.db || !user.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE users SET 
        username = ?, email = ?, phone = ?, password = ?, role = ?, is_active = ?, profile_picture = ?, primary_theme_color = ?, secondary_theme_color = ?, theme_preference = ?,
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

  getAllFiles(): File[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM files ORDER BY upload_date DESC');
      return stmt.all() as File[];
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
        INSERT INTO exam_layouts (name, layout_data, is_default)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(
        layout.name,
        layout.layout_data,
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

  updateExamLayout(layout: ExamLayout): ExamLayout | null {
    if (!this.db || !layout.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE exam_layouts 
        SET name = ?, layout_data = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `);

      stmt.run(
        layout.name,
        layout.layout_data,
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

  createCoverTestExam(exam: Omit<CoverTestExam, 'id'>): CoverTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'INSERT INTO cover_test_exams (layout_instance_id, deviation_type, deviation_direction, fv_1, fv_2, nv_1, nv_2) VALUES (@layout_instance_id, @deviation_type, @deviation_direction, @fv_1, @fv_2, @nv_1, @nv_2)'
      );
      const result = stmt.run({
        ...exam,
        deviation_type: this.sanitizeValue(exam.deviation_type),
        deviation_direction: this.sanitizeValue(exam.deviation_direction),
        fv_1: this.sanitizeValue(exam.fv_1),
        fv_2: this.sanitizeValue(exam.fv_2),
        nv_1: this.sanitizeValue(exam.nv_1),
        nv_2: this.sanitizeValue(exam.nv_2),
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

  getCoverTestExamByLayoutInstanceId(layoutInstanceId: number): CoverTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare('SELECT * FROM cover_test_exams WHERE layout_instance_id = ?');
      return stmt.get(layoutInstanceId) as CoverTestExam || null;
    } catch (error) {
      console.error('Error getting cover test exam:', error);
      return null;
    }
  }

  updateCoverTestExam(exam: CoverTestExam): CoverTestExam | null {
    if (!this.db) return null;
    try {
      const stmt = this.db.prepare(
        'UPDATE cover_test_exams SET layout_instance_id = @layout_instance_id, deviation_type = @deviation_type, deviation_direction = @deviation_direction, fv_1 = @fv_1, fv_2 = @fv_2, nv_1 = @nv_1, nv_2 = @nv_2 WHERE id = @id'
      );
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
      
      const result = stmt.get(userId, startDate, endDate) as any;
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
}

export const dbService = new DatabaseService();
export type DBServiceType = typeof dbService; 