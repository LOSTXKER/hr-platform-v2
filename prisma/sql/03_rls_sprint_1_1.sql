-- HR Platform v2 — Sprint 1.1 RLS policies
-- Apply via: npx prisma db execute --file prisma/sql/03_rls_sprint_1_1.sql --schema prisma/schema.prisma
-- Pattern: parent tables (positions/departments/branches/employees) gate by organization_id;
--          child tables (employee_*) gate via parent employee.organization_id = current_user_org_id()
-- Helper functions: public.current_user_org_id(), public.current_user_role() — defined in 01_rls_policies.sql

-- ============================================================
-- positions
-- ============================================================
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS positions_select_same_org ON public.positions;
CREATE POLICY positions_select_same_org ON public.positions
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS positions_write_hr ON public.positions;
CREATE POLICY positions_write_hr ON public.positions
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ============================================================
-- departments
-- ============================================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS departments_select_same_org ON public.departments;
CREATE POLICY departments_select_same_org ON public.departments
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS departments_write_hr ON public.departments;
CREATE POLICY departments_write_hr ON public.departments
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ============================================================
-- branches
-- ============================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branches_select_same_org ON public.branches;
CREATE POLICY branches_select_same_org ON public.branches
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS branches_write_hr ON public.branches;
CREATE POLICY branches_write_hr ON public.branches
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ============================================================
-- employees (recreated by migration — re-apply Phase 0 policies)
-- ============================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employees_select_same_org ON public.employees;
CREATE POLICY employees_select_same_org ON public.employees
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS employees_insert_hr ON public.employees;
CREATE POLICY employees_insert_hr ON public.employees
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  );

DROP POLICY IF EXISTS employees_update_hr ON public.employees;
CREATE POLICY employees_update_hr ON public.employees
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS employees_update_self ON public.employees;
CREATE POLICY employees_update_self ON public.employees
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid() AND organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS employees_delete_admin ON public.employees;
CREATE POLICY employees_delete_admin ON public.employees
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- employee_branches (child of employees + branches)
-- ============================================================
ALTER TABLE public.employee_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS employee_branches_select_same_org ON public.employee_branches;
CREATE POLICY employee_branches_select_same_org ON public.employee_branches
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_branches.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

DROP POLICY IF EXISTS employee_branches_write_hr ON public.employee_branches;
CREATE POLICY employee_branches_write_hr ON public.employee_branches
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_branches.employee_id
              AND e.organization_id = public.current_user_org_id())
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_branches.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

-- ============================================================
-- employee_family_members
-- ============================================================
ALTER TABLE public.employee_family_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS efm_select_same_org ON public.employee_family_members;
CREATE POLICY efm_select_same_org ON public.employee_family_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_family_members.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

DROP POLICY IF EXISTS efm_write_hr_or_self ON public.employee_family_members;
CREATE POLICY efm_write_hr_or_self ON public.employee_family_members
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_family_members.employee_id
              AND e.organization_id = public.current_user_org_id()
              AND (
                public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
                OR e.user_id = auth.uid()
              ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_family_members.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

-- ============================================================
-- employee_emergency_contacts
-- ============================================================
ALTER TABLE public.employee_emergency_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS eec_select_same_org ON public.employee_emergency_contacts;
CREATE POLICY eec_select_same_org ON public.employee_emergency_contacts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_emergency_contacts.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

DROP POLICY IF EXISTS eec_write_hr_or_self ON public.employee_emergency_contacts;
CREATE POLICY eec_write_hr_or_self ON public.employee_emergency_contacts
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_emergency_contacts.employee_id
              AND e.organization_id = public.current_user_org_id()
              AND (
                public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
                OR e.user_id = auth.uid()
              ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_emergency_contacts.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

-- ============================================================
-- salary_history (sensitive — HR + manager + self only)
-- ============================================================
ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sh_select_restricted ON public.salary_history;
CREATE POLICY sh_select_restricted ON public.salary_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = salary_history.employee_id
              AND e.organization_id = public.current_user_org_id()
              AND (
                public.current_user_role() IN ('OWNER', 'ADMIN', 'HR', 'MANAGER')
                OR e.user_id = auth.uid()
              ))
  );

DROP POLICY IF EXISTS sh_insert_hr ON public.salary_history;
CREATE POLICY sh_insert_hr ON public.salary_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = salary_history.employee_id
              AND e.organization_id = public.current_user_org_id())
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  );

-- ============================================================
-- employee_documents (HR + self)
-- ============================================================
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ed_select_self_or_hr ON public.employee_documents;
CREATE POLICY ed_select_self_or_hr ON public.employee_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_documents.employee_id
              AND e.organization_id = public.current_user_org_id()
              AND (
                public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
                OR e.user_id = auth.uid()
              ))
  );

DROP POLICY IF EXISTS ed_write_hr_or_self ON public.employee_documents;
CREATE POLICY ed_write_hr_or_self ON public.employee_documents
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_documents.employee_id
              AND e.organization_id = public.current_user_org_id()
              AND (
                public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
                OR e.user_id = auth.uid()
              ))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_documents.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

-- ============================================================
-- probation_evaluations (HR + manager only)
-- ============================================================
ALTER TABLE public.probation_evaluations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pe_select_hr_manager ON public.probation_evaluations;
CREATE POLICY pe_select_hr_manager ON public.probation_evaluations
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = probation_evaluations.employee_id
              AND e.organization_id = public.current_user_org_id())
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR', 'MANAGER')
  );

DROP POLICY IF EXISTS pe_write_hr ON public.probation_evaluations;
CREATE POLICY pe_write_hr ON public.probation_evaluations
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = probation_evaluations.employee_id
              AND e.organization_id = public.current_user_org_id())
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = probation_evaluations.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

-- ============================================================
-- employee_status_history (read-all-same-org, write-HR-only)
-- ============================================================
ALTER TABLE public.employee_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS esh_select_same_org ON public.employee_status_history;
CREATE POLICY esh_select_same_org ON public.employee_status_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_status_history.employee_id
              AND e.organization_id = public.current_user_org_id())
  );

DROP POLICY IF EXISTS esh_insert_hr ON public.employee_status_history;
CREATE POLICY esh_insert_hr ON public.employee_status_history
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.employees e
            WHERE e.id = employee_status_history.employee_id
              AND e.organization_id = public.current_user_org_id())
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  );

-- ============================================================
-- Permissions — grant authenticated base access (RLS gates rows)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_branches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_family_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_emergency_contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.probation_evaluations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_status_history TO authenticated;

-- Note: employees policies re-applied above (table recreated by migration drops old policies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
