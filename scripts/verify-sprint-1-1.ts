import { Pool } from 'pg';
import { config } from 'dotenv';

async function main() {
  config({ path: '.env.local' });
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });

  console.log('=== Sprint 1.1 schema verification ===\n');

  const expectedTables = [
    'organizations', 'users', 'employees',
    'positions', 'departments', 'branches',
    'employee_branches', 'employee_family_members', 'employee_emergency_contacts',
    'salary_history', 'employee_documents', 'probation_evaluations', 'employee_status_history'
  ];

  console.log('--- Tables ---');
  const t = await pool.query(
    `SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
  );
  const found = new Set(t.rows.map(r => r.tablename));
  for (const name of expectedTables) {
    console.log(`  ${found.has(name) ? '✓' : '✗'} ${name}`);
  }

  console.log('\n--- Enums ---');
  const expectedEnums = ['Role', 'EmployeeStatus', 'Gender', 'BloodType', 'MaritalStatus', 'FamilyRelation', 'DocumentType', 'ProbationDecision'];
  const e = await pool.query(
    `SELECT typname FROM pg_type WHERE typtype='e' AND typname IN (${expectedEnums.map((_,i)=>`$${i+1}`).join(',')})`,
    expectedEnums
  );
  const foundEnums = new Set(e.rows.map(r => r.typname));
  for (const name of expectedEnums) {
    console.log(`  ${foundEnums.has(name) ? '✓' : '✗'} ${name}`);
  }

  console.log('\n--- EmployeeStatus values ---');
  const v = await pool.query(`SELECT unnest(enum_range(NULL::"EmployeeStatus"))::text AS val`);
  console.log('  ', v.rows.map(r => r.val).join(', '));

  console.log('\n--- RLS enabled ---');
  const rls = await pool.query(
    `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1::text[]) ORDER BY tablename`,
    [expectedTables]
  );
  for (const r of rls.rows) {
    console.log(`  ${r.rowsecurity ? '✓' : '✗'} ${r.tablename}`);
  }

  console.log('\n--- Policies per table ---');
  const p = await pool.query(
    `SELECT tablename, COUNT(*) as n FROM pg_policies WHERE schemaname='public' AND tablename = ANY($1::text[]) GROUP BY tablename ORDER BY tablename`,
    [expectedTables]
  );
  for (const r of p.rows) {
    console.log(`  ${r.tablename}: ${r.n} policies`);
  }

  console.log('\n--- Employee columns count ---');
  const c = await pool.query(
    `SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='employees'`
  );
  console.log(`  employees: ${c.rows[0].count} columns (expected ≥ 40)`);

  console.log('\n--- FK constraints from employees ---');
  const fk = await pool.query(
    `SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid = 'public.employees'::regclass AND contype='f' ORDER BY conname`
  );
  for (const r of fk.rows) {
    console.log(`  ${r.conname}: ${r.def}`);
  }

  await pool.end();
}

main().catch(e => { console.error('ERR:', e); process.exit(1); });
