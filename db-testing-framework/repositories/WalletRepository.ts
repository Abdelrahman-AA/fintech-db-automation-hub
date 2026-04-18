import { Client } from 'pg';

export interface Wallet {
  wallet_id: number;
  user_id: number;
  balance: number;
  currency: string;
  version: number;
  updated_at: Date;
}

export class WalletRepository {
  private client: Client;

  constructor(client: Client) {
    this.client = client;
  }

  async getWalletById(walletId: number): Promise<Wallet | null> {
    const query = 'SELECT * FROM wallets WHERE wallet_id = $1';
    const res = await this.client.query(query, [walletId]);
    return res.rows[0] || null;
  }

  async getWalletByUserId(userId: number): Promise<Wallet | null> {
    const query = 'SELECT * FROM wallets WHERE user_id = $1';
    const res = await this.client.query(query, [userId]);
    return res.rows[0] || null;
  }

  async getWalletsAboveBalance(threshold: number): Promise<Wallet[]> {
    const query = 'SELECT * FROM wallets WHERE balance > $1';
    const res = await this.client.query(query, [threshold]);
    return res.rows;
  }

  async getOrphanedWallets(): Promise<any[]> {
    const query = `
      SELECT w.* FROM wallets w 
      LEFT JOIN users u ON w.user_id = u.user_id 
      WHERE u.user_id IS NULL
    `;
    const res = await this.client.query(query);
    return res.rows;
  }

  async getNegativeBalanceWallets(): Promise<Wallet[]> {
    const query = 'SELECT * FROM wallets WHERE balance < 0';
    const res = await this.client.query(query);
    return res.rows;
  }

  async getTotalBalanceByCurrency(currency: string = 'EGP'): Promise<number> {
    const query = 'SELECT SUM(balance) as total FROM wallets WHERE currency = $1';
    const res = await this.client.query(query, [currency]);
    return parseFloat(res.rows[0].total || '0');
  }

  async getWalletWithUserDetail(walletId: number): Promise<any | null> {
    const query = `
      SELECT w.*, u.username, u.email, u.status 
      FROM wallets w 
      JOIN users u ON w.user_id = u.user_id 
      WHERE w.wallet_id = $1
    `;
    const res = await this.client.query(query, [walletId]);
    return res.rows[0] || null;
  }

  async getWalletsCount(): Promise<number> {
    const query = 'SELECT COUNT(*) FROM wallets';
    const res = await this.client.query(query);
    return parseInt(res.rows[0].count);
  }

  async getWalletsByCurrency(currency: string): Promise<Wallet[]> {
    const query = 'SELECT * FROM wallets WHERE currency = $1';
    const res = await this.client.query(query, [currency]);
    return res.rows;
  }

  async checkDuplicateWalletsPerUser(): Promise<any[]> {
    const query = `
      SELECT user_id, COUNT(*) 
      FROM wallets 
      GROUP BY user_id 
      HAVING COUNT(*) > 1
    `;
    const res = await this.client.query(query);
    return res.rows;
  }

  async getWalletVersion(walletId: number): Promise<number | null> {
    const query = 'SELECT version FROM wallets WHERE wallet_id = $1';
    const res = await this.client.query(query, [walletId]);
    return res.rows[0] ? parseInt(res.rows[0].version) : null;
  }

  async getLatestUpdatedWallets(limit: number = 10): Promise<Wallet[]> {
    const query = 'SELECT * FROM wallets ORDER BY updated_at DESC LIMIT $1';
    const res = await this.client.query(query, [limit]);
    return res.rows;
  }
}