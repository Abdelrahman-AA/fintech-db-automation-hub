import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { UserRepository } from '../repositories/UserRepository';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

test.describe('User Entity Validation', () => {
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

  test('Positive: Validate existing seeded users structure', async () => {
    const users = await userRepo.getRecentlyCreatedUsers(5);
    expect(users.length).toBeGreaterThan(0);
    
    for (const user of users) {
      expect(user.user_id).toBeDefined();
      expect(user.username).not.toBeNull();
      expect(user.email).toContain('@');
      expect(['ACTIVE', 'INACTIVE', 'BANNED']).toContain(user.status);
    }
  });

  test('Negative: Prevent duplicate emails', async () => {
    const duplicates = await userRepo.getDuplicateEmails();
    expect(duplicates.length).toBe(0);
  });

  test('Negative: Prevent duplicate usernames', async () => {
    const duplicates = await userRepo.getDuplicateUsernames();
    expect(duplicates.length).toBe(0);
  });

  test('Negative: Attempt to insert user with null email', async () => {
    try {
      await client.query('INSERT INTO users (username, full_name) VALUES ($1, $2)', ['null_test', 'Null Test']);
      throw new Error('Should have thrown NOT NULL constraint error');
    } catch (err: any) {
      expect(err.code).toBe('23502');
    }
  });

  test('Negative: Attempt to insert duplicate username directly', async () => {
    const existingUser = (await userRepo.getRecentlyCreatedUsers(1))[0];
    try {
      await client.query('INSERT INTO users (username, email, full_name) VALUES ($1, $2, $3)', 
        [existingUser.username, 'new_email@test.com', 'Duplicate User']);
      throw new Error('Should have thrown UNIQUE constraint error');
    } catch (err: any) {
      expect(err.code).toBe('23505');
    }
  });

  test('Validation: All users must have a full name', async () => {
    const query = 'SELECT COUNT(*) FROM users WHERE full_name IS NULL OR full_name = \'\'';
    const res = await client.query(query);
    expect(Number(res.rows[0].count)).toBe(0);
  });

  test('Validation: Created_at should be a valid past or present date', async () => {
    const query = 'SELECT created_at FROM users LIMIT 10';
    const res = await client.query(query);
    const now = new Date();
    for (const row of res.rows) {
      expect(new Date(row.created_at).getTime()).toBeLessThanOrEqual(now.getTime());
    }
  });

  test('Integrity: Users with DELETED status must have deleted_at timestamp', async () => {
    const query = 'SELECT * FROM users WHERE status = \'DELETED\' AND deleted_at IS NULL';
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Positive: Check email format consistency across all records', async () => {
    const query = 'SELECT email FROM users WHERE email !~* \'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$\'';
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Boundary: Username length check', async () => {
    const query = 'SELECT username FROM users WHERE LENGTH(username) > 50';
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });
});