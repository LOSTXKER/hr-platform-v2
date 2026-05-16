// E2E test — signup flow + trigger + RLS
// npx tsx scripts/test-signup.ts

import { createClient } from "@supabase/supabase-js";
import { Client } from "pg";
import { config } from "dotenv";

config({ path: ".env.local" });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!, // service role — bypasses RLS for cleanup
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const pg = new Client({ connectionString: process.env.DIRECT_URL! });

async function main() {
  await pg.connect();

  const stamp = Date.now();
  const email = `test+${stamp}@hr2-test.local`;
  const orgSlug = `test-org-${stamp}`;
  const orgName = "Test Org";

  console.log(`→ signup: ${email}`);

  // 1. Sign up via Supabase Auth admin API (bypasses email confirm)
  const { data: signupData, error: signupErr } = await supabase.auth.admin.createUser({
    email,
    password: "TestPass123!",
    email_confirm: true,
    user_metadata: { organization_name: orgName, organization_slug: orgSlug },
  });

  if (signupErr) throw new Error(`Signup failed: ${signupErr.message}`);
  const userId = signupData.user!.id;
  console.log(`  user_id: ${userId}`);

  // 2. Verify trigger fired — public.users + public.organizations populated
  const userRow = await pg.query<{ id: string; email: string; role: string; organization_id: string }>(
    `SELECT id, email, role, organization_id FROM public.users WHERE id = $1`,
    [userId]
  );
  if (userRow.rows.length === 0) throw new Error("Trigger failed: no users row");
  console.log(`✓ users row: role=${userRow.rows[0].role} org=${userRow.rows[0].organization_id.slice(0, 8)}`);

  const orgRow = await pg.query<{ slug: string; name: string }>(
    `SELECT slug, name FROM public.organizations WHERE id = $1`,
    [userRow.rows[0].organization_id]
  );
  if (orgRow.rows.length === 0) throw new Error("Trigger failed: no organizations row");
  console.log(`✓ organizations row: slug=${orgRow.rows[0].slug} name="${orgRow.rows[0].name}"`);

  if (orgRow.rows[0].slug !== orgSlug) throw new Error(`Slug mismatch: expected ${orgSlug} got ${orgRow.rows[0].slug}`);
  if (userRow.rows[0].role !== "OWNER") throw new Error(`Role mismatch: expected OWNER got ${userRow.rows[0].role}`);

  // 3. Multi-tenant isolation test — create 2nd user/org, verify cross-org blocked
  const email2 = `test+${stamp}-b@hr2-test.local`;
  const orgSlug2 = `test-org-${stamp}-b`;
  const { data: signup2 } = await supabase.auth.admin.createUser({
    email: email2,
    password: "TestPass123!",
    email_confirm: true,
    user_metadata: { organization_name: "Org B", organization_slug: orgSlug2 },
  });
  console.log(`  user_id_2: ${signup2.user!.id}`);

  // 4. Sign in as user A and try to read org B (should be blocked by RLS)
  const supabaseA = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { error: loginErr } = await supabaseA.auth.signInWithPassword({ email, password: "TestPass123!" });
  if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);

  const { data: orgsForA, error: rlsErr } = await supabaseA.from("organizations").select("id, slug, name");
  if (rlsErr) throw new Error(`Org select failed: ${rlsErr.message}`);

  console.log(`✓ RLS: user A sees ${orgsForA?.length ?? 0} org(s) (expected 1)`);
  if ((orgsForA?.length ?? 0) !== 1) throw new Error(`RLS leak: expected 1 org, got ${orgsForA?.length}`);
  if (orgsForA![0].slug !== orgSlug) throw new Error(`Wrong org visible: expected ${orgSlug}`);

  // Cleanup
  console.log(`→ cleanup`);
  await supabase.auth.admin.deleteUser(userId);
  await supabase.auth.admin.deleteUser(signup2.user!.id);

  // Verify cascade — when auth user deleted, no public.users row remains?
  // Actually we don't have ON DELETE CASCADE from auth.users → public.users
  // So manually clean (Phase 1 should add FK with cascade)
  await pg.query(`DELETE FROM public.users WHERE id IN ($1, $2)`, [userId, signup2.user!.id]);
  await pg.query(`DELETE FROM public.organizations WHERE slug IN ($1, $2)`, [orgSlug, orgSlug2]);

  await pg.end();
  console.log("\n✅ E2E signup + trigger + RLS test PASSED");
}

main().catch(async (err) => {
  console.error("❌", err.message);
  await pg.end().catch(() => {});
  process.exit(1);
});
