-- HR Platform v2 — Sprint 1.1 Employee Profile expansion
-- Source: vault/projects/hr-platform-v2/features.md §1.1-1.7
-- Pre-condition: employees table has 0 rows (clean slate recreate is safe)

-- ============================================================
-- 1. Drop existing employees + EmployeeStatus enum (recreate cleanly)
-- ============================================================
DROP TABLE IF EXISTS "employees" CASCADE;
DROP TYPE IF EXISTS "EmployeeStatus";

-- ============================================================
-- 2. Create enums
-- ============================================================
CREATE TYPE "EmployeeStatus" AS ENUM ('APPLICANT', 'PROBATION', 'PERMANENT', 'RESIGNED', 'TERMINATED', 'ARCHIVED');
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');
CREATE TYPE "BloodType" AS ENUM ('A', 'B', 'AB', 'O');
CREATE TYPE "MaritalStatus" AS ENUM ('SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED');
CREATE TYPE "FamilyRelation" AS ENUM ('SPOUSE', 'FATHER', 'MOTHER', 'CHILD');
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID', 'HOUSE_REGISTRATION', 'EDUCATION_CERT', 'TRANSCRIPT', 'PREVIOUS_EMPLOYMENT', 'MEDICAL_CERT', 'EMPLOYMENT_CONTRACT', 'WARNING_LETTER', 'OTHER');
CREATE TYPE "ProbationDecision" AS ENUM ('PASS', 'FAIL', 'EXTEND');

-- ============================================================
-- 3. Positions
-- ============================================================
CREATE TABLE "positions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "salary_band_min" DECIMAL(10,2),
    "salary_band_max" DECIMAL(10,2),
    "job_description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "positions_organization_id_title_key" ON "positions"("organization_id", "title");
CREATE INDEX "positions_organization_id_idx" ON "positions"("organization_id");
ALTER TABLE "positions" ADD CONSTRAINT "positions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 4. Departments (tree)
-- ============================================================
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "parent_id" UUID,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "departments_organization_id_name_key" ON "departments"("organization_id", "name");
CREATE INDEX "departments_organization_id_idx" ON "departments"("organization_id");
CREATE INDEX "departments_parent_id_idx" ON "departments"("parent_id");
ALTER TABLE "departments" ADD CONSTRAINT "departments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 5. Branches
-- ============================================================
CREATE TABLE "branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "address" JSONB,
    "gps_lat" DECIMAL(9,6),
    "gps_lng" DECIMAL(9,6),
    "radius_meters" INTEGER NOT NULL DEFAULT 100,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "branches_organization_id_name_key" ON "branches"("organization_id", "name");
CREATE INDEX "branches_organization_id_idx" ON "branches"("organization_id");
ALTER TABLE "branches" ADD CONSTRAINT "branches_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 6. Employees (full profile)
-- ============================================================
CREATE TABLE "employees" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" UUID NOT NULL,
    "user_id" UUID,
    "employee_code" TEXT NOT NULL,

    -- ส่วนตัว
    "first_name_th" TEXT NOT NULL,
    "last_name_th" TEXT NOT NULL,
    "first_name_en" TEXT,
    "last_name_en" TEXT,
    "national_id" TEXT,
    "passport_no" TEXT,
    "birth_date" DATE,
    "gender" "Gender",
    "nationality" TEXT NOT NULL DEFAULT 'THAI',
    "religion" TEXT,
    "blood_type" "BloodType",
    "marital_status" "MaritalStatus",

    -- ติดต่อ
    "phone_primary" TEXT NOT NULL,
    "phone_secondary" TEXT,
    "email" TEXT,
    "line_id" TEXT,
    "address_current" JSONB,
    "address_registered" JSONB,
    "same_address" BOOLEAN NOT NULL DEFAULT false,

    -- บัญชี (encrypted)
    "bank_code" TEXT,
    "bank_account_number_enc" TEXT,
    "bank_account_name" TEXT,

    -- ภาษี
    "tax_pin_enc" TEXT,
    "tax_dependents" INTEGER NOT NULL DEFAULT 0,
    "tax_allowances" JSONB,

    -- Position/org
    "position_id" UUID,
    "department_id" UUID,
    "primary_branch_id" UUID,
    "manager_id" UUID,

    -- Status + lifecycle
    "start_date" DATE NOT NULL,
    "probation_end_date" DATE,
    "status" "EmployeeStatus" NOT NULL DEFAULT 'APPLICANT',
    "status_updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resign_date" DATE,
    "archive_date" DATE,

    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employees_user_id_key" ON "employees"("user_id");
