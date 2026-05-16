// Phase 0 verification — run after migration + RLS
// npx tsx scripts/verify-phase-0.ts

import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DIRECT_URL or DATABASE_URL missing");

const client = new Client({ connectionString: url });

async function main() {
  await client.connect();

  // 1. Tables exist
  const tables = await client.query<{ table_name: string }>(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('organizations', 'users', 'employees')
    ORDER BY table_name
  `);
  console.log(`✓ Tables (${tables.rows.length}/3):`, tables.rows.map((r) => r.table_name).join(", "));

  // 2. RLS enabled
  const rls = await client.query<{ tablename: string; rowsecurity: boolean }>(`
    SELECT tablename, rowsecurity FROM pg_tables
    WHERE schemaname = 'public' AND tablename IN ('organizations', 'users', 'employees')
    ORDER BY tablename
  `);
  console.log(`✓ RLS enabled:`);
  rls.rows.forEach((r) => console.log(`  ${r.tablename}: ${r.rowsecurity ? "YES" : "NO"}`));

  // 3. Policies count per table
  const policies = await client.query<{ tablename: string; count: string }>(`
    SELECT tablename, COUNT(*) AS count FROM pg_policies
    WHERE schemaname = 'public' AND tablename IN ('organizations', 'users', 'employees')
    GROUP BY tablename ORDER BY tablename
  `);
  console.log(`✓ Policies:`);
  policies.rows.forEach((r) => console.log(`  ${r.tablename}: ${r.count} policies`));

  // 4. Helper functions
  const funcs = await client.query<{ proname: string }>(`
    SELECT proname FROM pg_proc
    WHERE pronamespace = 'public'::regnamespace
    AND proname IN ('current_user_org_id', 'current_user_role')
    ORDER BY proname
  `);
  console.log(`✓ Helper functions (${funcs.rows.length}/2):`, funcs.rows.map((r) => r.proname).join(", "));

  // 5. Enums
  const enums = await client.query<{ typname: string }>(`
    SELECT typname FROM pg_type
    WHERE typnamespace = 'public'::regnamespace AND typtype = 'e'
    ORDER BY typname
  `);
  console.log(`✓ Enums (${enums.rows.length}):`, enums.rows.map((r) => r.typname).join(", "));

  await client.end();
  console.log("\n✅ Phase 0 verification complete");
}

main().catch((err) => {
  console.error("❌ Verification failed:", err);
  process.exit(1);
});
