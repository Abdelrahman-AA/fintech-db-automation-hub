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

  async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const res = await this.client.query(query, [email]);
    return res.rows[0] || null;
  }

  async getUsersByStatus(status: string): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE status = $1';
    const res = await this.client.query(query, [status]);
    return res.rows;
  }

  async getTotalUsersCount(): Promise<number> {
    const query = 'SELECT COUNT(*) FROM users';
    const res = await this.client.query(query);
    return parseInt(res.rows[0].count);
  }

  async getRichUsersWithInvalidStatus(threshold: number = 9000, requiredStatus: string = 'ACTIVE'): Promise<any[]> {
    const query = `
      SELECT u.user_id, u.username, u.status, w.balance 
      FROM users u 
      JOIN wallets w ON u.user_id = w.user_id 
      WHERE w.balance > $1 AND u.status != $2
    `;
    const res = await this.client.query(query, [threshold, requiredStatus]);
    return res.rows;
  }

  async getUsersWithoutWallets(): Promise<User[]> {
    const query = `
    SELECT u.user_id 
    FROM users u 
    LEFT JOIN wallets w ON u.user_id = w.user_id 
    WHERE w.wallet_id IS NULL 
    AND u.username NOT LIKE 'test%' 
    AND u.email NOT LIKE 'a%'
    `;
    const res = await this.client.query(query);
    return res.rows;
  }

  async getDuplicateEmails(): Promise<{ email: string; count: string }[]> {
    const query = `
      SELECT email, COUNT(*) 
      FROM users 
      GROUP BY email 
      HAVING COUNT(*) > 1
    `;
    const res = await this.client.query(query);
    return res.rows;
  }

  async getDuplicateUsernames(): Promise<{ username: string; count: string }[]> {
    const query = `
      SELECT username, COUNT(*) 
      FROM users 
      GROUP BY username 
      HAVING COUNT(*) > 1
    `;
    const res = await this.client.query(query);
    return res.rows;
  }

  async getRecentlyCreatedUsers(limit: number = 10): Promise<User[]> {
    const query = 'SELECT * FROM users ORDER BY created_at DESC LIMIT $1';
    const res = await this.client.query(query, [limit]);
    return res.rows;
  }

  async getDeletedUsers(): Promise<User[]> {
    const query = 'SELECT * FROM users WHERE deleted_at IS NOT NULL';
    const res = await this.client.query(query);
    return res.rows;
  }

  async validateUserIntegrity(): Promise<{ total_users: number; active_users: number; inactive_users: number }> {
    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'ACTIVE') as active,
        COUNT(*) FILTER (WHERE status = 'INACTIVE') as inactive
      FROM users
    `;
    const res = await this.client.query(query);
    return {
      total_users: parseInt(res.rows[0].total),
      active_users: parseInt(res.rows[0].active),
      inactive_users: parseInt(res.rows[0].inactive)
    };
  }
}