import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

test.describe('Transaction Flow Logic', () => {
  let client: Client;

  test.beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
  });

  test.afterAll(async () => {
    await client.end();
  });

  test('Positive: Validate seeded transactions structure', async () => {
    const res = await client.query('SELECT * FROM transactions LIMIT 10');
    expect(res.rowCount).toBeGreaterThan(0);
    
    for (const tx of res.rows) {
      expect(tx.transaction_id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
      expect(tx.reference_id).not.toBeNull();
      expect(Number(tx.amount)).toBeGreaterThan(0);
      expect(['SUCCESS', 'PENDING', 'FAILED']).toContain(tx.status);
    }
  });

  test('Positive: Verify metadata JSONB structure and content', async () => {
    const res = await client.query('SELECT metadata FROM transactions WHERE metadata IS NOT NULL LIMIT 5');
    for (const row of res.rows) {
      const meta = row.metadata;
      expect(meta).toHaveProperty('ip');
      expect(meta).toHaveProperty('device');
      expect(['iOS', 'Android', 'Web', 'Desktop']).toContain(meta.device);
    }
  });

  test('Negative: Prevent transaction with non-existent sender wallet', async () => {
    try {
      await client.query(
        'INSERT INTO transactions (reference_id, sender_wallet_id, receiver_wallet_id, amount, type) VALUES ($1, $2, $3, $4, $5)',
        ['ERR_REF_001', 999999, 1, 10.00, 'TRANSFER']
      );
      throw new Error('Should have thrown foreign key violation');
    } catch (err: any) {
      expect(err.code).toBe('23503');
    }
  });

  test('Negative: Prevent zero or negative transaction amounts', async () => {
    const wallets = await client.query('SELECT wallet_id FROM wallets LIMIT 2');
    const w1 = wallets.rows[0].wallet_id;
    const w2 = wallets.rows[1].wallet_id;
    
    try {
      await client.query(
        'INSERT INTO transactions (reference_id, sender_wallet_id, receiver_wallet_id, amount, type) VALUES ($1, $2, $3, $4, $5)',
        ['ERR_REF_002', w1, w2, -50.00, 'TRANSFER']
      );
      throw new Error('Should have thrown check constraint violation');
    } catch (err: any) {
      expect(err.code).toBe('23514');
    }
  });

  test('Negative: Prevent duplicate reference_id', async () => {
    const existingTx = await client.query('SELECT reference_id FROM transactions LIMIT 1');
    const refId = existingTx.rows[0].reference_id;
    
    try {
      await client.query(
        'INSERT INTO transactions (reference_id, amount, type) VALUES ($1, $2, $3)',
        [refId, 100.00, 'DEPOSIT']
      );
      throw new Error('Should have thrown unique constraint violation');
    } catch (err: any) {
      expect(err.code).toBe('23505');
    }
  });

  test('Business Logic: Self-transfer validation', async () => {
    const query = 'SELECT * FROM transactions WHERE sender_wallet_id = receiver_wallet_id';
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Data Integrity: Transactions without wallets (Deposits/Adjustments)', async () => {
    const query = 'SELECT * FROM transactions WHERE type = \'TRANSFER\' AND (sender_wallet_id IS NULL OR receiver_wallet_id IS NULL)';
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Boundary: Large amount precision check', async () => {
    const ref = 'MAX_VAL_TEST_' + Date.now();
    await client.query(
      'INSERT INTO transactions (reference_id, amount, type) VALUES ($1, $2, $3)',
      [ref, 9999999999999.99, 'SYSTEM_CREDIT']
    );
    
    const res = await client.query('SELECT amount FROM transactions WHERE reference_id = $1', [ref]);
    expect(res.rows[0].amount).toBe('9999999999999.99');
    
    await client.query('DELETE FROM transactions WHERE reference_id = $1', [ref]);
  });

  test('Consistency: Transaction timestamp should be auto-generated', async () => {
    const res = await client.query('SELECT created_at FROM transactions LIMIT 1');
    expect(res.rows[0].created_at).toBeInstanceOf(Date);
  });
});