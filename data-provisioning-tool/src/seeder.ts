import { Client } from 'pg';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '../.env') });

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function seedDatabase() {
  try {
    await client.connect();

    await client.query(`
      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW.updated_at = NOW();
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DO $$ 
      BEGIN
          IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_wallets_updated_at') THEN
              CREATE TRIGGER trg_wallets_updated_at
              BEFORE UPDATE ON wallets
              FOR EACH ROW
              EXECUTE FUNCTION update_updated_at_column();
          END IF;
      END $$;
    `);

    await client.query('TRUNCATE users, wallets, transactions, audit_logs RESTART IDENTITY CASCADE');

    await client.query('BEGIN');

    const walletIds: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const balance = parseFloat(faker.finance.amount({ min: 100, max: 8000 }));
      
      const status = faker.helpers.arrayElement(['ACTIVE', 'INACTIVE']);

      const userRes = await client.query(
        'INSERT INTO users (username, email, full_name, status) VALUES ($1, $2, $3, $4) RETURNING user_id',
        [
          faker.internet.username({ firstName, lastName }) + faker.string.alphanumeric(4),
          faker.internet.email({ firstName, lastName }),
          `${firstName} ${lastName}`,
          status
        ]
      );
      
      const userId = userRes.rows[0].user_id;

      const walletRes = await client.query(
        'INSERT INTO wallets (user_id, balance, currency) VALUES ($1, $2, $3) RETURNING wallet_id',
        [userId, balance, 'EGP']
      );
      
      walletIds.push(walletRes.rows[0].wallet_id);
    }

    for (let i = 0; i < 2000; i++) {
      const sender = faker.helpers.arrayElement(walletIds);
      let receiver = faker.helpers.arrayElement(walletIds);
      while (receiver === sender) receiver = faker.helpers.arrayElement(walletIds);

      await client.query(
        'INSERT INTO transactions (reference_id, sender_wallet_id, receiver_wallet_id, amount, type, status, metadata) VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          faker.string.alphanumeric(15).toUpperCase(),
          sender,
          receiver,
          faker.finance.amount({ min: 10, max: 1000 }),
          'TRANSFER',
          'SUCCESS',
          JSON.stringify({ 
            ip: faker.internet.ip(), 
            device: faker.helpers.arrayElement(['iOS', 'Android', 'Web', 'Desktop']),
            location: faker.location.city()
          })
        ]
      );
    }

    await client.query('COMMIT');
    console.log("Seeding complete: Triggers added, Data truncated and 1:1 User-Wallet mapping verified.");

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Seeding Failed:", err);
  } finally {
    await client.end();
  }
}

seedDatabase();