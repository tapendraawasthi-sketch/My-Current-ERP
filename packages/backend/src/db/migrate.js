import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import pg from "pg";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function getPool() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new Pool({ connectionString, max: 5 });
}

async function tableExists(client, tableName) {
  const result = await client.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1
     ) AS exists`,
    [tableName],
  );
  return result.rows[0]?.exists === true;
}

async function runKhataMigrations(client) {
  await client.query(`
    ALTER TABLE parties
      ADD COLUMN IF NOT EXISTS is_khata_created BOOLEAN NOT NULL DEFAULT FALSE;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS khata_account_code_templates (
      code            TEXT PRIMARY KEY,
      name            TEXT NOT NULL,
      account_type    TEXT NOT NULL
    );
  `);

  await client.query(`
    INSERT INTO khata_account_code_templates (code, name, account_type) VALUES
      ('KH-DEBT', 'Khata Debtors',   'asset'),
      ('KH-CRED', 'Khata Creditors', 'liability'),
      ('KH-SALE', 'Khata Sales',     'income'),
      ('KH-PUR',  'Khata Purchases', 'expense'),
      ('KH-EXP',  'Khata Expenses',  'expense'),
      ('KH-CASH', 'Khata Cash',      'asset')
    ON CONFLICT (code) DO NOTHING;
  `);

  await client.query(`
    CREATE OR REPLACE FUNCTION seed_khata_chart_of_accounts(
      p_tenant_id UUID,
      p_company_id UUID
    ) RETURNS void AS $$
    BEGIN
      INSERT INTO chart_of_accounts (
        tenant_id, company_id, code, name, account_type, level, is_group, is_active
      )
      SELECT
        p_tenant_id,
        p_company_id,
        t.code,
        t.name,
        t.account_type,
        'ledger',
        FALSE,
        TRUE
      FROM khata_account_code_templates t
      ON CONFLICT (tenant_id, company_id, code) DO NOTHING;
    END;
    $$ LANGUAGE plpgsql;
  `);

  await client.query(`
    CREATE TABLE IF NOT EXISTS khata_transactions (
      id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      tenant_id                 UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
      company_id                UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      voucher_id                UUID NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
      chat_source_text          TEXT,
      detected_party_name_raw   TEXT,
      item_description_raw      TEXT,
      sync_status               TEXT NOT NULL DEFAULT 'synced'
        CHECK (sync_status IN ('pending', 'synced', 'failed')),
      created_offline           BOOLEAN NOT NULL DEFAULT FALSE,
      created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_khata_transactions_voucher
      ON khata_transactions(voucher_id);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_khata_transactions_tenant_company
      ON khata_transactions(tenant_id, company_id);
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_khata_transactions_sync_status
      ON khata_transactions(tenant_id, company_id, sync_status);
  `);

  const companies = await client.query(`SELECT tenant_id, id FROM companies`);
  for (const row of companies.rows) {
    await client.query(`SELECT seed_khata_chart_of_accounts($1, $2)`, [
      row.tenant_id,
      row.id,
    ]);
  }
}

async function runIdempotencyKeyMigration(client) {
  await client.query(`
    ALTER TABLE vouchers
      ADD COLUMN IF NOT EXISTS idempotency_key UUID;
  `);
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_idempotency_key
      ON vouchers(idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  `);
}

export async function runMigrations() {
  const pool = getPool();
  const client = await pool.connect();
  console.log("Running Mobile Khata / ERP database migrations...");

  try {
    await client.query("BEGIN");

    const hasTenants = await tableExists(client, "tenants");
    if (!hasTenants) {
      const schemaPath = path.join(__dirname, "schema.sql");
      const schemaSql = fs.readFileSync(schemaPath, "utf8");
      await client.query(schemaSql);
      console.log("Applied full schema.sql");
    } else {
      await runKhataMigrations(client);
      console.log("Applied Khata schema extensions");
    }

    await runIdempotencyKeyMigration(client);
    console.log("Applied idempotency_key migration");

    await client.query("COMMIT");
    console.log("Database migrations completed successfully.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error running migrations:", err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  runMigrations().catch(() => process.exit(1));
}
