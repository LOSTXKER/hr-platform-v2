-- HR Platform v2 — Sprint 1.3 Leave Management RLS
-- Apply via: npx prisma db execute --file prisma/sql/05_rls_sprint_1_3.sql

-- ============================================================
-- leave_types (HR config — read same-org, write HR+)
-- ============================================================
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_types_select_same_org ON public.leave_types;
CREATE POLICY leave_types_select_same_org ON public.leave_types
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS leave_types_write_hr ON public.leave_types;
CREATE POLICY leave_types_write_hr ON public.leave_types
  FOR ALL TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ============================================================
-- leave_requests
--   - SELECT: same-org (employees see their own + team; HR/manager sees all)
--   - INSERT self: members can request leave for themselves only
--   - INSERT HR: HR can backfill on behalf
--   - UPDATE: requester can cancel own PENDING; HR/manager can approve/reject
--   - DELETE: HR/admin only (audit integrity)
-- ============================================================
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS leave_requests_select_same_org ON public.leave_requests;
CREATE POLICY leave_requests_select_same_org ON public.leave_requests
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS leave_requests_insert_self ON public.leave_requests;
CREATE POLICY leave_requests_insert_self ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = leave_requests.employee_id
        AND e.user_id = auth.uid()
        AND e.organization_id = public.current_user_org_id()
    )
  );

DROP POLICY IF EXISTS leave_requests_insert_hr ON public.leave_requests;
CREATE POLICY leave_requests_insert_hr ON public.leave_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  );

DROP POLICY IF EXISTS leave_requests_update_self_cancel ON public.leave_requests;
CREATE POLICY leave_requests_update_self_cancel ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND status = 'PENDING'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = leave_requests.employee_id
        AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS leave_requests_update_approver ON public.leave_requests;
CREATE POLICY leave_requests_update_approver ON public.leave_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR', 'MANAGER')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS leave_requests_delete_admin ON public.leave_requests;
CREATE POLICY leave_requests_delete_admin ON public.leave_requests
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- Permissions
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
