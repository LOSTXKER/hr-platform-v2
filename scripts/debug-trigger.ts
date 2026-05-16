import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const pg = new Client({ connectionString: process.env.DIRECT_URL! });

async function main() {
  await pg.connect();

  // Try to manually invoke the trigger function with a fake auth.users row to see the real error
  // Need to insert into auth.users — only superuser/service can do this
  const testId = crypto.randomUUID();
  const email = `debug-${Date.now()}@test.local`;

  try {
    await pg.query("BEGIN");
    await pg.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data, instance_id, aud, role)
       VALUES ($1, $2, $3::jsonb, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated')`,
      [testId, email, JSON.stringify({ organization_name: "Debug", organization_slug: "debug-org" })]
    );
    console.log("✓ auth.users INSERT succeeded");
    await pg.query("ROLLBACK");
  } catch (err: any) {
    console.error("❌ auth.users INSERT failed:");
    console.error("   message:", err.message);
    console.error("   detail:", err.detail);
    console.error("   hint:", err.hint);
    console.error("   where:", err.where);
    await pg.query("ROLLBACK").catch(() => {});
  }

  await pg.end();
}

main().catch((e) => console.error(e));
