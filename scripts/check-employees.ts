import { Pool } from 'pg';
import { config } from 'dotenv';

async function main() {
  config({ path: '.env.local' });
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });
  const r1 = await pool.query("SELECT COUNT(*) FROM employees");
  console.log('employees count:', r1.rows[0].count);
  const r2 = await pool.query("SELECT id, organization_id, employee_code, first_name, last_name, status FROM employees");
  console.log(JSON.stringify(r2.rows, null, 2));
  await pool.end();
}

main().catch(e => { console.error('ERR:', e); process.exit(1); });
