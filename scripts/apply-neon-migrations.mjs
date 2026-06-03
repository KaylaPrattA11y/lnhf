import { readFileSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { Client } from 'pg';

function loadEnvFile(filePath) {
  try {
    const envText = readFileSync(filePath, 'utf8');
    for (const line of envText.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const equalsIndex = trimmed.indexOf('=');
      if (equalsIndex === -1) continue;
      const key = trimmed.slice(0, equalsIndex).trim();
      if (!key || process.env[key]) continue;
      let value = trimmed.slice(equalsIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // No .env file present; fall back to existing environment variables.
  }
}

loadEnvFile(path.resolve('.env'));

const databaseUrl = process.env.DATABASE_URL ?? process.env.NETLIFY_WEDDINGS_DB_URL ?? process.env.NETLIFY_TOURS_DB_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL or NETLIFY_WEDDINGS_DB_URL/NETLIFY_TOURS_DB_URL is required');
  process.exit(1);
}

const migrationsRoot = path.resolve('netlify/database/migrations');
const migrationDirectories = (await readdir(migrationsRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

const client = new Client({ connectionString: databaseUrl });
await client.connect();

try {
  for (const directory of migrationDirectories) {
    const migrationPath = path.join(migrationsRoot, directory, 'migration.sql');
    const sql = await readFile(migrationPath, 'utf8');

    if (!sql.trim()) {
      continue;
    }

    console.log(`Applying ${path.relative(process.cwd(), migrationPath)}`);
    await client.query(sql);
  }
} finally {
  await client.end();
}
