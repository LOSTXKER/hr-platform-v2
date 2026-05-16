-- HR Platform v2 — Phase 0 RLS policies
-- Multi-tenant isolation: every row scoped to user's organization_id
-- Apply via: npx prisma db execute --file prisma/sql/01_rls_policies.sql --schema prisma/schema.prisma
-- (ไม่อยู่ใน prisma/migrations/ เพราะ Prisma shadow DB ไม่มี Supabase auth schema)

-- Helper function — returns current user's organization_id
-- SECURITY DEFINER so RLS on users table doesn't recurse
CREATE OR REPLACE FUNCTION public.current_user_org_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT organization_id FROM public.users WHERE id = auth.uid()
$$;

-- Helper function — returns current user's role
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::text FROM public.users WHERE id = auth.uid()
$$;

-- ============================================================
-- organizations — tenant root
-- ============================================================
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organizations_select_own ON public.organizations;
CREATE POLICY organizations_select_own ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.current_user_org_id());

DROP POLICY IF EXISTS organizations_update_admin ON public.organizations;
CREATE POLICY organizations_update_admin ON public.organizations
  FOR UPDATE TO authenticated
  USING (id = public.current_user_org_id() AND public.current_user_role() IN ('OWNER', 'ADMIN'))
  WITH CHECK (id = public.current_user_org_id());

-- ============================================================
-- users — mapped 1:1 to auth.users
-- ============================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS users_select_self ON public.users;
CREATE POLICY users_select_self ON public.users
  FOR SELECT TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS users_select_same_org ON public.users;
CREATE POLICY users_select_same_org ON public.users
  FOR SELECT TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN', 'HR')
  );

DROP POLICY IF EXISTS users_update_self ON public.users;
CREATE POLICY users_update_self ON public.users
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND organization_id = public.current_user_org_id());

DROP POLICY IF EXISTS users_update_admin ON public.users;
CREATE POLICY users_update_admin ON public.users
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
  )
  WITH CHECK (organization_id = public.current_user_org_id());

-- ============================================================
-- employees — HR data
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

DROP POLICY IF EXISTS employees_delete_admin ON public.employees;
CREATE POLICY employees_delete_admin ON public.employees
  FOR DELETE TO authenticated
  USING (
    organization_id = public.current_user_org_id()
    AND public.current_user_role() IN ('OWNER', 'ADMIN')
  );

-- ============================================================
-- Permissions — grant authenticated base access (RLS gates rows)
-- ============================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
