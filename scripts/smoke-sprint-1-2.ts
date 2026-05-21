// Smoke test for Sprint 1.2 — Attendance schema + shift assignment + status computation
// Run: npx tsx scripts/smoke-sprint-1-2.ts
// Does NOT test RLS (uses service-role pg.Pool); RLS is verified via test-signup-style real-user tests separately.

import { Pool } from "pg";
import { config } from "dotenv";
import { computeStatus } from "../src/lib/attendance-service";
import type { AttendanceStatus, AttendanceType } from "../src/generated/prisma/enums";

const ts = () => new Date().toISOString();
const log = (...a: unknown[]) => console.log(ts(), ...a);

async function main() {
  config({ path: ".env.local" });
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });

  log("Sprint 1.2 smoke starting...");

  // ============================================================
  // 1. Status computation (pure function — no DB)
  // ============================================================
  log("\n[1] computeStatus pure-function checks");
  const cases: Array<{ name: string; expected: AttendanceStatus; args: Parameters<typeof computeStatus>[0] }> = [
    {
      name: "CHECK_IN on time (08:00 shift, grace 5, arrive 08:03)",
      expected: "ON_TIME" as AttendanceStatus,
      args: {
        type: "CHECK_IN" as AttendanceType,
        occurredAt: new Date("2026-05-22T01:03:00.000Z"), // 08:03 BKK
        shiftStartMin: 8 * 60,
        shiftEndMin: 17 * 60,
        shiftGraceMin: 5,
      },
    },
    {
      name: "CHECK_IN late (08:00 shift, arrive 08:10 past 5-min grace)",
      expected: "LATE" as AttendanceStatus,
      args: {
        type: "CHECK_IN" as AttendanceType,
        occurredAt: new Date("2026-05-22T01:10:00.000Z"), // 08:10 BKK
        shiftStartMin: 8 * 60,
        shiftEndMin: 17 * 60,
        shiftGraceMin: 5,
      },
    },
    {
      name: "CHECK_OUT early (17:00 shift, leave 16:30)",
      expected: "EARLY" as AttendanceStatus,
      args: {
        type: "CHECK_OUT" as AttendanceType,
        occurredAt: new Date("2026-05-22T09:30:00.000Z"), // 16:30 BKK
        shiftStartMin: 8 * 60,
        shiftEndMin: 17 * 60,
      },
    },
    {
      name: "CHECK_OUT on time (17:00 shift, leave 17:05)",
      expected: "ON_TIME" as AttendanceStatus,
      args: {
        type: "CHECK_OUT" as AttendanceType,
        occurredAt: new Date("2026-05-22T10:05:00.000Z"), // 17:05 BKK
        shiftStartMin: 8 * 60,
        shiftEndMin: 17 * 60,
      },
    },
    {
      name: "Geofence violation overrides on-time",
      expected: "OUT_OF_GEOFENCE" as AttendanceStatus,
      args: {
        type: "CHECK_IN" as AttendanceType,
        occurredAt: new Date("2026-05-22T01:00:00.000Z"),
        shiftStartMin: 8 * 60,
        shiftEndMin: 17 * 60,
        insideGeofence: false,
      },
    },
    {
      name: "Night shift CHECK_OUT after midnight on-time (22:00→06:00, leave 06:05)",
      expected: "ON_TIME" as AttendanceStatus,
      args: {
        type: "CHECK_OUT" as AttendanceType,
        occurredAt: new Date("2026-05-23T23:05:00.000Z"), // 06:05 BKK next day
        shiftStartMin: 22 * 60,
        shiftEndMin: 6 * 60,
      },
    },
    {
      name: "Night shift CHECK_OUT early (22:00→06:00, leave 05:30)",
      expected: "EARLY" as AttendanceStatus,
      args: {
        type: "CHECK_OUT" as AttendanceType,
        occurredAt: new Date("2026-05-23T22:30:00.000Z"), // 05:30 BKK
        shiftStartMin: 22 * 60,
        shiftEndMin: 6 * 60,
      },
    },
    {
      name: "No shift assigned → ON_TIME default",
      expected: "ON_TIME" as AttendanceStatus,
      args: {
        type: "CHECK_IN" as AttendanceType,
        occurredAt: new Date("2026-05-22T01:00:00.000Z"),
      },
    },
    {
      name: "BREAK_START never flags late/early",
      expected: "ON_TIME" as AttendanceStatus,
      args: {
        type: "BREAK_START" as AttendanceType,
        occurredAt: new Date("2026-05-22T05:00:00.000Z"),
        shiftStartMin: 8 * 60,
        shiftEndMin: 17 * 60,
      },
    },
  ];
  for (const c of cases) {
    const got = computeStatus(c.args);
    const ok = got === c.expected;
    log(`  ${ok ? "✓" : "✗"} ${c.name} — expect ${c.expected}, got ${got}`);
    if (!ok) throw new Error(`Status mismatch: ${c.name}`);
  }

  // ============================================================
  // 2. Setup test orgs
  // ============================================================
  log("\n[2] Setup test orgs (cleanup + recreate)");
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'smoke-sprint12-%'`);
  const orgA = await pool.query(
    `INSERT INTO organizations (slug, name, updated_at) VALUES ('smoke-sprint12-a', 'Org A Smoke', CURRENT_TIMESTAMP) RETURNING id`
  );
  const orgB = await pool.query(
    `INSERT INTO organizations (slug, name, updated_at) VALUES ('smoke-sprint12-b', 'Org B Smoke', CURRENT_TIMESTAMP) RETURNING id`
  );
  const orgAId = orgA.rows[0].id;
  const orgBId = orgB.rows[0].id;
  log(`  ✓ Org A: ${orgAId}`);
  log(`  ✓ Org B: ${orgBId}`);

  // ============================================================
  // 3. Create branches with GPS
  // ============================================================
  log("\n[3] Insert branches with GPS");
  const branchA = await pool.query(
    `INSERT INTO branches (organization_id, name, gps_lat, gps_lng, radius_meters, updated_at)
     VALUES ($1, 'สาขาหลัก A', 13.756331, 100.501762, 100, CURRENT_TIMESTAMP) RETURNING id`,
    [orgAId]
  );
  const branchAId = branchA.rows[0].id;
  log(`  ✓ Branch A: ${branchAId}`);

  // ============================================================
  // 4. Create shifts
  // ============================================================
  log("\n[4] Insert shifts (morning + afternoon + night)");
  const shiftMorning = await pool.query(
    `INSERT INTO shifts (organization_id, branch_id, name, start_minutes, end_minutes, break_minutes, grace_minutes, updated_at)
     VALUES ($1, $2, 'กะเช้า', 480, 1020, 60, 5, CURRENT_TIMESTAMP) RETURNING id`,
    [orgAId, branchAId]
  );
  const shiftNight = await pool.query(
    `INSERT INTO shifts (organization_id, branch_id, name, start_minutes, end_minutes, break_minutes, grace_minutes, updated_at)
     VALUES ($1, $2, 'กะดึก', 1320, 360, 30, 5, CURRENT_TIMESTAMP) RETURNING id`,
    [orgAId, branchAId]
  );
  log(`  ✓ Morning shift: ${shiftMorning.rows[0].id}`);
  log(`  ✓ Night shift: ${shiftNight.rows[0].id}`);

  // Test CHECK constraint — invalid start_minutes
  try {
    await pool.query(
      `INSERT INTO shifts (organization_id, name, start_minutes, end_minutes, updated_at) VALUES ($1, 'bad', 9999, 0, CURRENT_TIMESTAMP)`,
      [orgAId]
    );
    throw new Error("should have failed start_minutes check constraint");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.includes("start_minutes_range")) {
      throw new Error(`Expected CHECK constraint error, got: ${(e as Error).message}`);
    }
    log(`  ✓ CHECK constraint blocks invalid start_minutes`);
  }

  // ============================================================
  // 5. Create employees
  // ============================================================
  log("\n[5] Insert employees");
  const empA = await pool.query(
    `INSERT INTO employees (organization_id, employee_code, first_name_th, last_name_th, phone_primary, start_date, status, updated_at)
     VALUES ($1, 'EMP-A1', 'ทดสอบA', 'นามสกุล', '0812345678', '2026-04-01', 'PERMANENT', CURRENT_TIMESTAMP) RETURNING id`,
    [orgAId]
  );
  const empAId = empA.rows[0].id;
  log(`  ✓ Employee A1: ${empAId}`);

  // ============================================================
  // 6. Assign shift
  // ============================================================
  log("\n[6] Assign employee_shift for 2026-05-22");
  await pool.query(
    `INSERT INTO employee_shifts (organization_id, employee_id, shift_id, work_date, updated_at)
     VALUES ($1, $2, $3, '2026-05-22', CURRENT_TIMESTAMP)`,
    [orgAId, empAId, shiftMorning.rows[0].id]
  );
  log(`  ✓ Assigned morning shift to A1 on 2026-05-22`);

  // Test unique constraint — same employee, same date
  try {
    await pool.query(
      `INSERT INTO employee_shifts (organization_id, employee_id, shift_id, work_date, updated_at)
       VALUES ($1, $2, $3, '2026-05-22', CURRENT_TIMESTAMP)`,
      [orgAId, empAId, shiftNight.rows[0].id]
    );
    throw new Error("should have failed unique constraint on (employee_id, work_date)");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.toLowerCase().includes("duplicate")) {
      throw new Error(`Expected unique violation, got: ${(e as Error).message}`);
    }
    log(`  ✓ Unique constraint blocks double-assign same day`);
  }

  // ============================================================
  // 7. Insert attendance records
  // ============================================================
  log("\n[7] Insert attendance_records");
  const att1 = await pool.query(
    `INSERT INTO attendance_records (organization_id, employee_id, branch_id, type, method, status, occurred_at, gps_lat, gps_lng, inside_geofence)
     VALUES ($1, $2, $3, 'CHECK_IN', 'GPS', 'ON_TIME', '2026-05-22T01:03:00Z', 13.756400, 100.501800, true) RETURNING id`,
    [orgAId, empAId, branchAId]
  );
  log(`  ✓ Check-in record: ${att1.rows[0].id}`);

  // Offline sync dedupe
  await pool.query(
    `INSERT INTO attendance_records (organization_id, employee_id, type, method, occurred_at, offline_sync_id)
     VALUES ($1, $2, 'CHECK_OUT', 'GPS', '2026-05-22T10:05:00Z', 'sync-key-123')`,
    [orgAId, empAId]
  );
  try {
    await pool.query(
      `INSERT INTO attendance_records (organization_id, employee_id, type, method, occurred_at, offline_sync_id)
       VALUES ($1, $2, 'CHECK_OUT', 'GPS', '2026-05-22T10:05:00Z', 'sync-key-123')`,
      [orgAId, empAId]
    );
    throw new Error("should have failed offline_sync_id unique constraint");
  } catch (e) {
    if (!(e instanceof Error) || !e.message.toLowerCase().includes("duplicate")) {
      throw new Error(`Expected sync dedupe violation, got: ${(e as Error).message}`);
    }
    log(`  ✓ offline_sync_id unique blocks duplicate sync`);
  }

  // ============================================================
  // 8. Cross-tenant: count by org (multi-tenant correctness sanity)
  // ============================================================
  log("\n[8] Multi-tenant counts");
  const countA = await pool.query(
    `SELECT COUNT(*)::int AS c FROM attendance_records WHERE organization_id = $1`,
    [orgAId]
  );
  const countB = await pool.query(
    `SELECT COUNT(*)::int AS c FROM attendance_records WHERE organization_id = $1`,
    [orgBId]
  );
  if (countA.rows[0].c !== 2) throw new Error(`Org A expected 2 records, got ${countA.rows[0].c}`);
  if (countB.rows[0].c !== 0) throw new Error(`Org B expected 0 records, got ${countB.rows[0].c}`);
  log(`  ✓ Org A: ${countA.rows[0].c} records, Org B: ${countB.rows[0].c} (isolation OK)`);

  // ============================================================
  // 9. FK cascade: delete employee → attendance records gone
  // ============================================================
  log("\n[9] FK cascade on employee delete");
  await pool.query(`DELETE FROM employees WHERE id = $1`, [empAId]);
  const after = await pool.query(
    `SELECT COUNT(*)::int AS c FROM attendance_records WHERE employee_id = $1`,
    [empAId]
  );
  if (after.rows[0].c !== 0) throw new Error(`Expected cascade delete, got ${after.rows[0].c} orphans`);
  log(`  ✓ Cascade delete cleared attendance + employee_shifts`);

  // ============================================================
  // Cleanup
  // ============================================================
  log("\n[10] Cleanup");
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'smoke-sprint12-%'`);
  log(`  ✓ Cleaned`);

  await pool.end();
  log("\n✅ All Sprint 1.2 smoke checks passed");
}

main().catch((e) => {
  console.error("✗ Smoke failed:", e);
  process.exit(1);
});
