import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { UserRepository } from '../repositories/UserRepository';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

test.describe('Business Rules Compliance', () => {
  let client: Client;
  let userRepo: UserRepository;

  test.beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    userRepo = new UserRepository(client);
  });

  test.afterAll(async () => {
    await client.end();
  });

  test('Rule: High-value users (balance > 9000) must be ACTIVE', async () => {
    const richUsers = await userRepo.getRichUsersWithInvalidStatus(9000, 'ACTIVE');
    expect(richUsers.length).toBe(0);
  });

  test('Rule: Wallet balance must never be less than zero', async () => {
    const query = 'SELECT COUNT(*) FROM wallets WHERE balance < 0';
    const res = await client.query(query);
    expect(Number(res.rows[0].count)).toBe(0);
  });

  test('Rule: Every user must have exactly one wallet', async () => {
    const usersWithoutWallets = await userRepo.getUsersWithoutWallets();
    expect(usersWithoutWallets.length).toBe(0);

    const duplicateWalletsQuery = `
      SELECT user_id FROM wallets 
      GROUP BY user_id 
      HAVING COUNT(*) > 1
    `;
    const res = await client.query(duplicateWalletsQuery);
    expect(res.rowCount).toBe(0);
  });

  test('Rule: All transactions must have a unique reference_id', async () => {
    const query = `
      SELECT reference_id FROM transactions 
      GROUP BY reference_id 
      HAVING COUNT(*) > 1
    `;
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Rule: Transfer transactions must have different sender and receiver', async () => {
    const query = `
      SELECT * FROM transactions 
      WHERE type = 'TRANSFER' AND sender_wallet_id = receiver_wallet_id
    `;
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Rule: BANNED users should not have a balance over 10000', async () => {
    const query = `
      SELECT u.username, w.balance 
      FROM users u 
      JOIN wallets w ON u.user_id = w.user_id 
      WHERE u.status = 'BANNED' AND w.balance > 10000
    `;
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Rule: Transaction amount must always be positive', async () => {
    const query = 'SELECT COUNT(*) FROM transactions WHERE amount <= 0';
    const res = await client.query(query);
    expect(Number(res.rows[0].count)).toBe(0);
  });

test('Rule: Transactions with SUCCESS status must have metadata including IP', async () => {
  const query = `
    SELECT transaction_id FROM transactions 
    WHERE status = 'SUCCESS' AND (metadata->>'ip') IS NULL
  `;
  const res = await client.query(query);
  expect(res.rowCount).toBe(0);
});

  test('Rule: Wallets should use EGP as default currency', async () => {
    const query = "SELECT COUNT(*) FROM wallets WHERE currency != 'EGP'";
    const res = await client.query(query);
    expect(Number(res.rows[0].count)).toBe(0);
  });

  test('Rule: Users created recently must have ACTIVE or INACTIVE status initially', async () => {
    const query = `
      SELECT username FROM users 
      WHERE created_at > NOW() - INTERVAL '1 hour' 
      AND status NOT IN ('ACTIVE', 'INACTIVE')
    `;
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });
});