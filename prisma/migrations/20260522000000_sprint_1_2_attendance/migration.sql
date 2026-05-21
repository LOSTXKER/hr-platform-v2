-- HR Platform v2 — Sprint 1.2 Attendance
-- Source: vault/projects/hr-platform-v2/features.md §2.1, §2.4, §2.6, §2.7, §2.8
-- Adds: shifts + employee_shifts + attendance_records (+ 3 enums)
-- Reuses existing branches.gps_lat/gps_lng/radius_meters for geofence (no new table)

-- ============================================================
-- 1. Enums
-- ============================================================
CREATE TYPE "AttendanceType" AS ENUM ('CHECK_IN', 'CHECK_OUT', 'BREAK_START', 'BREAK_END');
CREATE TYPE "AttendanceMethod" AS ENUM ('GPS', 'QR', 'MANUAL', 'FINGERPRINT');
CREATE TYPE "AttendanceStatus" AS ENUM ('ON_TIME', 'LATE', 'EARLY', 'MISSING', 'OUT_OF_GEOFENCE');

-- ============================================================
-- 2. shifts
-- ============================================================
CREATE TABLE "shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "branch_id" UUID,
    "name" TEXT NOT NULL,
    "start_minutes" INTEGER NOT NULL,
    "end_minutes" INTEGER NOT NULL,
    "break_minutes" INTEGER NOT NULL DEFAULT 0,
    "grace_minutes" INTEGER NOT NULL DEFAULT 5,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "shifts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "shifts_start_minutes_range" CHECK ("start_minutes" >= 0 AND "start_minutes" < 1440),
    CONSTRAINT "shifts_end_minutes_range" CHECK ("end_minutes" >= 0 AND "end_minutes" < 1440)
);
CREATE UNIQUE INDEX "shifts_organization_id_name_key" ON "shifts"("organization_id", "name");
CREATE INDEX "shifts_organization_id_idx" ON "shifts"("organization_id");
CREATE INDEX "shifts_branch_id_idx" ON "shifts"("branch_id");
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shifts" ADD CONSTRAINT "shifts_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 3. employee_shifts (1 employee 1 shift per day)
-- ============================================================
CREATE TABLE "employee_shifts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "shift_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_shifts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employee_shifts_employee_id_work_date_key" ON "employee_shifts"("employee_id", "work_date");
CREATE INDEX "employee_shifts_organization_id_idx" ON "employee_shifts"("organization_id");
CREATE INDEX "employee_shifts_work_date_idx" ON "employee_shifts"("work_date");
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_shifts" ADD CONSTRAINT "employee_shifts_shift_id_fkey"
  FOREIGN KEY ("shift_id") REFERENCES "shifts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- 4. attendance_records
-- ============================================================
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "branch_id" UUID,
    "type" "AttendanceType" NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ON_TIME',
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "gps_lat" DECIMAL(9,6),
    "gps_lng" DECIMAL(9,6),
    "gps_accuracy_m" INTEGER,
    "inside_geofence" BOOLEAN,
    "selfie_url" TEXT,
    "offline_sync_id" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "attendance_records_offline_sync_id_key" ON "attendance_records"("offline_sync_id");
CREATE INDEX "attendance_records_organization_id_idx" ON "attendance_records"("organization_id");
CREATE INDEX "attendance_records_employee_id_idx" ON "attendance_records"("employee_id");
CREATE INDEX "attendance_records_occurred_at_idx" ON "attendance_records"("occurred_at");
CREATE INDEX "attendance_records_employee_id_occurred_at_idx" ON "attendance_records"("employee_id", "occurred_at");
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
