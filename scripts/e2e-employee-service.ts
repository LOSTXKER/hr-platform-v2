// Service-layer E2E for Sprint 1.1 — encryption + validation + cross-org isolation
// Run: npx tsx scripts/e2e-employee-service.ts
// Skipped: HTTP API layer (requires dev server) — follow-up

import { Pool } from "pg";
import { config } from "dotenv";
config({ path: ".env.local" });

import {
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
  deleteEmployee,
  ValidationError,
} from "../src/lib/employee-service";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);

function buildValidPID(prefix12: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(prefix12[i]!, 10) * (13 - i);
  return prefix12 + ((11 - (sum % 11)) % 10);
}

async function main() {
  const pool = new Pool({ connectionString: process.env.DIRECT_URL });
  log("E2E starting...");

  // ============================================================
  // Setup test orgs
  // ============================================================
  log("\n[setup] cleanup + create test orgs");
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'e2e-sprint11-%'`);
  const orgA = (
    await pool.query(
      `INSERT INTO organizations (slug, name, updated_at) VALUES ('e2e-sprint11-anajak', 'E2E Anajak', CURRENT_TIMESTAMP) RETURNING id`
    )
  ).rows[0].id;
  const orgB = (
    await pool.query(
      `INSERT INTO organizations (slug, name, updated_at) VALUES ('e2e-sprint11-ibear', 'E2E iBear', CURRENT_TIMESTAMP) RETURNING id`
    )
  ).rows[0].id;
  log(`  orgA(Anajak)=${orgA}  orgB(iBear)=${orgB}`);

  // ============================================================
  // 1. Create full-profile employee in orgA
  // ============================================================
  log("\n[1] createEmployee(orgA, fullProfile)");
  const validPID = buildValidPID("110020030040");
  const created = await createEmployee(orgA, {
    employeeCode: "E2E-001",
    firstNameTh: "ทดสอบ",
    lastNameTh: "นามสกุล",
    firstNameEn: "Test",
    lastNameEn: "Surname",
    nationalId: validPID,
    birthDate: new Date("1990-01-15"),
    gender: "MALE",
    nationality: "THAI",
    bloodType: "O",
    maritalStatus: "SINGLE",
    phonePrimary: "089-123-4567",
    phoneSecondary: "0823456789",
    email: "test@example.com",
    addressCurrent: { line1: "123 สุขุมวิท", province: "กรุงเทพ", postal: "10110" } as never,
    bankCode: "SCB",
    bankAccountNumber: "1234567890",
    bankAccountName: "ทดสอบ นามสกุล",
    taxPin: validPID,
    taxDependents: 1,
    startDate: new Date("2026-04-01"),
    probationEndDate: new Date("2026-07-29"),
    status: "PROBATION",
  });
  log(`  ✓ id=${created.id} status=${created.status}`);
  log(`  ✓ phone normalized: ${created.phonePrimary} (expected 0891234567)`);
  if (created.phonePrimary !== "0891234567") throw new Error("phone not normalized");
  log(`  ✓ bankAccountNumber decrypted: ${created.bankAccountNumber}`);
  if (created.bankAccountNumber !== "1234567890") throw new Error("bank decrypt failed");
  log(`  ✓ taxPin decrypted: ${created.taxPin}`);

  // ============================================================
  // 2. Read back — verify PII decrypted
  // ============================================================
  log("\n[2] getEmployee(orgA, id)");
  const fetched = await getEmployee(orgA, created.id);
  if (!fetched) throw new Error("get returned null");
  if (fetched.bankAccountNumber !== "1234567890") throw new Error("bank PII mismatch on read");
  if (fetched.taxPin !== validPID) throw new Error("tax PIN mismatch on read");
  log(`  ✓ Re-decrypted PII matches`);

  // ============================================================
  // 3. Cross-org isolation
  // ============================================================
  log("\n[3] Cross-org isolation");
  const crossOrg = await getEmployee(orgB, created.id);
  if (crossOrg !== null) throw new Error("RLS leak: orgB saw orgA employee");
  log(`  ✓ getEmployee(orgB, orgA-employee-id) returned null`);

  const listB = await listEmployees(orgB);
  if (listB.length !== 0) throw new Error("RLS leak: listEmployees(orgB) returned " + listB.length);
  log(`  ✓ listEmployees(orgB) = [] (empty)`);

  const listA = await listEmployees(orgA);
  if (listA.length !== 1) throw new Error("listEmployees(orgA) should be 1, got " + listA.length);
  if (listA[0]!.bankAccountNumber !== "1234567890") throw new Error("list decrypt missing");
  log(`  ✓ listEmployees(orgA) = [1 row] with decrypted PII`);

  // ============================================================
  // 4. Update — change PII
  // ============================================================
  log("\n[4] updateEmployee — change bank + tax");
  const updated = await updateEmployee(orgA, created.id, {
    bankAccountNumber: "9876543210",
    taxPin: validPID,
    taxDependents: 2,
  });
  if (!updated) throw new Error("update returned null");
  if (updated.bankAccountNumber !== "9876543210") throw new Error("update bank failed");
  if (updated.taxDependents !== 2) throw new Error("taxDependents update failed");
  log(`  ✓ bank updated: ${updated.bankAccountNumber}, taxDependents=${updated.taxDependents}`);

  // ============================================================
  // 5. Update from orgB perspective — must fail silently (cross-org)
  // ============================================================
  log("\n[5] updateEmployee from wrong org → null");
  const crossUpdate = await updateEmployee(orgB, created.id, { firstNameTh: "ฉันแฮ็ค" });
  if (crossUpdate !== null) throw new Error("cross-org update leaked: " + JSON.stringify(crossUpdate));
  log(`  ✓ updateEmployee(orgB, orgA-employee-id, ...) returned null`);

  // Verify name not changed
  const afterCrossAttack = await getEmployee(orgA, created.id);
  if (afterCrossAttack!.firstNameTh !== "ทดสอบ") {
    throw new Error("cross-org update succeeded against orgA! attacker name=" + afterCrossAttack!.firstNameTh);
  }
  log(`  ✓ Anajak employee.firstNameTh unchanged ("${afterCrossAttack!.firstNameTh}")`);

  // ============================================================
  // 6. Validation — invalid PID rejected
  // ============================================================
  log("\n[6] Validation errors");
  try {
    await createEmployee(orgA, {
      employeeCode: "E2E-BAD-PID",
      firstNameTh: "เลข",
      lastNameTh: "ผิด",
      phonePrimary: "0812345678",
      nationalId: "1234567890123", // bad checksum
      startDate: new Date("2026-04-01"),
    });
    throw new Error("expected ValidationError for bad PID");
  } catch (e) {
    if (!(e instanceof ValidationError) || !e.message.includes("nationalId")) {
      throw e;
    }
    log(`  ✓ rejected bad PID: ${e.message}`);
  }

  try {
    await createEmployee(orgA, {
      employeeCode: "E2E-BAD-PHONE",
      firstNameTh: "เบอร์",
      lastNameTh: "ผิด",
      phonePrimary: "12345", // bad phone
      startDate: new Date("2026-04-01"),
    });
    throw new Error("expected ValidationError for bad phone");
  } catch (e) {
    if (!(e instanceof ValidationError) || !e.message.includes("phonePrimary")) {
      throw e;
    }
    log(`  ✓ rejected bad phone: ${e.message}`);
  }

  // ============================================================
  // 7. Delete
  // ============================================================
  log("\n[7] deleteEmployee");
  const okDelete = await deleteEmployee(orgA, created.id);
  if (!okDelete) throw new Error("delete returned false");
  const gone = await getEmployee(orgA, created.id);
  if (gone !== null) throw new Error("employee still present after delete");
  log(`  ✓ Employee deleted`);

  // ============================================================
  // Cleanup
  // ============================================================
  log("\n[cleanup] delete test orgs");
  await pool.query(`DELETE FROM organizations WHERE slug LIKE 'e2e-sprint11-%'`);
  await pool.end();

  log("\n✅ E2E service tests passed (7/7)");
}

main().catch(async (e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
