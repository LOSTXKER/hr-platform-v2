-- HR Platform v2 — Sprint 1.4 OT Requests
-- Source: vault/projects/hr-platform-v2/features.md §4.1, §4.2 (simplified), §4.4
-- Adds: ot_requests + OtStatus + OtDayType enums

CREATE TYPE "OtStatus" AS ENUM ('REQUESTED', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "OtDayType" AS ENUM ('WEEKDAY', 'WEEKEND', 'HOLIDAY');

CREATE TABLE "ot_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "work_date" DATE NOT NULL,
    "start_minutes" INTEGER NOT NULL,
    "end_minutes" INTEGER NOT NULL,
    "hours" DECIMAL(5,2) NOT NULL,
    "day_type" "OtDayType" NOT NULL DEFAULT 'WEEKDAY',
    "hourly_rate" DECIMAL(10,2),
    "estimated_pay" DECIMAL(10,2),
    "reason" TEXT NOT NULL,
    "status" "OtStatus" NOT NULL DEFAULT 'REQUESTED',
    "approver_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ot_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ot_requests_start_range" CHECK ("start_minutes" >= 0 AND "start_minutes" < 1440),
    CONSTRAINT "ot_requests_end_range" CHECK ("end_minutes" >= 0 AND "end_minutes" < 1440),
    CONSTRAINT "ot_requests_hours_positive" CHECK ("hours" > 0)
);
CREATE INDEX "ot_requests_organization_id_idx" ON "ot_requests"("organization_id");
CREATE INDEX "ot_requests_employee_id_idx" ON "ot_requests"("employee_id");
CREATE INDEX "ot_requests_status_idx" ON "ot_requests"("status");
CREATE INDEX "ot_requests_work_date_idx" ON "ot_requests"("work_date");
CREATE INDEX "ot_requests_employee_id_work_date_idx" ON "ot_requests"("employee_id", "work_date");
ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ot_requests" ADD CONSTRAINT "ot_requests_approver_id_fkey"
  FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
