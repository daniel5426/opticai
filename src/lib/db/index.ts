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
  OrderLineItem
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
      
      this.seedInitialData();
      
      console.log('Database initialized successfully at:', this.dbPath);
    } catch (error) {
      console.error('Failed to initialize database:', error);
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

  // Utility methods
  // Order Details CRUD operations
  createOrderDetails(orderDetails: Omit<OrderDetails, 'id'>): OrderDetails | null {
    if (!this.db) return null;
    
    try {
      const stmt = this.db.prepare(`
        INSERT INTO order_details (
          order_id, branch, supplier_status, bag_number, advisor, delivered_by,
          technician, delivered_at, warranty_expiration, delivery_location,
          manufacturing_lab, order_status, priority, promised_date, approval_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        orderDetails.order_id, orderDetails.branch, orderDetails.supplier_status,
        orderDetails.bag_number, orderDetails.advisor, orderDetails.delivered_by,
        orderDetails.technician, orderDetails.delivered_at, orderDetails.warranty_expiration,
        orderDetails.delivery_location, orderDetails.manufacturing_lab, orderDetails.order_status,
        orderDetails.priority, orderDetails.promised_date, orderDetails.approval_date
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
          manufacturing_lab = ?, order_status = ?, priority = ?, promised_date = ?, approval_date = ?
        WHERE id = ?
      `);
      
      stmt.run(
        orderDetails.order_id, orderDetails.branch, orderDetails.supplier_status,
        orderDetails.bag_number, orderDetails.advisor, orderDetails.delivered_by,
        orderDetails.technician, orderDetails.delivered_at, orderDetails.warranty_expiration,
        orderDetails.delivery_location, orderDetails.manufacturing_lab, orderDetails.order_status,
        orderDetails.priority, orderDetails.promised_date, orderDetails.approval_date,
        orderDetails.id
      );
      
      return orderDetails;
    } catch (error) {
      console.error('Error updating order details:', error);
      return null;
    }
  }

  getDatabase(): Database.Database | null {
    return this.db;
  }
}

export const dbService = new DatabaseService();
export default dbService; 