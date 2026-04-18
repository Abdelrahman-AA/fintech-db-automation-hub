import { defineConfig } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error(
    "\nDATABASE_URL is missing!\n" +
    "Please ensure it is set in your .env file (locally) or in GitHub Secrets.\n"
  );
}

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  workers: 1,
});