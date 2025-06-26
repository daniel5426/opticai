import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import {
  createTables,
  Client,
  OpticalExam,
  OpticalEyeExam,
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
  LookupAdvisor
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
              notes: "בדיקה ראשונית",
              comb_subj_va: 1.0,
              comb_old_va: 0.8,
              comb_fa: 6,
              comb_fa_tuning: 0,
              comb_pd_close: 62,
              comb_pd_far: 64
            });

            if (exam) {
              this.createEyeExam({
                exam_id: exam.id!,
                eye: "R",
                old_sph: -1.25,
                old_cyl: -0.5,
                old_ax: 180,
                old_va: 0.6,
                subj_sph: -1.5,
                subj_cyl: -0.75,
                subj_ax: 175,
                subj_va: 1.0,
                subj_pd_close: 32,
                subj_pd_far: 33
              });

              this.createEyeExam({
                exam_id: exam.id!,
                eye: "L",
                old_sph: -1.0,
                old_cyl: -0.25,
                old_ax: 90,
                old_va: 0.6,
                subj_sph: -1.25,
                subj_cyl: -0.5,
                subj_ax: 85,
                subj_va: 1.0,
                subj_pd_close: 31,
                subj_pd_far: 32
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
          client_id, clinic, user_id, exam_date, test_name, dominant_eye, notes,
          comb_subj_va, comb_old_va, comb_fa, comb_fa_tuning, comb_pd_close, comb_pd_far
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        exam.client_id, exam.clinic, this.sanitizeValue(exam.user_id), exam.exam_date, exam.test_name,
        exam.dominant_eye, exam.notes, exam.comb_subj_va, exam.comb_old_va, exam.comb_fa,
        exam.comb_fa_tuning, exam.comb_pd_close, exam.comb_pd_far
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
        dominant_eye = ?, notes = ?, comb_subj_va = ?, comb_old_va = ?, comb_fa = ?, 
        comb_fa_tuning = ?, comb_pd_close = ?, comb_pd_far = ?
        WHERE id = ?
      `);

      stmt.run(
        exam.client_id, exam.clinic, this.sanitizeValue(exam.user_id), exam.exam_date, exam.test_name,
        exam.dominant_eye, exam.notes, exam.comb_subj_va, exam.comb_old_va, exam.comb_fa,
        exam.comb_fa_tuning, exam.comb_pd_close, exam.comb_pd_far, exam.id
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
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting exam:', error);
      return false;
    }
  }

  // Eye Exam CRUD operations
  createEyeExam(eyeExam: Omit<OpticalEyeExam, 'id'>): OpticalEyeExam | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO optical_eye_exam (
          exam_id, eye, old_sph, old_cyl, old_ax, old_pris, old_base, old_va, old_ad,
          obj_sph, obj_cyl, obj_ax, obj_se, subj_fa, subj_fa_tuning, subj_sph, subj_cyl, subj_ax,
          subj_pris, subj_base, subj_va, subj_pd_close, subj_pd_far, subj_ph,
          ad_fcc, ad_read, ad_int, ad_bif, ad_mul, ad_j, iop
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        eyeExam.exam_id, eyeExam.eye, eyeExam.old_sph, eyeExam.old_cyl, eyeExam.old_ax,
        eyeExam.old_pris, eyeExam.old_base, eyeExam.old_va, eyeExam.old_ad,
        eyeExam.obj_sph, eyeExam.obj_cyl, eyeExam.obj_ax, eyeExam.obj_se,
        eyeExam.subj_fa, eyeExam.subj_fa_tuning, eyeExam.subj_sph, eyeExam.subj_cyl, eyeExam.subj_ax,
        eyeExam.subj_pris, eyeExam.subj_base, eyeExam.subj_va, eyeExam.subj_pd_close, eyeExam.subj_pd_far, eyeExam.subj_ph,
        eyeExam.ad_fcc, eyeExam.ad_read, eyeExam.ad_int, eyeExam.ad_bif, eyeExam.ad_mul, eyeExam.ad_j, eyeExam.iop
      );

      return { ...eyeExam, id: result.lastInsertRowid as number };
    } catch (error) {
      console.error('Error creating eye exam:', error);
      return null;
    }
  }

  getEyeExamsByExamId(examId: number): OpticalEyeExam[] {
    if (!this.db) return [];

    try {
      const stmt = this.db.prepare('SELECT * FROM optical_eye_exam WHERE exam_id = ? ORDER BY eye');
      return stmt.all(examId) as OpticalEyeExam[];
    } catch (error) {
      console.error('Error getting eye exams:', error);
      return [];
    }
  }

  updateEyeExam(eyeExam: OpticalEyeExam): OpticalEyeExam | null {
    if (!this.db || !eyeExam.id) return null;

    try {
      const stmt = this.db.prepare(`
        UPDATE optical_eye_exam SET 
        exam_id = ?, eye = ?, old_sph = ?, old_cyl = ?, old_ax = ?, old_pris = ?, old_base = ?, old_va = ?, old_ad = ?,
        obj_sph = ?, obj_cyl = ?, obj_ax = ?, obj_se = ?, subj_fa = ?, subj_fa_tuning = ?, subj_sph = ?, subj_cyl = ?, subj_ax = ?,
        subj_pris = ?, subj_base = ?, subj_va = ?, subj_pd_close = ?, subj_pd_far = ?, subj_ph = ?,
        ad_fcc = ?, ad_read = ?, ad_int = ?, ad_bif = ?, ad_mul = ?, ad_j = ?, iop = ?
        WHERE id = ?
      `);

      stmt.run(
        eyeExam.exam_id, eyeExam.eye, eyeExam.old_sph, eyeExam.old_cyl, eyeExam.old_ax,
        eyeExam.old_pris, eyeExam.old_base, eyeExam.old_va, eyeExam.old_ad,
        eyeExam.obj_sph, eyeExam.obj_cyl, eyeExam.obj_ax, eyeExam.obj_se,
        eyeExam.subj_fa, eyeExam.subj_fa_tuning, eyeExam.subj_sph, eyeExam.subj_cyl, eyeExam.subj_ax,
        eyeExam.subj_pris, eyeExam.subj_base, eyeExam.subj_va, eyeExam.subj_pd_close, eyeExam.subj_pd_far, eyeExam.subj_ph,
        eyeExam.ad_fcc, eyeExam.ad_read, eyeExam.ad_int, eyeExam.ad_bif, eyeExam.ad_mul, eyeExam.ad_j, eyeExam.iop,
        eyeExam.id
      );

      return eyeExam;
    } catch (error) {
      console.error('Error updating eye exam:', error);
      return null;
    }
  }

  // Order CRUD operations
  createOrder(order: Omit<Order, 'id'>): Order | null {
    if (!this.db) return null;

    try {
      const stmt = this.db.prepare(`
        INSERT INTO orders (order_date, type, dominant_eye, user_id, lens_id, frame_id, comb_va, comb_high, comb_pd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        order.order_date, order.type, order.dominant_eye, this.sanitizeValue(order.user_id), order.lens_id, order.frame_id,
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
        ORDER BY order_date DESC
      `);
      return stmt.all() as Order[];
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
        UPDATE orders SET order_date = ?, type = ?, dominant_eye = ?, user_id = ?, lens_id = ?, frame_id = ?, comb_va = ?, comb_high = ?, comb_pd = ?
        WHERE id = ?
      `);

      stmt.run(
        order.order_date, order.type, order.dominant_eye, this.sanitizeValue(order.user_id), order.lens_id, order.frame_id,
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
        INSERT INTO users (username, email, phone, password, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        user.username,
        this.sanitizeValue(user.email),
        this.sanitizeValue(user.phone),
        this.sanitizeValue(user.password),
        user.role,
        this.sanitizeValue(user.is_active ?? true)
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
        username = ?, email = ?, phone = ?, password = ?, role = ?, is_active = ?,
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
}

export const dbService = new DatabaseService();
export default dbService; 