CREATE UNIQUE INDEX "employees_organization_id_employee_code_key" ON "employees"("organization_id", "employee_code");
CREATE INDEX "employees_organization_id_idx" ON "employees"("organization_id");
CREATE INDEX "employees_status_idx" ON "employees"("status");
CREATE INDEX "employees_probation_end_date_idx" ON "employees"("probation_end_date");

ALTER TABLE "employees" ADD CONSTRAINT "employees_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_position_id_fkey"
  FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_department_id_fkey"
  FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_primary_branch_id_fkey"
  FOREIGN KEY ("primary_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "employees" ADD CONSTRAINT "employees_manager_id_fkey"
  FOREIGN KEY ("manager_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================================
-- 7. EmployeeBranch junction
-- ============================================================
CREATE TABLE "employee_branches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_branches_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "employee_branches_employee_id_branch_id_key" ON "employee_branches"("employee_id", "branch_id");
CREATE INDEX "employee_branches_employee_id_idx" ON "employee_branches"("employee_id");
CREATE INDEX "employee_branches_branch_id_idx" ON "employee_branches"("branch_id");
ALTER TABLE "employee_branches" ADD CONSTRAINT "employee_branches_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "employee_branches" ADD CONSTRAINT "employee_branches_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 8. EmployeeFamilyMember
-- ============================================================
CREATE TABLE "employee_family_members" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "relation" "FamilyRelation" NOT NULL,
    "full_name" TEXT NOT NULL,
    "national_id" TEXT,
    "birth_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_family_members_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employee_family_members_employee_id_idx" ON "employee_family_members"("employee_id");
ALTER TABLE "employee_family_members" ADD CONSTRAINT "employee_family_members_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 9. EmployeeEmergencyContact
-- ============================================================
CREATE TABLE "employee_emergency_contacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "full_name" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "employee_emergency_contacts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employee_emergency_contacts_employee_id_idx" ON "employee_emergency_contacts"("employee_id");
ALTER TABLE "employee_emergency_contacts" ADD CONSTRAINT "employee_emergency_contacts_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 10. SalaryHistory
-- ============================================================
CREATE TABLE "salary_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "effective_date" DATE NOT NULL,
    "old_salary" DECIMAL(10,2) NOT NULL,
    "new_salary" DECIMAL(10,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "reason_notes" TEXT,
    "approver_id" UUID,
    "approved_at" TIMESTAMP(3),
    "document_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "salary_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "salary_history_employee_id_idx" ON "salary_history"("employee_id");
CREATE INDEX "salary_history_effective_date_idx" ON "salary_history"("effective_date");
ALTER TABLE "salary_history" ADD CONSTRAINT "salary_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 11. EmployeeDocument
-- ============================================================
CREATE TABLE "employee_documents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "type" "DocumentType" NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" TEXT NOT NULL,
    "expires_at" DATE,
    "uploaded_by" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employee_documents_employee_id_idx" ON "employee_documents"("employee_id");
CREATE INDEX "employee_documents_type_idx" ON "employee_documents"("type");
CREATE INDEX "employee_documents_expires_at_idx" ON "employee_documents"("expires_at");
ALTER TABLE "employee_documents" ADD CONSTRAINT "employee_documents_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 12. ProbationEvaluation
-- ============================================================
CREATE TABLE "probation_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "evaluator_id" UUID,
    "evaluated_at" TIMESTAMP(3) NOT NULL,
    "decision" "ProbationDecision" NOT NULL,
    "score" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "probation_evaluations_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "probation_evaluations_employee_id_idx" ON "probation_evaluations"("employee_id");
CREATE INDEX "probation_evaluations_evaluated_at_idx" ON "probation_evaluations"("evaluated_at");
ALTER TABLE "probation_evaluations" ADD CONSTRAINT "probation_evaluations_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================================
-- 13. EmployeeStatusHistory
-- ============================================================
CREATE TABLE "employee_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "employee_id" UUID NOT NULL,
    "from_status" "EmployeeStatus",
    "to_status" "EmployeeStatus" NOT NULL,
    "reason" TEXT,
    "actor_id" UUID,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "employee_status_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "employee_status_history_employee_id_idx" ON "employee_status_history"("employee_id");
CREATE INDEX "employee_status_history_changed_at_idx" ON "employee_status_history"("changed_at");
ALTER TABLE "employee_status_history" ADD CONSTRAINT "employee_status_history_employee_id_fkey"
  FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;
