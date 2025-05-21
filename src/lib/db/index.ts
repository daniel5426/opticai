import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { createTables, Client } from './schema';

class DatabaseService {
  private db: Database | null = null;
  private dbPath: string;

  constructor() {
    // Store database in the user data directory
    const userDataPath = app.getPath('userData');
    this.dbPath = path.join(userDataPath, 'database.sqlite');
    
    // Ensure directory exists
    if (!fs.existsSync(userDataPath)) {
      fs.mkdirSync(userDataPath, { recursive: true });
    }
  }

  initialize(): void {
    try {
      this.db = new Database(this.dbPath);
      
      // Create tables if they don't exist
      createTables(this.db);
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize database:', error);
    }
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('Database connection closed');
    }
  }

  // User CRUD operations
  createUser(user: Client): number | null {
    if (!this.db) return null;
    
    try {
      const insertStmt = this.db.prepare(`
        INSERT INTO clients (
          first_name, last_name, gender, national_id, date_of_birth,
          address_city, address_street, address_number, postal_code,
          phone_home, phone_work, phone_mobile, fax, email,
          service_center, file_creation_date, membership_end, service_end,
          price_list, discount_percent, blocked_checks, blocked_credit,
          sorting_group, referring_party, file_location, occupation, status, notes
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);
      
      const result = insertStmt.run(
        user.first_name, user.last_name, user.gender, user.national_id, user.date_of_birth,
        user.address_city, user.address_street, user.address_number, user.postal_code,
        user.phone_home, user.phone_work, user.phone_mobile, user.fax, user.email,
        user.service_center, user.file_creation_date, user.membership_end, user.service_end,
        user.price_list, user.discount_percent, user.blocked_checks, user.blocked_credit,
        user.sorting_group, user.referring_party, user.file_location, user.occupation, user.status, user.notes
      );
      
      return result.lastInsertRowid as number;
    } catch (error) {
      console.error('Error creating user:', error);
      return null;
    }
  }

  getUser(id: number): Client | null {
    if (!this.db) return null;
    
    try {
      const stmt = this.db.prepare('SELECT * FROM clients WHERE id = ?');
      return stmt.get(id) as Client | null;
    } catch (error) {
      console.error('Error getting user:', error);
      return null;
    }
  }

  getUserByNationalId(nationalId: string): Client | null {
    if (!this.db) return null;
    
    try {
      const stmt = this.db.prepare('SELECT * FROM clients WHERE national_id = ?');
      return stmt.get(nationalId) as Client | null;
    } catch (error) {
      console.error('Error getting user by national ID:', error);
      return null;
    }
  }

  getAllUsers(): Client[] {
    if (!this.db) return [];
    
    try {
      const stmt = this.db.prepare('SELECT * FROM clients');
      return stmt.all() as Client[];
    } catch (error) {
      console.error('Error getting all users:', error);
      return [];
    }
  }

  updateUser(id: number, userData: Partial<Client>): boolean {
    if (!this.db) return false;
    
    try {
      // Build the SET part of the query dynamically based on provided fields
      const entries = Object.entries(userData).filter(([key]) => key !== 'id');
      if (entries.length === 0) return false;
      
      const setClause = entries.map(([key]) => `${key} = ?`).join(', ');
      const values = entries.map(([, value]) => value);
      
      const stmt = this.db.prepare(`UPDATE clients SET ${setClause} WHERE id = ?`);
      const result = stmt.run(...values, id);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error updating user:', error);
      return false;
    }
  }

  deleteUser(id: number): boolean {
    if (!this.db) return false;
    
    try {
      const stmt = this.db.prepare('DELETE FROM clients WHERE id = ?');
      const result = stmt.run(id);
      
      return result.changes > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }
}

export const dbService = new DatabaseService();
export default dbService; 