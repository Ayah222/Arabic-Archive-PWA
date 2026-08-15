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
  is_active   BOOLEAN NOT NULL DEFAULT FALSE,
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

-- 4. سياسات الوصول — الجميع يقدر يقرأ (anon key)
CREATE POLICY "profiles_select"    ON public.profiles    FOR SELECT USING (true);
CREATE POLICY "profiles_insert"    ON public.profiles    FOR INSERT WITH CHECK (true);
CREATE POLICY "profiles_update"    ON public.invitations FOR UPDATE USING (true);
CREATE POLICY "invitations_select" ON public.invitations FOR SELECT USING (true);
CREATE POLICY "invitations_insert" ON public.invitations FOR INSERT WITH CHECK (true);
CREATE POLICY "invitations_update" ON public.invitations FOR UPDATE USING (true);

-- 5. تحديث profiles عند تحديث جدول invitations
CREATE POLICY "profiles_update_all" ON public.profiles FOR UPDATE USING (true);

-- ============================================================
-- ✅ بعد تشغيل هذا الكود يصبح النظام جاهزاً للدعوات والتفعيل
-- ============================================================
