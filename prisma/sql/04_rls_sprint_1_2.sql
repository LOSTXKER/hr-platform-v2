-- HR Platform v2 — Sprint 1.2 Attendance RLS
-- Apply via: npx prisma db execute --file prisma/sql/04_rls_sprint_1_2.sql --schema prisma/schema.prisma
-- Helper functions: public.current_user_org_id(), public.current_user_role() — defined in 01_rls_policies.sql

-- ============================================================
-- shifts (HR config — read same-org, write HR+)
-- ============================================================
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shifts_select_same_org ON public.shifts;
CREATE POLICY shifts_select_same_org ON public.shifts
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS shifts_write_hr ON public.shifts;
CREATE POLICY shifts_write_hr ON public.shifts
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ============================================================
-- employee_shifts (assignment — read same-org, write HR/MANAGER)
-- ============================================================
ALTER TABLE public.employee_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_shifts_select_same_org ON public.employee_shifts;
CREATE POLICY employee_shifts_select_same_org ON public.employee_shifts
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS employee_shifts_write_hr_manager ON public.employee_shifts;
CREATE POLICY employee_shifts_write_hr_manager ON public.employee_shifts
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR', 'MANAGER')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ============================================================
-- attendance_records
--   - SELECT: same-org (everyone in org can see — for manager review + payroll)
--   - INSERT self: members can check themselves in/out (employee.user_id = auth.uid())
--   - INSERT HR: HR/admin can backfill / manual override for any employee
--   - UPDATE/DELETE: HR/admin only (audit integrity — members cannot edit their own)
-- ============================================================
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS attendance_select_same_org ON public.attendance_records;
CREATE POLICY attendance_select_same_org ON public.attendance_records
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS attendance_insert_self ON public.attendance_records;
CREATE POLICY attendance_insert_self ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = attendance_records.employee_id
        AND e.user_id = auth.uid()
        AND e.organization_id = public.current_user_org_id()
    )
  );

DROP POLICY IF EXISTS attendance_insert_hr ON public.attendance_records;
CREATE POLICY attendance_insert_hr ON public.attendance_records
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  );

DROP POLICY IF EXISTS attendance_update_hr ON public.attendance_records;
CREATE POLICY attendance_update_hr ON public.attendance_records
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS attendance_delete_admin ON public.attendance_records;
CREATE POLICY attendance_delete_admin ON public.attendance_records
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- Permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_shifts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance_records TO authenticated;
