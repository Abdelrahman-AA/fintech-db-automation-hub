import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined in environment variables!");
}

const client = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function checkConnection() {
  try {
    await client.connect();
    const res = await client.query('SELECT NOW()');
    console.log("Connection Successful to Neon!");
    console.log("DB Server Time:", res.rows[0].now);
  } catch (err) {
    console.error("Connection Error:");
    console.error(err);
  } finally {
    await client.end();
  }
}

checkConnection();