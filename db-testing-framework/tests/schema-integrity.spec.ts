import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

test.describe('Database Schema Integrity', () => {
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

  test('Verify all required tables exist in the public schema', async () => {
    const requiredTables = ['users', 'wallets', 'transactions', 'audit_logs'];
    const query = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    const res = await client.query(query);
    const existingTables = res.rows.map(r => r.table_name);
    
    for (const table of requiredTables) {
      expect(existingTables).toContain(table);
    }
  });

  test('Verify "users" table structure and constraints', async () => {
    const columnQuery = `
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'users'
    `;
    const res = await client.query(columnQuery);
    const columns = res.rows;

    const usernameCol = columns.find(c => c.column_name === 'username');
    expect(usernameCol.data_type).toBe('character varying');
    expect(usernameCol.is_nullable).toBe('NO');

    const statusCol = columns.find(c => c.column_name === 'status');
    expect(statusCol.column_default).toContain('ACTIVE');

    const constraintQuery = `
      SELECT constraint_type FROM information_schema.table_constraints
      WHERE table_name = 'users'
    `;
    const constraints = (await client.query(constraintQuery)).rows.map(r => r.constraint_type);
    expect(constraints).toContain('PRIMARY KEY');
    expect(constraints).toContain('UNIQUE');
  });

  test('Verify "wallets" table financial constraints', async () => {
    const checkConstraintQuery = `
      SELECT check_clause FROM information_schema.check_constraints c
      JOIN information_schema.constraint_column_usage col ON c.constraint_name = col.constraint_name
      WHERE col.table_name = 'wallets' AND col.column_name = 'balance'
    `;
    const res = await client.query(checkConstraintQuery);
    expect(res.rows[0].check_clause).toMatch(/balance\s*>=\s*\(?0\)?/);

    const columnQuery = `
      SELECT data_type FROM information_schema.columns 
      WHERE table_name = 'wallets' AND column_name = 'balance'
    `;
    const colRes = await client.query(columnQuery);
    expect(colRes.rows[0].data_type).toBe('numeric');
  });

  test('Verify "transactions" table UUID and JSONB types', async () => {
    const query = `
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'transactions' AND column_name IN ('transaction_id', 'metadata')
    `;
    const res = await client.query(query);
    
    const idCol = res.rows.find(r => r.column_name === 'transaction_id');
    const metaCol = res.rows.find(r => r.column_name === 'metadata');

    expect(idCol.data_type).toBe('uuid');
    expect(metaCol.data_type).toBe('jsonb');
  });

  test('Verify foreign key relationships', async () => {
    const fkQuery = `
      SELECT kcu.table_name, kcu.column_name, rel_tco.table_name AS referenced_table
      FROM information_schema.key_column_usage kcu
      JOIN information_schema.referential_constraints rc ON kcu.constraint_name = rc.constraint_name
      JOIN information_schema.table_constraints rel_tco ON rc.unique_constraint_name = rel_tco.constraint_name
      WHERE kcu.table_name IN ('wallets', 'transactions')
    `;
    const res = await client.query(fkQuery);
    const fks = res.rows;

    const walletToUser = fks.find(f => f.table_name === 'wallets' && f.column_name === 'user_id');
    expect(walletToUser.referenced_table).toBe('users');

    const txSender = fks.find(f => f.table_name === 'transactions' && f.column_name === 'sender_wallet_id');
    expect(txSender.referenced_table).toBe('wallets');
  });

  test('Verify Sequence generation for SERIAL columns', async () => {
    const query = `
      SELECT column_name, column_default 
      FROM information_schema.columns 
      WHERE column_default LIKE 'nextval%' AND table_schema = 'public'
    `;
    const res = await client.query(query);
    const serialColumns = res.rows.map(r => r.column_name);
    
    expect(serialColumns).toContain('user_id');
    expect(serialColumns).toContain('wallet_id');
    expect(serialColumns).toContain('log_id');
  });

  test('Verify NO unexpected tables exist', async () => {
    const query = `SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public'`;
    const res = await client.query(query);
    expect(Number(res.rows[0].count)).toBe(4);
  });

  test('Verify audit_logs table structure', async () => {
    const query = `
      SELECT column_name, data_type FROM information_schema.columns 
      WHERE table_name = 'audit_logs'
    `;
    const res = await client.query(query);
    const cols = res.rows.map(r => r.column_name);

    expect(cols).toContain('old_value');
    expect(cols).toContain('new_value');
    expect(res.rows.find(r => r.column_name === 'old_value').data_type).toBe('jsonb');
  });
});