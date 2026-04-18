import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
  dbUrl = process.env.DATABASE_URL;
}

console.log("Checking Connection String...");
if (!dbUrl || dbUrl.includes('base')) {
  throw new Error("CRITICAL: DATABASE_URL is missing or invalid (found 'base'). Check GitHub Secrets!");
}

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
});

async function initializeSandbox() {
  try {
    await client.connect();

    const schemaSQL = `
      DROP TABLE IF EXISTS audit_logs;
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS wallets;
      DROP TABLE IF EXISTS users;

      CREATE TABLE users (
        user_id SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        status VARCHAR(20) DEFAULT 'ACTIVE', 
        deleted_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE wallets (
        wallet_id SERIAL PRIMARY KEY,
        user_id INT UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
        balance DECIMAL(15, 2) DEFAULT 0.00 CHECK (balance >= 0),
        currency VARCHAR(3) DEFAULT 'EGP',
        version INT DEFAULT 1,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE transactions (
        transaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        reference_id VARCHAR(100) UNIQUE NOT NULL,
        sender_wallet_id INT REFERENCES wallets(wallet_id),
        receiver_wallet_id INT REFERENCES wallets(wallet_id),
        amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
        type VARCHAR(20) NOT NULL, 
        status VARCHAR(20) DEFAULT 'SUCCESS',
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE audit_logs (
        log_id SERIAL PRIMARY KEY,
        table_name VARCHAR(50) NOT NULL,
        record_id VARCHAR(100) NOT NULL,
        action VARCHAR(20) NOT NULL, 
        old_value JSONB,
        new_value JSONB,
        changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      CREATE TRIGGER trg_wallets_updated_at
      BEFORE UPDATE ON wallets
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
    `;

    await client.query(schemaSQL);
    console.log("Database Schema Initialized with 4 Tables and Auto-Update Trigger.");

  } catch (err) {
    console.error("Initialization Error:", err);
  } finally {
    await client.end();
  }
}

initializeSandbox();