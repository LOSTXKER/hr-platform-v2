-- HR Platform v2 — Sprint 1.4 OT Requests RLS
-- Apply via: npx prisma db execute --file prisma/sql/06_rls_sprint_1_4.sql

ALTER TABLE public.ot_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ot_requests_select_same_org ON public.ot_requests;
CREATE POLICY ot_requests_select_same_org ON public.ot_requests
  FOR SELECT TO authenticated
  USING (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS ot_requests_insert_self ON public.ot_requests;
CREATE POLICY ot_requests_insert_self ON public.ot_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = ot_requests.employee_id
        AND e.user_id = auth.uid()
        AND e.organization_id = public.current_user_org_id()
    )
  );

DROP POLICY IF EXISTS ot_requests_insert_hr ON public.ot_requests;
CREATE POLICY ot_requests_insert_hr ON public.ot_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  );

DROP POLICY IF EXISTS ot_requests_update_self_cancel ON public.ot_requests;
CREATE POLICY ot_requests_update_self_cancel ON public.ot_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND status = 'REQUESTED'
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = ot_requests.employee_id
        AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS ot_requests_update_approver ON public.ot_requests;
CREATE POLICY ot_requests_update_approver ON public.ot_requests
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR', 'MANAGER')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS ot_requests_delete_admin ON public.ot_requests;
CREATE POLICY ot_requests_delete_admin ON public.ot_requests
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ot_requests TO authenticated;
