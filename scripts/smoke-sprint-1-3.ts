// Smoke test for Sprint 1.3 — Leave management
// Run: npx tsx scripts/smoke-sprint-1-3.ts

import { Pool } from "pg";
import { config } from "dotenv";
import { countLeaveDays } from "../src/lib/leave-service";

const ts = () => new Date().toISOString();
const log = (...a: unknown[]) => console.log(ts(), ...a);

async function main() {
  config({ path: ".env.local" });
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });

  log("Sprint 1.3 smoke starting...");

  // ============================================================
  // 1. countLeaveDays pure function
  // ============================================================
  log("\n[1] countLeaveDays");
  const cases: Array<{ s: string; e: string; expect: number }> = [
    { s: "2026-05-22", e: "2026-05-22", expect: 1 },
    { s: "2026-05-22", e: "2026-05-23", expect: 2 },
    { s: "2026-05-22", e: "2026-05-28", expect: 7 },
    { s: "2026-05-22", e: "2026-06-21", expect: 31 },
  ];
  for (const c of cases) {
    const got = countLeaveDays(new Date(c.s), new Date(c.e));
    if (got !== c.expect) throw new Error(`${c.s} -> ${c.e}: expect ${c.expect}, got ${got}`);
    log(`  ✓ ${c.s} -> ${c.e} = ${got} days`);
  }

  // ============================================================
  // 2. Setup test org
  // ============================================================
  log("\n[2] Setup test org");
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'smoke-sprint13-%'`);
  const org = await pool.query(
    `INSERT INTO organizations (slug, name, updated_at) VALUES ('smoke-sprint13-a', 'Smoke L13', CURRENT_TIMESTAMP) RETURNING id`
  );
  const orgId = org.rows[0].id;
  log(`  ✓ Org: ${orgId}`);

  // ============================================================
  // 3. Create leave types (Thai standard)
  // ============================================================
  log("\n[3] Insert leave_types");
  const sick = await pool.query(
    `INSERT INTO leave_types (organization_id, code, name_th, default_quota_days, requires_attachment, attachment_threshold_days, updated_at)
     VALUES ($1, 'SICK', 'ลาป่วย', 30, false, 3, CURRENT_TIMESTAMP) RETURNING id`,
    [orgId]
  );
  const annual = await pool.query(
    `INSERT INTO leave_types (organization_id, code, name_th, default_quota_days, carryover_max_days, updated_at)
     VALUES ($1, 'ANNUAL', 'ลาพักร้อน', 6, 10, CURRENT_TIMESTAMP) RETURNING id`,
    [orgId]
  );
  const training = await pool.query(
    `INSERT INTO leave_types (organization_id, code, name_th, default_quota_days, deducts_quota, updated_at)
     VALUES ($1, 'TRAINING', 'ลาฝึกอบรม', 0, false, CURRENT_TIMESTAMP) RETURNING id`,
    [orgId]
  );
  const sickId = sick.rows[0].id;
  const annualId = annual.rows[0].id;
  const trainingId = training.rows[0].id;
  log(`  ✓ SICK: ${sickId}`);
  log(`  ✓ ANNUAL: ${annualId}`);
  log(`  ✓ TRAINING (no deduct): ${trainingId}`);

  // Unique constraint
  try {
    await pool.query(
      `INSERT INTO leave_types (organization_id, code, name_th, default_quota_days, updated_at) VALUES ($1, 'SICK', 'dup', 1, CURRENT_TIMESTAMP)`,
      [orgId]
    );
    throw new Error("should have failed unique (org, code)");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.toLowerCase().includes("duplicate")) {
      throw new Error(`Expected unique violation, got: ${(e as Error).message}`);
    }
    log(`  ✓ Unique (org, code) blocks duplicate`);
  }

  // ============================================================
  // 4. Insert employees
  // ============================================================
  log("\n[4] Insert employees");
  const emp = await pool.query(
    `INSERT INTO employees (organization_id, employee_code, first_name_th, last_name_th, phone_primary, start_date, status, updated_at)
     VALUES ($1, 'EMP-L1', 'ลาทดสอบ', 'นามสกุล', '0812345678', '2026-04-01', 'PERMANENT', CURRENT_TIMESTAMP) RETURNING id`,
    [orgId]
  );
  const manager = await pool.query(
    `INSERT INTO employees (organization_id, employee_code, first_name_th, last_name_th, phone_primary, start_date, status, updated_at)
     VALUES ($1, 'MGR-L1', 'หัวหน้า', 'นามสกุล', '0823456789', '2026-04-01', 'PERMANENT', CURRENT_TIMESTAMP) RETURNING id`,
    [orgId]
  );
  const empId = emp.rows[0].id;
  const managerId = manager.rows[0].id;
  log(`  ✓ Employee: ${empId}, Manager: ${managerId}`);

  // ============================================================
  // 5. Create leave requests
  // ============================================================
  log("\n[5] Create leave_requests");
  const r1 = await pool.query(
    `INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days, reason, status, updated_at)
     VALUES ($1, $2, $3, '2026-06-01', '2026-06-03', 3, 'พักร้อน', 'PENDING', CURRENT_TIMESTAMP) RETURNING id, status`,
    [orgId, empId, annualId]
  );
  log(`  ✓ Annual leave PENDING: ${r1.rows[0].id}`);

  // CHECK constraints
  try {
    await pool.query(
      `INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days, reason, updated_at)
       VALUES ($1, $2, $3, '2026-06-05', '2026-06-01', 1, 'bad range', CURRENT_TIMESTAMP)`,
      [orgId, empId, annualId]
    );
    throw new Error("should fail date_range check");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("date_range")) {
      throw new Error(`Expected date_range violation: ${(e as Error).message}`);
    }
    log(`  ✓ CHECK date_range blocks end < start`);
  }
  try {
    await pool.query(
      `INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days, reason, updated_at)
       VALUES ($1, $2, $3, '2026-06-05', '2026-06-05', 0, 'zero days', CURRENT_TIMESTAMP)`,
      [orgId, empId, annualId]
    );
    throw new Error("should fail days_positive check");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("days_positive")) {
      throw new Error(`Expected days_positive violation: ${(e as Error).message}`);
    }
    log(`  ✓ CHECK days_positive blocks zero/negative days`);
  }

  // ============================================================
  // 6. Approve flow
  // ============================================================
  log("\n[6] Approve");
  await pool.query(
    `UPDATE leave_requests SET status='APPROVED', approver_id=$1, decided_at=CURRENT_TIMESTAMP WHERE id=$2`,
    [managerId, r1.rows[0].id]
  );
  const after = await pool.query(`SELECT status, approver_id FROM leave_requests WHERE id=$1`, [
    r1.rows[0].id,
  ]);
  if (after.rows[0].status !== "APPROVED") throw new Error("approve failed");
  if (after.rows[0].approver_id !== managerId) throw new Error("approver_id mismatch");
  log(`  ✓ Approved by manager`);

  // ============================================================
  // 7. Balance compute via service (uses Prisma)
  // ============================================================
  log("\n[7] Balance compute");
  const { getLeaveBalance } = await import("../src/lib/leave-service");
  const bal = await getLeaveBalance(orgId, empId, annualId, 2026);
  if (bal.quota !== 6) throw new Error(`quota expected 6, got ${bal.quota}`);
  if (bal.used !== 3) throw new Error(`used expected 3, got ${bal.used}`);
  if (bal.remaining !== 3) throw new Error(`remaining expected 3, got ${bal.remaining}`);
  log(`  ✓ Annual balance: quota=${bal.quota} used=${bal.used} remaining=${bal.remaining}`);

  // ============================================================
  // 8. Pending counts against remaining (quota enforcement)
  // ============================================================
  log("\n[8] Pending consumes remaining");
  await pool.query(
    `INSERT INTO leave_requests (organization_id, employee_id, leave_type_id, start_date, end_date, days, reason, status, updated_at)
     VALUES ($1, $2, $3, '2026-07-01', '2026-07-02', 2, 'pending check', 'PENDING', CURRENT_TIMESTAMP)`,
    [orgId, empId, annualId]
  );
  const bal2 = await getLeaveBalance(orgId, empId, annualId, 2026);
  if (bal2.pending !== 2) throw new Error(`pending expected 2, got ${bal2.pending}`);
  if (bal2.remaining !== 1) throw new Error(`remaining expected 1, got ${bal2.remaining}`);
  log(`  ✓ Pending blocks remaining: pending=${bal2.pending} remaining=${bal2.remaining}`);

  // ============================================================
  // 9. Quota enforcement in service
  // ============================================================
  log("\n[9] createLeaveRequest enforces quota");
  const { createLeaveRequest, LeaveValidationError } = await import("../src/lib/leave-service");
  try {
    await createLeaveRequest(orgId, {
      employeeId: empId,
      leaveTypeId: annualId,
      startDate: "2026-08-01",
      endDate: "2026-08-10", // 10 days > remaining 1
      reason: "over quota test",
    });
    throw new Error("should have rejected over-quota request");
  } catch (e) {
    if (!(e instanceof LeaveValidationError) || e.field !== "days") {
      throw new Error(`Expected LeaveValidationError on days, got: ${(e as Error).message}`);
    }
    log(`  ✓ createLeaveRequest blocks over-quota`);
  }

  // ============================================================
  // 10. Non-deducting type ignores quota
  // ============================================================
  log("\n[10] Non-deducting type (TRAINING) bypasses quota");
  const trainingReq = await createLeaveRequest(orgId, {
    employeeId: empId,
    leaveTypeId: trainingId,
    startDate: "2026-09-01",
    endDate: "2026-09-05",
    reason: "training session",
  });
  if (trainingReq.status !== "PENDING") throw new Error("training request not pending");
  log(`  ✓ Training leave created (no quota check)`);

  // ============================================================
  // 11. FK Cascade
  // ============================================================
  log("\n[11] FK cascade on employee delete");
  await pool.query(`DELETE FROM employees WHERE id IN ($1, $2)`, [empId, managerId]);
  const left = await pool.query(
    `SELECT COUNT(*)::int AS c FROM leave_requests WHERE employee_id = $1`,
    [empId]
  );
  if (left.rows[0].c !== 0) throw new Error("cascade did not clean leave_requests");
  log(`  ✓ Cascade cleared leave_requests`);

  // Cleanup
  log("\n[12] Cleanup");
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'smoke-sprint13-%'`);
  await pool.end();
  log("\n✅ Sprint 1.3 smoke all passed");
}

main().catch((e) => {
  console.error("✗ Sprint 1.3 smoke failed:", e);
  process.exit(1);
});
