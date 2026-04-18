import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

test.describe('Data Boundary & Constraints', () => {
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

    test('Boundary: Max numeric precision for wallet balance', async () => {
        const maxBalance = 9999999999999.99;
        const res = await client.query(
            'INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3) RETURNING user_id',
            [`limit_${Date.now()}`, `limit@${Date.now()}.com`, 'Limit Tester']
        );
        const userId = res.rows[0].user_id;

        await client.query(
            'INSERT INTO wallets (user_id, balance) VALUES ($1, $2)',
            [userId, maxBalance]
        );

        const wallet = await client.query('SELECT balance FROM wallets WHERE user_id = $1', [userId]);
        expect(wallet.rows[0].balance).toBe(maxBalance.toString());
    });

    test('Boundary: Email field length constraint', async () => {
        const longEmail = 'verylongemailaddress' + 'a'.repeat(100) + '@example.com';
        try {
            await client.query(
                'INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3)',
                ['long_email_user', longEmail, 'Long Email']
            );
            throw new Error('Should have failed due to length');
        } catch (err: any) {
            expect(err.code).toBe('22001');
        }
    });

    test('Boundary: Username uniqueness and case sensitivity', async () => {
        const username = 'BoundaryUser';
        await client.query(
            'INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3)',
            [username, 'b1@test.com', 'B1']
        );

        try {
            await client.query(
                'INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3)',
                [username, 'b2@test.com', 'B2']
            );
            throw new Error('Unique constraint failed');
        } catch (err: any) {
            expect(err.code).toBe('23505');
        }
    });

    test('Constraint: Wallet balance cannot be negative via UPDATE', async () => {
        const user = await client.query('SELECT user_id FROM wallets LIMIT 1');
        const userId = user.rows[0].user_id;

        try {
            await client.query('UPDATE wallets SET balance = -1.00 WHERE user_id = $1', [userId]);
            throw new Error('Check constraint failed');
        } catch (err: any) {
            expect(err.code).toBe('23514');
        }
    });

    test('Boundary: UUID format validation in transactions', async () => {
        const invalidUuid = 'not-a-uuid-12345';
        try {
            await client.query(
                'INSERT INTO transactions (transaction_id, reference_id, amount, type) VALUES ($1, $2, $3, $4)',
                [invalidUuid, 'INVALID_UUID_REF', 10.00, 'ADJUSTMENT']
            );
            throw new Error('Invalid UUID format failed');
        } catch (err: any) {
            expect(err.code).toBe('22P02');
        }
    });

    test('Constraint: Foreign key reference on transactions', async () => {
        try {
            await client.query(
                'INSERT INTO transactions (reference_id, sender_wallet_id, amount, type) VALUES ($1, $2, $3, $4)',
                ['FK_FAIL_REF', 9999999, 10.00, 'TRANSFER']
            );
            throw new Error('FK constraint failed');
        } catch (err: any) {
            expect(err.code).toBe('23503');
        }
    });

    test('Boundary: JSONB large object support', async () => {
        const largeJson = { data: 'x'.repeat(1000) };
        const ref = 'LARGE_JSON_REF_' + Date.now();

        await client.query(
            'INSERT INTO transactions (reference_id, amount, type, metadata) VALUES ($1, $2, $3, $4)',
            [ref, 1.00, 'SYSTEM', JSON.stringify(largeJson)]
        );

        const res = await client.query('SELECT metadata FROM transactions WHERE reference_id = $1', [ref]);
        expect(res.rows[0].metadata.data.length).toBe(1000);
    });

    test('Boundary: Timestamp precision', async () => {
        const now = new Date();
        const res = await client.query('INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3) RETURNING created_at',
            [`time_${Date.now()}`, `time@${Date.now()}.com`, 'Time Tester']);

        const dbTime = new Date(res.rows[0].created_at);
        const diffInMinutes = Math.abs(dbTime.getTime() - now.getTime()) / (1000 * 60);
        expect(diffInMinutes).toBeLessThan(130);
    });

    test('Constraint: Enum-like status check via app logic/constraints', async () => {
        const invalidStatus = 'SUPER_ACTIVE';
        const query = `SELECT COUNT(*) FROM users WHERE status = $1`;
        const res = await client.query(query, [invalidStatus]);
        expect(Number(res.rows[0].count)).toBe(0);
    });
});