-- HR Platform v2 — Signup trigger
-- เมื่อ auth.users มี row ใหม่ → สร้าง public.organizations + public.users อัตโนมัติ
-- Org info อ่านจาก raw_user_meta_data (signup form ส่งเข้ามา)
-- Phase 0 pattern: 1 user = 1 org (user เป็น OWNER), invite flow ทำ Phase 1

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_org_id uuid;
  org_slug text;
  org_name text;
BEGIN
  org_slug := COALESCE(
    NEW.raw_user_meta_data->>'organization_slug',
    'org-' || substring(NEW.id::text from 1 for 8)
  );
  org_name := COALESCE(
    NEW.raw_user_meta_data->>'organization_name',
    'My Organization'
  );

  -- Generate UUID + timestamps explicitly (Prisma @default/@updatedAt are client-side)
  new_org_id := gen_random_uuid();
  INSERT INTO public.organizations (id, slug, name, created_at, updated_at)
  VALUES (new_org_id, org_slug, org_name, now(), now());

  INSERT INTO public.users (id, organization_id, email, role, created_at, updated_at)
  VALUES (NEW.id, new_org_id, NEW.email, 'OWNER', now(), now());

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
