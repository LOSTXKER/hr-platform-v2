// Smoke test for Sprint 1.4 — OT requests
// Run: npx tsx scripts/smoke-sprint-1-4.ts

import { Pool } from "pg";
import { config } from "dotenv";
import {
  computeOtHours,
  estimatePay,
  multiplierFor,
  getWeeklyOtHours,
  createOtRequest,
  decideOtRequest,
  OtValidationError,
  OT_WEEKLY_CAP_HOURS,
} from "../src/lib/ot-service";

const ts = () => new Date().toISOString();
const log = (...a: unknown[]) => console.log(ts(), ...a);

async function main() {
  config({ path: ".env.local" });
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });

  log("Sprint 1.4 smoke starting...");

  // ============================================================
  // 1. computeOtHours
  // ============================================================
  log("\n[1] computeOtHours");
  const hourCases = [
    { s: 18 * 60, e: 21 * 60, expect: 3 }, // 18:00–21:00
    { s: 18 * 60, e: 19 * 60 + 30, expect: 1.5 }, // 18:00–19:30
    { s: 22 * 60, e: 2 * 60, expect: 4 }, // 22:00–02:00 (midnight cross)
    { s: 8 * 60, e: 8 * 60 + 45, expect: 0.75 }, // 45 min
  ];
  for (const c of hourCases) {
    const got = computeOtHours(c.s, c.e);
    if (got !== c.expect) throw new Error(`hours ${c.s}->${c.e}: expect ${c.expect}, got ${got}`);
    log(`  ✓ ${c.s}->${c.e} = ${got} hr`);
  }

  // ============================================================
  // 2. Multiplier + estimate pay
  // ============================================================
  log("\n[2] multiplier + estimatePay");
  if (multiplierFor("WEEKDAY") !== 1.5) throw new Error("weekday should be 1.5x");
  if (multiplierFor("WEEKEND") !== 3) throw new Error("weekend should be 3x");
  if (multiplierFor("HOLIDAY") !== 3) throw new Error("holiday should be 3x");
  log("  ✓ Multipliers: WEEKDAY 1.5x / WEEKEND 3x / HOLIDAY 3x");

  // Pay = hours × rate × multiplier
  // 3 hr × 200 baht/hr × 1.5 = 900
  const p1 = estimatePay(3, 200, "WEEKDAY");
  if (p1 !== 900) throw new Error(`weekday pay expect 900, got ${p1}`);
  // 4 hr × 200 × 3 = 2400
  const p2 = estimatePay(4, 200, "HOLIDAY");
  if (p2 !== 2400) throw new Error(`holiday pay expect 2400, got ${p2}`);
  log(`  ✓ Pay calc: 3hr×200×1.5=${p1}, 4hr×200×3=${p2}`);

  // ============================================================
  // 3. Setup org + employee
  // ============================================================
  log("\n[3] Setup org");
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'smoke-sprint14-%'`);
  const org = await pool.query(
    `INSERT INTO organizations (slug, name, updated_at) VALUES ('smoke-sprint14-a', 'Smoke OT', CURRENT_TIMESTAMP) RETURNING id`
  );
  const orgId = org.rows[0].id;
  const emp = await pool.query(
    `INSERT INTO employees (organization_id, employee_code, first_name_th, last_name_th, phone_primary, start_date, status, updated_at)
     VALUES ($1, 'EMP-OT1', 'OT', 'นามสกุล', '0812345678', '2026-04-01', 'PERMANENT', CURRENT_TIMESTAMP) RETURNING id`,
    [orgId]
  );
  const manager = await pool.query(
    `INSERT INTO employees (organization_id, employee_code, first_name_th, last_name_th, phone_primary, start_date, status, updated_at)
     VALUES ($1, 'MGR-OT1', 'MGR', 'นามสกุล', '0823456789', '2026-04-01', 'PERMANENT', CURRENT_TIMESTAMP) RETURNING id`,
    [orgId]
  );
  const empId = emp.rows[0].id;
  const managerId = manager.rows[0].id;
  log(`  ✓ Org ${orgId}, Emp ${empId}, Mgr ${managerId}`);

  // ============================================================
  // 4. Create OT request — within cap
  // ============================================================
  log("\n[4] Create OT request (within cap)");
  const r1 = await createOtRequest(orgId, {
    employeeId: empId,
    workDate: "2026-05-25", // a Monday in test week
    startMinutes: 18 * 60,
    endMinutes: 21 * 60, // 3 hr
    dayType: "WEEKDAY",
    hourlyRate: 200,
    reason: "OT close project",
  });
  if (Number(r1.hours) !== 3) throw new Error(`hours expect 3, got ${r1.hours}`);
  if (Number(r1.estimatedPay) !== 900) throw new Error(`pay expect 900, got ${r1.estimatedPay}`);
  log(`  ✓ OT 3 hr created, est ${r1.estimatedPay} baht`);

  // ============================================================
  // 5. Weekly cap enforcement on create (36 hr limit)
  // ============================================================
  log("\n[5] Weekly cap enforcement");
  // Add OT each day Tue-Fri (4 days × 8 hr = 32 hr, total 35 hr in week)
  for (const day of [26, 27, 28, 29]) {
    await createOtRequest(orgId, {
      employeeId: empId,
      workDate: `2026-05-${day}`,
      startMinutes: 18 * 60,
      endMinutes: 26 * 60 % 1440, // 18:00 → 02:00 = 8 hr
      reason: "long OT",
    });
  }
  const weekHours = await getWeeklyOtHours(orgId, empId, new Date("2026-05-25"));
  log(`  ✓ Week total: ${weekHours} hr (3 + 4×8 = 35)`);

  // Adding 2 more hours = 37 total → should reject
  try {
    await createOtRequest(orgId, {
      employeeId: empId,
      workDate: "2026-05-30",
      startMinutes: 18 * 60,
      endMinutes: 20 * 60, // 2 hr → 37 total > 36 cap
      reason: "would exceed",
    });
    throw new Error("should reject — cap exceeded");
  } catch (e) {
    if (!(e instanceof OtValidationError) || e.field !== "hours") {
      throw new Error(`Expected cap rejection, got: ${(e as Error).message}`);
    }
    log(`  ✓ Cap blocks: 35 + 2 > ${OT_WEEKLY_CAP_HOURS} → rejected`);
  }

  // Adding 1 hour = 36 total → exactly at cap, should allow
  const edge = await createOtRequest(orgId, {
    employeeId: empId,
    workDate: "2026-05-30",
    startMinutes: 18 * 60,
    endMinutes: 19 * 60, // 1 hr → 36 total = cap
    reason: "at cap",
  });
  log(`  ✓ At-cap allowed: 36 hr (boundary)`);

  // ============================================================
  // 6. Approve
  // ============================================================
  log("\n[6] Approve");
  const approved = await decideOtRequest(orgId, r1.id, "APPROVED", managerId, "ok");
  if (approved?.status !== "APPROVED") throw new Error("approve failed");
  log(`  ✓ Approved by manager`);

  // ============================================================
  // 7. Cannot re-decide
  // ============================================================
  log("\n[7] Re-decide rejected");
  try {
    await decideOtRequest(orgId, r1.id, "REJECTED", managerId);
    throw new Error("should reject re-decide");
  } catch (e) {
    if (!(e instanceof OtValidationError) || e.field !== "status") {
      throw new Error(`Expected status error, got: ${(e as Error).message}`);
    }
    log(`  ✓ Already APPROVED → cannot re-decide`);
  }

  // ============================================================
  // 8. CHECK constraints
  // ============================================================
  log("\n[8] CHECK constraints");
  try {
    await pool.query(
      `INSERT INTO ot_requests (organization_id, employee_id, work_date, start_minutes, end_minutes, hours, reason, updated_at)
       VALUES ($1, $2, '2026-06-01', 2000, 100, 1, 'bad start', CURRENT_TIMESTAMP)`,
      [orgId, empId]
    );
    throw new Error("should fail start_range");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("start_range")) {
      throw new Error(`Expected start_range violation: ${(e as Error).message}`);
    }
    log(`  ✓ CHECK start_range blocks invalid start_minutes`);
  }
  try {
    await pool.query(
      `INSERT INTO ot_requests (organization_id, employee_id, work_date, start_minutes, end_minutes, hours, reason, updated_at)
       VALUES ($1, $2, '2026-06-01', 100, 200, 0, 'zero hr', CURRENT_TIMESTAMP)`,
      [orgId, empId]
    );
    throw new Error("should fail hours_positive");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("hours_positive")) {
      throw new Error(`Expected hours_positive violation: ${(e as Error).message}`);
    }
    log(`  ✓ CHECK hours_positive blocks zero/negative`);
  }

  // ============================================================
  // 9. Cascade
  // ============================================================
  log("\n[9] Cascade");
  await pool.query(`DELETE FROM employees WHERE id IN ($1, $2)`, [empId, managerId]);
  const left = await pool.query(
    `SELECT COUNT(*)::int AS c FROM ot_requests WHERE employee_id = $1`,
    [empId]
  );
  if (left.rows[0].c !== 0) throw new Error("cascade did not clean ot_requests");
  log(`  ✓ Cascade cleared ot_requests`);

  // Cleanup
  log("\n[10] Cleanup");
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'smoke-sprint14-%'`);
  await pool.end();
  log("\n✅ Sprint 1.4 smoke all passed");
}

main().catch((e) => {
  console.error("✗ Sprint 1.4 smoke failed:", e);
  process.exit(1);
});
