import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

test.describe('Referential Integrity & Orphans', () => {
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

    test('Integrity: No wallets without associated users', async () => {
        const query = `
      SELECT wallet_id FROM wallets w 
      LEFT JOIN users u ON w.user_id = u.user_id 
      WHERE u.user_id IS NULL
    `;
        const res = await client.query(query);
        expect(res.rowCount).toBe(0);
    });

    test('Integrity: No transactions with invalid sender or receiver wallets', async () => {
        const query = `
      SELECT transaction_id FROM transactions t
      LEFT JOIN wallets w1 ON t.sender_wallet_id = w1.wallet_id
      LEFT JOIN wallets w2 ON t.receiver_wallet_id = w2.wallet_id
      WHERE (t.sender_wallet_id IS NOT NULL AND w1.wallet_id IS NULL)
      OR (t.receiver_wallet_id IS NOT NULL AND w2.wallet_id IS NULL)
    `;
        const res = await client.query(query);
        expect(res.rowCount).toBe(0);
    });

    test('Cascade: Deleting a user must delete their wallet', async () => {
        const userRes = await client.query(
            "INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3) RETURNING user_id",
            ['orphan_test_user', 'orphan@test.com', 'Orphan Tester']
        );
        const userId = userRes.rows[0].user_id;

        await client.query(
            "INSERT INTO wallets (user_id, balance) VALUES ($1, $2) RETURNING wallet_id",
            [userId, 100.00]
        );

        await client.query("DELETE FROM users WHERE user_id = $1", [userId]);

        const walletRes = await client.query("SELECT * FROM wallets WHERE user_id = $1", [userId]);
        expect(walletRes.rowCount).toBe(0);
    });

    test('FK Protection: Prevent deleting wallet if referenced by transactions', async () => {
        const res = await client.query("SELECT sender_wallet_id FROM transactions WHERE sender_wallet_id IS NOT NULL LIMIT 1");
        const count = res.rowCount ?? 0;

        if (count > 0) {
            const walletId = res.rows[0].sender_wallet_id;
            try {
                await client.query("DELETE FROM wallets WHERE wallet_id = $1", [walletId]);
                throw new Error('Should have thrown FK violation error');
            } catch (err: any) {
                expect(err.code).toBe('23503');
            }
        }
    });

    test('Integrity: Audit logs record_id must reflect existing entity during insert', async () => {
        const query = `
      SELECT a.record_id FROM audit_logs a
      WHERE a.table_name = 'users' 
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id::text = a.record_id)
      AND a.action = 'UPDATE'
    `;
        const res = await client.query(query);
        expect(res.rowCount).toBe(0);
    });

    test('Consistency: Multiple transactions must point to the same wallet correctly', async () => {
        const query = `
      SELECT sender_wallet_id, COUNT(*) 
      FROM transactions 
      WHERE sender_wallet_id IS NOT NULL 
      GROUP BY sender_wallet_id 
      HAVING sender_wallet_id NOT IN (SELECT wallet_id FROM wallets)
    `;
        const res = await client.query(query);
        expect(res.rowCount).toBe(0);
    });

    test('Logic: Wallet version must increment logically (Snapshot Check)', async () => {
        const query = 'SELECT version FROM wallets WHERE version < 1';
        const res = await client.query(query);
        expect(res.rowCount).toBe(0);
    });
});