/**
 * Apply SQL migrations to the Postgres backing even.
 *
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs
 *
 * If DATABASE_URL is not in the environment, .env.local is read as a
 * fallback (created by `vercel env pull` or `vercel integration add`).
 * Migrations are applied in filename order; each is executed once inside a
 * transaction. Already-applied migrations are skipped (table
 * _even_migrations tracks them).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
// Resolve pg from @even/store, which owns the database dependency.
const require = createRequire(join(root, "packages", "store", "package.json"));
const pg = require("pg");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const env = readFileSync(join(root, ".env.local"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith("DATABASE_URL="));
    if (line) return line.slice("DATABASE_URL=".length).trim().replace(/^"|"$/g, "");
  } catch {
    // no local env file
  }
  return null;
}

const connectionString = loadDatabaseUrl();
if (!connectionString) {
  console.error("DATABASE_URL is not set and no .env.local fallback was found");
  process.exit(1);
}

const migrationsDir = join(root, "packages", "store", "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new pg.Client({ connectionString });
await client.connect();

await client.query(`
  CREATE TABLE IF NOT EXISTS _even_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`);

for (const file of files) {
  const applied = await client.query("SELECT 1 FROM _even_migrations WHERE name = $1", [file]);
  if (applied.rowCount > 0) {
    console.log(`skip  ${file} (already applied)`);
    continue;
  }
  const sql = readFileSync(join(migrationsDir, file), "utf8");
  await client.query("BEGIN");
  try {
    await client.query(sql);
    await client.query("INSERT INTO _even_migrations (name) VALUES ($1)", [file]);
    await client.query("COMMIT");
    console.log(`apply ${file}`);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error(`fail  ${file}: ${err.message}`);
    process.exitCode = 1;
    break;
  }
}

await client.end();
