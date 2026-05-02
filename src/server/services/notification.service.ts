import pg from 'pg';

const { Pool } = pg;

import { config } from '../lib/config.js';

const pool = new pg.Pool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
});

export interface GlobalNotification {
  id: number;
  message: string;
  type: string;
  createdAt: string;
}

// Table initialization
pool.query(`
  CREATE TABLE IF NOT EXISTS global_notifications (
    id SERIAL PRIMARY KEY,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`).catch(err => console.error('[NotificationService] Failed to create global_notifications table:', err));

export class NotificationService {
  static async addNotification(message: string, type = 'info'): Promise<GlobalNotification> {
    const res = await pool.query(
      'INSERT INTO global_notifications (message, type) VALUES ($1, $2) RETURNING id, message, type, created_at as "createdAt"',
      [message, type]
    );
    return res.rows[0];
  }

  static async getActiveNotifications(): Promise<GlobalNotification[]> {
    const res = await pool.query(
      'SELECT id, message, type, created_at as "createdAt" FROM global_notifications ORDER BY created_at DESC LIMIT 5'
    );
    return res.rows;
  }

  static async deleteNotification(id: number): Promise<void> {
    await pool.query('DELETE FROM global_notifications WHERE id = $1', [id]);
  }

  static async clearAll(): Promise<void> {
    await pool.query('TRUNCATE global_notifications');
  }
}
