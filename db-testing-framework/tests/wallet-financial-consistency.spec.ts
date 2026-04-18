import { test, expect } from '@playwright/test';
import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { WalletRepository } from '../repositories/WalletRepository';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

test.describe('Wallet Financial Consistency', () => {
  let client: Client;
  let walletRepo: WalletRepository;

  test.beforeAll(async () => {
    client = new Client({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    walletRepo = new WalletRepository(client);
  });

  test.afterAll(async () => {
    await client.end();
  });

  test('Positive: All wallets must have a positive or zero balance', async () => {
    const negativeWallets = await walletRepo.getNegativeBalanceWallets();
    expect(negativeWallets.length).toBe(0);
  });

test('Positive: Verify wallet count matches user count', async () => {
  const userRes = await client.query('SELECT COUNT(*) FROM users WHERE user_id <= 1000');
  const walletRes = await client.query('SELECT COUNT(*) FROM wallets WHERE user_id <= 1000');
  
  const userCount = parseInt(userRes.rows[0].count);
  const walletCount = parseInt(walletRes.rows[0].count);

  expect(walletCount).toBe(userCount);
  expect(userCount).toBe(1000);
});

  test('Negative: Prevent inserting wallet with negative balance', async () => {
    try {
      await client.query('INSERT INTO wallets (user_id, balance, currency) VALUES (1, -100.00, \'EGP\')');
      throw new Error('Should have thrown check constraint error');
    } catch (err: any) {
      expect(err.code).toBe('23514');
    }
  });

  test('Negative: Prevent multiple wallets for the same user', async () => {
    const duplicates = await walletRepo.checkDuplicateWalletsPerUser();
    expect(duplicates.length).toBe(0);
  });

  test('Integrity: Wallets must reference existing users', async () => {
    const orphans = await walletRepo.getOrphanedWallets();
    expect(orphans.length).toBe(0);
  });

  test('Data Consistency: Currency must be exactly 3 characters (ISO)', async () => {
    const query = 'SELECT currency FROM wallets WHERE LENGTH(currency) != 3';
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Financial Logic: Sum of all wallet balances must be correct', async () => {
    const totalByQuery = await walletRepo.getTotalBalanceByCurrency('EGP');
    const individualSumRes = await client.query('SELECT SUM(balance) as manual_sum FROM wallets WHERE currency = \'EGP\'');
    const manualSum = parseFloat(individualSumRes.rows[0].manual_sum);
    expect(totalByQuery).toBe(manualSum);
  });

  test('Version Control: Wallet version should be at least 1', async () => {
    const query = 'SELECT COUNT(*) FROM wallets WHERE version < 1';
    const res = await client.query(query);
    expect(Number(res.rows[0].count)).toBe(0);
  });

  test('Precision: Verify balance decimal places do not exceed 2', async () => {
    const query = 'SELECT balance FROM wallets WHERE balance::text ~ \'\\.[0-9]{3,}\'';
    const res = await client.query(query);
    expect(res.rowCount).toBe(0);
  });

  test('Update Logic: updated_at should change on balance update', async () => {
    const wallet = (await walletRepo.getWalletsAboveBalance(0))[0];
    const originalTime = wallet.updated_at.getTime();

    await new Promise(resolve => setTimeout(resolve, 1000));

    await client.query('UPDATE wallets SET balance = balance + 1 WHERE wallet_id = $1', [wallet.wallet_id]);

    const updatedWallet = await walletRepo.getWalletById(wallet.wallet_id);
    expect(updatedWallet?.updated_at.getTime()).toBeGreaterThan(originalTime);
  });
});