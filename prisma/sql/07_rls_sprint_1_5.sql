-- HR Platform v2 — Sprint 1.5 push_subscriptions RLS

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Members only see/manage their own subscriptions; HR can see all (debug/cleanup)
DROP POLICY IF EXISTS push_select_self_or_hr ON public.push_subscriptions;
CREATE POLICY push_select_self_or_hr ON public.push_subscriptions
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND (
      public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = push_subscriptions.employee_id AND e.user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS push_insert_self ON public.push_subscriptions;
CREATE POLICY push_insert_self ON public.push_subscriptions
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.current_user_org_id()
    AND EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.id = push_subscriptions.employee_id AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS push_delete_self_or_hr ON public.push_subscriptions;
CREATE POLICY push_delete_self_or_hr ON public.push_subscriptions
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND (
      public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
      OR EXISTS (
        SELECT 1 FROM public.employees e
        WHERE e.id = push_subscriptions.employee_id AND e.user_id = auth.uid()
      )
    )
  );

GRANT SELECT, INSERT, DELETE ON public.push_subscriptions TO authenticated;
