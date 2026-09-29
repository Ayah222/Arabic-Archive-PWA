-- ============================================================
-- Smart Archive — Supabase Setup SQL
-- شغّل هذا الكود في: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. جدول بيانات الموظفين (مرتبط بـ Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  name        TEXT,
  role        TEXT NOT NULL DEFAULT 'employee',
  status      TEXT NOT NULL DEFAULT 'pending',
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
  hr_access   BOOLEAN NOT NULL DEFAULT FALSE,
  invited_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. جدول الدعوات
CREATE TABLE IF NOT EXISTS public.invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT UNIQUE NOT NULL,
  token       TEXT UNIQUE NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used        BOOLEAN NOT NULL DEFAULT FALSE
);

-- 3. تفعيل RLS (Row Level Security)
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hr_access BOOLEAN NOT NULL DEFAULT FALSE;

-- Remove any broad or legacy policies. Only the trusted server uses the
-- service-role key; browser clients must use authenticated API routes instead.
DO $$
DECLARE policy_row RECORD;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('profiles', 'invitations')
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END
$$;

CREATE POLICY "profiles_service_role_access"
  ON public.profiles FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "profiles_deny_client_access"
  ON public.profiles FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "invitations_service_role_access"
  ON public.invitations FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "invitations_deny_client_access"
  ON public.invitations FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);

-- Explicit grants are required when tables are created through a managed
-- migration API instead of the Supabase SQL Editor.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.invitations FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================
-- ✅ بعد تشغيل هذا الكود يصبح النظام جاهزاً للدعوات والتفعيل
-- ============================================================

