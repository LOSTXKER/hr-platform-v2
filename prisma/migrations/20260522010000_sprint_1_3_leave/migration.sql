-- HR Platform v2 — Sprint 1.3 Leave Management
-- Source: vault/projects/hr-platform-v2/features.md §3.1-3.3, §3.6
-- Adds: leave_types + leave_requests (+ LeaveStatus enum)
-- Quota balance computed on-the-fly (no balance table — Phase 2 cache if performance demands)

CREATE TYPE "LeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- ============================================================
-- 1. leave_types (HR config per org)
-- ============================================================
CREATE TABLE "leave_types" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name_th" TEXT NOT NULL,
    "default_quota_days" INTEGER NOT NULL,
    "deducts_quota" BOOLEAN NOT NULL DEFAULT true,
    "requires_attachment" BOOLEAN NOT NULL DEFAULT false,
    "attachment_threshold_days" INTEGER,
    "carryover_max_days" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leave_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "leave_types_organization_id_code_key" ON "leave_types"("organization_id", "code");
CREATE INDEX "leave_types_organization_id_idx" ON "leave_types"("organization_id");
ALTER TABLE "leave_types" ADD CONSTRAINT "leave_types_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 2. leave_requests
-- ============================================================
CREATE TABLE "leave_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "leave_type_id" UUID NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "days" DECIMAL(5,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "attachment_url" TEXT,
    "status" "LeaveStatus" NOT NULL DEFAULT 'PENDING',
    "approver_id" UUID,
    "decided_at" TIMESTAMP(3),
    "decision_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "leave_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "leave_requests_date_range" CHECK ("end_date" >= "start_date"),
    CONSTRAINT "leave_requests_days_positive" CHECK ("days" > 0)
);
CREATE INDEX "leave_requests_organization_id_idx" ON "leave_requests"("organization_id");
CREATE INDEX "leave_requests_employee_id_idx" ON "leave_requests"("employee_id");
CREATE INDEX "leave_requests_status_idx" ON "leave_requests"("status");
CREATE INDEX "leave_requests_start_date_idx" ON "leave_requests"("start_date");
CREATE INDEX "leave_requests_employee_id_status_idx" ON "leave_requests"("employee_id", "status");
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_approver_id_fkey"
  FOREIGN KEY ("approver_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "leave_requests" ADD CONSTRAINT "leave_requests_leave_type_id_fkey"
  FOREIGN KEY ("leave_type_id") REFERENCES "leave_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
