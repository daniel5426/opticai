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
  User
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

      // Check if appointments table has the old client_name column
      const appointmentsInfo = this.db.prepare("PRAGMA table_info(appointments)").all() as any[];
      const hasClientNameColumn = appointmentsInfo.some(col => col.name === 'client_name');
      const hasFirstNameColumn = appointmentsInfo.some(col => col.name === 'first_name');
      const hasLastNameColumn = appointmentsInfo.some(col => col.name === 'last_name');
      const hasPhoneMobileColumn = appointmentsInfo.some(col => col.name === 'phone_mobile');

      // If the old structure exists, migrate to new structure
      if (hasClientNameColumn && (!hasFirstNameColumn || !hasLastNameColumn || !hasPhoneMobileColumn)) {
        console.log('Migrating appointments table structure...');
        
        // Create backup of existing data
        const existingAppointments = this.db.prepare('SELECT * FROM appointments').all() as any[];
        
        // Drop and recreate table with new structure
        this.db.exec('DROP TABLE appointments');
        this.db.exec(`
          CREATE TABLE appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER NOT NULL,
            date DATE,
            time TEXT,
            first_name TEXT,
            last_name TEXT,
            phone_mobile TEXT,
            exam_name TEXT,
            note TEXT,
            FOREIGN KEY(client_id) REFERENCES clients(id) ON DELETE CASCADE
          )
        `);
        
        // Restore data with client name split (if possible)
        for (const appointment of existingAppointments) {
          const clientNameParts = (appointment.client_name || '').split(' ');
          const firstName = clientNameParts[0] || '';
          const lastName = clientNameParts.slice(1).join(' ') || '';
          
          this.db.prepare(`
            INSERT INTO appointments (id, client_id, date, time, first_name, last_name, phone_mobile, exam_name, note)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            appointment.id,
            appointment.client_id,
            appointment.date,
            appointment.time,
            firstName,
            lastName,
            '', // phone_mobile will be empty for migrated records
            appointment.exam_name,
            appointment.note
          );
        }
        
        console.log('Appointments table migration completed');
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
              examiner_name: "ד״ר אביב כהן",
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
          client_id, clinic, examiner_name, exam_date, test_name, dominant_eye, notes,
          comb_subj_va, comb_old_va, comb_fa, comb_fa_tuning, comb_pd_close, comb_pd_far
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        exam.client_id, exam.clinic, exam.examiner_name, exam.exam_date, exam.test_name, 
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
        client_id = ?, clinic = ?, examiner_name = ?, exam_date = ?, test_name = ?, 
        dominant_eye = ?, notes = ?, comb_subj_va = ?, comb_old_va = ?, comb_fa = ?, 
        comb_fa_tuning = ?, comb_pd_close = ?, comb_pd_far = ?
        WHERE id = ?
      `);
      
      stmt.run(
        exam.client_id, exam.clinic, exam.examiner_name, exam.exam_date, exam.test_name, 
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
        INSERT INTO orders (order_date, type, dominant_eye, examiner_name, lens_id, frame_id, comb_va, comb_high, comb_pd)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        order.order_date, order.type, order.dominant_eye, order.examiner_name, order.lens_id, order.frame_id, 
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
        UPDATE orders SET order_date = ?, type = ?, dominant_eye = ?, examiner_name = ?, lens_id = ?, frame_id = ?, comb_va = ?, comb_high = ?, comb_pd = ?
        WHERE id = ?
      `);
      
      stmt.run(
        order.order_date, order.type, order.dominant_eye, order.examiner_name, order.lens_id, order.frame_id, 
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
        INSERT INTO medical_logs (client_id, log_date, log)
        VALUES (?, ?, ?)
      `);
      
      const result = stmt.run(log.client_id, log.log_date, log.log);
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
        UPDATE medical_logs SET client_id = ?, log_date = ?, log = ?
        WHERE id = ?
      `);
      
      stmt.run(log.client_id, log.log_date, log.log, log.id);
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
          client_id, exam_date, type, examiner_name, comb_va, pupil_diameter, corneal_diameter, eyelid_aperture, notes, notes_for_supplier
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        contactLens.client_id,
        this.sanitizeValue(contactLens.exam_date),
        this.sanitizeValue(contactLens.type),
        this.sanitizeValue(contactLens.examiner_name),
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
          client_id = ?, exam_date = ?, type = ?, examiner_name = ?, comb_va = ?, pupil_diameter = ?, corneal_diameter = ?,
          eyelid_aperture = ?, notes = ?, notes_for_supplier = ?
        WHERE id = ?
      `);
      
      stmt.run(
        contactLens.client_id,
        this.sanitizeValue(contactLens.exam_date),
        this.sanitizeValue(contactLens.type),
        this.sanitizeValue(contactLens.examiner_name),
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
          client_id, referral_notes, prescription_notes, comb_va, comb_high, comb_pd,
          date, type, branch, recipient
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        referral.client_id,
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
        client_id = ?, referral_notes = ?, prescription_notes = ?, comb_va = ?, comb_high = ?, comb_pd = ?,
        date = ?, type = ?, branch = ?, recipient = ?
        WHERE id = ?
      `);
      
      stmt.run(
        referral.client_id,
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
        INSERT INTO appointments (client_id, date, time, first_name, last_name, phone_mobile, exam_name, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        appointment.client_id,
        this.sanitizeValue(appointment.date),
        this.sanitizeValue(appointment.time),
        this.sanitizeValue(appointment.first_name),
        this.sanitizeValue(appointment.last_name),
        this.sanitizeValue(appointment.phone_mobile),
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
          client_id = ?, date = ?, time = ?, first_name = ?, last_name = ?, phone_mobile = ?, exam_name = ?, note = ?
        WHERE id = ?
      `);
      
      stmt.run(
        appointment.client_id,
        this.sanitizeValue(appointment.date),
        this.sanitizeValue(appointment.time),
        this.sanitizeValue(appointment.first_name),
        this.sanitizeValue(appointment.last_name),
        this.sanitizeValue(appointment.phone_mobile),
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
        clinic_address = ?, clinic_city = ?, clinic_postal_code = ?, clinic_website = ?,
        manager_name = ?, license_number = ?, clinic_logo_path = ?,
        primary_theme_color = ?, secondary_theme_color = ?,
        work_start_time = ?, work_end_time = ?, appointment_duration = ?,
        send_email_before_appointment = ?, email_days_before = ?, email_time = ?,
        working_days = ?, break_start_time = ?, break_end_time = ?, max_appointments_per_day = ?,
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
        this.sanitizeValue(settings.max_appointments_per_day)
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
}

export const dbService = new DatabaseService();
export default dbService; 