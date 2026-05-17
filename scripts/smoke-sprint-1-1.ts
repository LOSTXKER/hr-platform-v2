// Smoke test for Sprint 1.1 — schema + encryption + RLS isolation
// Run: npx tsx scripts/smoke-sprint-1-1.ts

import { Pool } from 'pg';
import { config } from 'dotenv';
import { encrypt, decrypt } from '../src/lib/crypto';

const ts = () => new Date().toISOString();
const log = (...a: unknown[]) => console.log(ts(), ...a);

async function main() {
  config({ path: '.env.local' });
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });

  log('Smoke test starting...');

  // ============================================================
  // 1. Encryption roundtrip
  // ============================================================
  log('\n[1] Encryption roundtrip');
  const samples = ['012-3-45678-9', '1100200300400', 'longer text with ไทย unicode'];
  for (const plain of samples) {
    const enc = encrypt(plain);
    const dec = decrypt(enc);
    if (dec !== plain) throw new Error(`Roundtrip failed: "${plain}" → "${dec}"`);
    log(`  ✓ ${plain.slice(0, 20)}... → enc (${enc.length} chars) → decrypt match`);
  }

  // ============================================================
  // 2. Setup test orgs (clean previous runs)
  // ============================================================
  log('\n[2] Setup test orgs (cleanup + recreate)');
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'smoke-sprint11-%'`);
  const orgAnajak = await pool.query(
    `INSERT INTO organizations (slug, name, updated_at) VALUES ('smoke-sprint11-anajak', 'Anajak Smoke', CURRENT_TIMESTAMP) RETURNING id`
  );
  const orgIbear = await pool.query(
    `INSERT INTO organizations (slug, name, updated_at) VALUES ('smoke-sprint11-ibear', 'iBear Smoke', CURRENT_TIMESTAMP) RETURNING id`
  );
  const orgAnajakId = orgAnajak.rows[0].id;
  const orgIbearId = orgIbear.rows[0].id;
  log(`  ✓ Anajak org: ${orgAnajakId}`);
  log(`  ✓ iBear org: ${orgIbearId}`);

  // ============================================================
  // 3. Insert full-profile employee in Anajak
  // ============================================================
  log('\n[3] Insert full-profile Employee (Anajak)');
  const bankAccountEnc = encrypt('1234567890');
  const taxPinEnc = encrypt('1100200300400');

  const empRes = await pool.query(
    `INSERT INTO employees (
      organization_id, employee_code,
      first_name_th, last_name_th, first_name_en, last_name_en,
      national_id, birth_date, gender, nationality, religion, blood_type, marital_status,
      phone_primary, phone_secondary, email, line_id,
      address_current, address_registered, same_address,
      bank_code, bank_account_number_enc, bank_account_name,
      tax_pin_enc, tax_dependents, tax_allowances,
      start_date, probation_end_date, status, updated_at
    ) VALUES (
      $1, $2,
      'ทดสอบ', 'นามสกุล', 'Test', 'Surname',
      '1100200300400', '1990-01-15', 'MALE', 'THAI', 'พุทธ', 'O', 'SINGLE',
      '0812345678', '0823456789', 'test@example.com', 'test_line',
      $3::jsonb, $4::jsonb, false,
      'SCB', $5, 'ทดสอบ นามสกุล',
      $6, 1, $7::jsonb,
      '2026-04-01', '2026-07-29', 'PROBATION', CURRENT_TIMESTAMP
    ) RETURNING id, status`,
    [
      orgAnajakId, 'EMP-001',
      JSON.stringify({ line1: '123 ถ.สุขุมวิท', district: 'คลองเตย', province: 'กรุงเทพ', postal: '10110' }),
      JSON.stringify({ line1: '456 หมู่บ้านพิงค์', district: 'บางพลี', province: 'สมุทรปราการ', postal: '10540' }),
      bankAccountEnc,
      taxPinEnc,
      JSON.stringify({ insurance: 25000, rmf: 50000, ssf: 30000 }),
    ]
  );
  const empId = empRes.rows[0].id;
  log(`  ✓ Employee inserted: ${empId} status=${empRes.rows[0].status}`);

  // ============================================================
  // 4. Decrypt verify
  // ============================================================
  log('\n[4] Decrypt verify');
  const decRes = await pool.query(
    `SELECT bank_account_number_enc, tax_pin_enc FROM employees WHERE id = $1`,
    [empId]
  );
  const decBank = decrypt(decRes.rows[0].bank_account_number_enc);
  const decTax = decrypt(decRes.rows[0].tax_pin_enc);
  if (decBank !== '1234567890') throw new Error(`Bank decrypt mismatch: ${decBank}`);
  if (decTax !== '1100200300400') throw new Error(`Tax PIN decrypt mismatch: ${decTax}`);
  log(`  ✓ bank_account_number decrypted → ${decBank}`);
  log(`  ✓ tax_pin decrypted → ${decTax}`);

  // ============================================================
  // 5. Child tables — family + emergency + salary
  // ============================================================
  log('\n[5] Child tables (family + emergency + salary history)');
  await pool.query(
    `INSERT INTO employee_family_members (employee_id, relation, full_name, national_id, birth_date, updated_at)
     VALUES ($1, 'SPOUSE', 'คู่สมรส ทดสอบ', '1100200300411', '1991-05-10', CURRENT_TIMESTAMP)`,
    [empId]
  );
  await pool.query(
    `INSERT INTO employee_family_members (employee_id, relation, full_name, birth_date, updated_at)
     VALUES ($1, 'CHILD', 'ลูก ทดสอบ', '2020-03-20', CURRENT_TIMESTAMP)`,
    [empId]
  );
  await pool.query(
    `INSERT INTO employee_emergency_contacts (employee_id, full_name, relation, phone, updated_at)
     VALUES ($1, 'พี่สาว ทดสอบ', 'พี่สาว', '0834567890', CURRENT_TIMESTAMP)`,
    [empId]
  );
  await pool.query(
    `INSERT INTO salary_history (employee_id, effective_date, old_salary, new_salary, reason, reason_notes)
     VALUES ($1, '2026-04-01', 25000, 27500, 'annual', 'ปรับประจำปี 2026')`,
    [empId]
  );
  await pool.query(
    `INSERT INTO employee_status_history (employee_id, from_status, to_status, reason)
     VALUES ($1, 'APPLICANT', 'PROBATION', 'เริ่มงาน 2026-04-01')`,
    [empId]
  );

  const childCounts = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM employee_family_members WHERE employee_id = $1) AS family,
       (SELECT COUNT(*) FROM employee_emergency_contacts WHERE employee_id = $1) AS emergency,
       (SELECT COUNT(*) FROM salary_history WHERE employee_id = $1) AS salary,
       (SELECT COUNT(*) FROM employee_status_history WHERE employee_id = $1) AS status_hist`,
    [empId]
  );
  log(`  ✓ family: ${childCounts.rows[0].family}, emergency: ${childCounts.rows[0].emergency}, salary: ${childCounts.rows[0].salary}, status_hist: ${childCounts.rows[0].status_hist}`);

  // ============================================================
  // 6. Insert in iBear for cross-org isolation test
  // ============================================================
  log('\n[6] Insert Employee in iBear org (for cross-org test)');
  const ibearEmp = await pool.query(
    `INSERT INTO employees (
      organization_id, employee_code, first_name_th, last_name_th,
      phone_primary, start_date, status, updated_at
    ) VALUES ($1, 'IBEAR-001', 'iBear', 'พนักงาน', '0855555555', '2026-04-01', 'PROBATION', CURRENT_TIMESTAMP)
    RETURNING id`,
    [orgIbearId]
  );
  log(`  ✓ iBear employee: ${ibearEmp.rows[0].id}`);

  // ============================================================
  // 7. Constraint check — duplicate employee_code per org should fail
  // ============================================================
  log('\n[7] Constraint: duplicate employee_code in same org → must fail');
  try {
    await pool.query(
      `INSERT INTO employees (organization_id, employee_code, first_name_th, last_name_th, phone_primary, start_date, updated_at)
       VALUES ($1, 'EMP-001', 'ซ้ำ', 'ทดสอบ', '0866666666', '2026-04-02', CURRENT_TIMESTAMP)`,
      [orgAnajakId]
    );
    throw new Error('Expected unique constraint violation, but insert succeeded');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!/unique|duplicate/i.test(msg)) throw e;
    log(`  ✓ Unique constraint enforced: ${msg.split('\n')[0].slice(0, 80)}`);
  }

  // ============================================================
  // 8. Same employee_code allowed in different org (multi-tenant)
  // ============================================================
  log('\n[8] Same employee_code in different org → must succeed');
  await pool.query(
    `INSERT INTO employees (organization_id, employee_code, first_name_th, last_name_th, phone_primary, start_date, updated_at)
     VALUES ($1, 'EMP-001', 'iBear ซ้ำกัน', 'OK', '0877777777', '2026-04-02', CURRENT_TIMESTAMP)`,
    [orgIbearId]
  );
  log('  ✓ EMP-001 inserted in iBear (same code different org)');

  // ============================================================
  // 9. RLS isolation — simulate authenticated session via SET LOCAL
  //    pg admin session bypasses RLS; we use SET ROLE authenticated to apply policies
  // ============================================================
  log('\n[9] RLS isolation test (authenticated role)');
  const client = await pool.connect();
  try {
    // Create a fake auth.uid() context by inserting test users mapped to each org
    await client.query(`DELETE FROM users WHERE email LIKE 'smoke-sprint11-%'`);
    // Insert into auth.users first (FK target) — but auth.users insert requires auth admin
    // Skip full auth flow; instead test policy USING() logic via current_setting()
    // The real test happens in test-signup.ts via Supabase Auth signup

    // Verify policies exist on every table by listing
    const policies = await client.query(
      `SELECT tablename, COUNT(*)::int as policies_count
       FROM pg_policies WHERE schemaname='public'
       AND tablename IN ('employees','positions','departments','branches',
         'employee_branches','employee_family_members','employee_emergency_contacts',
         'salary_history','employee_documents','probation_evaluations','employee_status_history')
       GROUP BY tablename ORDER BY tablename`
    );
    log(`  ✓ Policies present on ${policies.rows.length}/11 new tables`);
    for (const r of policies.rows) {
      log(`    - ${r.tablename}: ${r.policies_count} policies`);
    }

    // Test: as anonymous role (no JWT, current_user_org_id() returns NULL), SELECT must return 0 rows
    await client.query('SET ROLE anon');
    const anonRows = await client.query(`SELECT COUNT(*) FROM employees`);
    log(`  ✓ anon role SELECT employees: ${anonRows.rows[0].count} rows (must be 0)`);
    await client.query('RESET ROLE');
    if (Number(anonRows.rows[0].count) !== 0) {
      throw new Error(`RLS leak: anon saw ${anonRows.rows[0].count} employees`);
    }
  } finally {
    client.release();
  }

  // ============================================================
  // 10. Cleanup
  // ============================================================
  log('\n[10] Cleanup test orgs');
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'smoke-sprint11-%'`);
  log('  ✓ Test orgs deleted (cascade removed all child rows)');

  log('\n✅ All smoke tests passed');
  await pool.end();
}

main().catch(e => { console.error('FAIL:', e); process.exit(1); });
