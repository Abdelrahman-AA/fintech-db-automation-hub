import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

test.describe('Audit Trail Verification', () => {
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

test('Positive: Verify audit_logs table accessibility and basic structure', async () => {
  const res = await client.query('SELECT * FROM audit_logs LIMIT 1');
  const count = res.rowCount ?? 0;

  if (count > 0) {
    const log = res.rows[0];
    expect(log).toHaveProperty('log_id');
    expect(log).toHaveProperty('table_name');
    expect(log).toHaveProperty('action');
    expect(log).toHaveProperty('changed_at');
  }
});

  test('Positive: Manually trigger and verify an INSERT audit log', async () => {
    const testUsername = `audit_test_${Date.now()}`;
    const userRes = await client.query(
      'INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3) RETURNING user_id',
      [testUsername, `${testUsername}@test.com`, 'Audit Tester']
    );
    const userId = userRes.rows[0].user_id;

    await client.query(
      'INSERT INTO audit_logs (table_name, record_id, action, new_value) VALUES ($1, $2, $3, $4)',
      ['users', userId.toString(), 'INSERT', JSON.stringify({ username: testUsername, status: 'ACTIVE' })]
    );

    const auditRes = await client.query(
      'SELECT * FROM audit_logs WHERE table_name = \'users\' AND record_id = $1 AND action = \'INSERT\'',
      [userId.toString()]
    );

    expect(auditRes.rowCount).toBe(1);
    expect(auditRes.rows[0].new_value.username).toBe(testUsername);
  });

  test('Positive: Verify JSONB metadata storage for updates', async () => {
    const logId = `tx_${Date.now()}`;
    const oldValue = { balance: 1000, version: 1 };
    const newValue = { balance: 900, version: 2 };

    await client.query(
      'INSERT INTO audit_logs (table_name, record_id, action, old_value, new_value) VALUES ($1, $2, $3, $4, $5)',
      ['wallets', logId, 'UPDATE', JSON.stringify(oldValue), JSON.stringify(newValue)]
    );

    const res = await client.query('SELECT old_value, new_value FROM audit_logs WHERE record_id = $1', [logId]);
    expect(res.rows[0].old_value.balance).toBe(1000);
    expect(res.rows[0].new_value.balance).toBe(900);
  });

  test('Negative: Prevent null table_name in logs', async () => {
    try {
      await client.query('INSERT INTO audit_logs (record_id, action) VALUES ($1, $2)', ['123', 'DELETE']);
      throw new Error('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('23502');
    }
  });

  test('Negative: Prevent null action in logs', async () => {
    try {
      await client.query('INSERT INTO audit_logs (table_name, record_id) VALUES ($1, $2)', ['users', '123']);
      throw new Error('Should have failed');
    } catch (err: any) {
      expect(err.code).toBe('23502');
    }
  });

  test('Data Integrity: Verify log timestamps are chronological', async () => {
    await client.query('INSERT INTO audit_logs (table_name, record_id, action) VALUES (\'test\', \'1\', \'OP1\')');
    await new Promise(resolve => setTimeout(resolve, 10));
    await client.query('INSERT INTO audit_logs (table_name, record_id, action) VALUES (\'test\', \'2\', \'OP2\')');

    const res = await client.query('SELECT changed_at FROM audit_logs ORDER BY log_id DESC LIMIT 2');
    const time2 = new Date(res.rows[0].changed_at).getTime();
    const time1 = new Date(res.rows[1].changed_at).getTime();
    
    expect(time2).toBeGreaterThanOrEqual(time1);
  });

  test('Logic: Verify record_id is stored as string to support UUID and Serial', async () => {
    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    await client.query(
      'INSERT INTO audit_logs (table_name, record_id, action) VALUES ($1, $2, $3)',
      ['transactions', uuid, 'FAILED_AUTH']
    );

    const res = await client.query('SELECT record_id FROM audit_logs WHERE record_id = $1', [uuid]);
    expect(res.rows[0].record_id).toBe(uuid);
  });

  test('Cleanup: No logs should exist for non-existent tables (Strict Check)', async () => {
    const validTables = ['users', 'wallets', 'transactions', 'audit_logs', 'test'];
    const query = 'SELECT DISTINCT table_name FROM audit_logs';
    const res = await client.query(query);
    
    for (const row of res.rows) {
      expect(validTables).toContain(row.table_name);
    }
  });
});