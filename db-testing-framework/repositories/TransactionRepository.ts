import { Client } from 'pg';

export interface User {
  user_id: number;
  username: string;
  email: string;
  full_name: string;
  status: string;
  deleted_at: Date | null;
  created_at: Date;
}

export class UserRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async getUserById(userId: number): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE user_id = $1';
    const res = await this.client.query(query, [userId]);
    return res.rows[0] || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE username = $1';
    const res = await this.client.query(query, [username]);
    return res.rows[0] || null;
  }

  async getUsersByStatus(status: string): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE status = $1';
    const res = await this.client.query(query, [status]);
    return res.rows;
  }

  async getRichUsersWithInvalidStatus(balanceThreshold: number, requiredStatus: string = 'ACTIVE'): Promise<any[]> {
    const query = `
      SELECT u.user_id, u.username, u.status, w.balance 
      FROM users u 
      JOIN wallets w ON u.user_id = w.user_id 
      WHERE w.balance > $1 AND u.status != $2
    `;
    const res = await this.client.query(query, [balanceThreshold, requiredStatus]);
    return res.rows;
  }

  async getUsersWithoutWallets(): Promise<User[]> {
    const query = `
      SELECT u.* FROM users u 
      LEFT JOIN wallets w ON u.user_id = w.user_id 
      WHERE w.wallet_id IS NULL
    `;
    const res = await this.client.query(query);
    return res.rows;
  }

  async getTotalUsersCount(): Promise<number> {
    const query = 'SELECT COUNT(*) FROM users';
    const res = await this.client.query(query);
    return parseInt(res.rows[0].count);
  }

  async checkDuplicateEmails(): Promise<any[]> {
    const query = `
      SELECT email, COUNT(*) 
      FROM users 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `;
    const res = await this.client.query(query);
    return res.rows;
  }

  async getRecentlyDeletedUsers(): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC';
    const res = await this.client.query(query);
    return res.rows;
  }

  async isUsernameTaken(username: string): Promise<boolean> {
    const query = 'SELECT 1 FROM users WHERE username = $1 LIMIT 1';
    const res = await this.client.query(query, [username]);
    return res.rowCount !== null && res.rowCount > 0;
  }
}