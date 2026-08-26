-- ============================================================
-- Smart Archive — HR Module Setup SQL (وحدة الموارد البشرية)
-- شغّل هذا الكود في: Supabase Dashboard → SQL Editor
-- بعد تشغيله يصبح بالإمكان إدارة الملفات الرقمية للموظفين،
-- التوظيف والمرشحين، وشؤون الشركة الإدارية (السياسات، التراخيص،
-- المراسلات الحكومية) بشكل دائم في قاعدة البيانات.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. الموظفون
CREATE TABLE IF NOT EXISTS public.employees (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  national_id      TEXT,
  position         TEXT,
  department       TEXT,
  phone            TEXT,
  email            TEXT,
  hire_date        DATE,
  employment_type  TEXT NOT NULL DEFAULT 'full_time',
  status           TEXT NOT NULL DEFAULT 'active',
  probation_days   INTEGER NOT NULL DEFAULT 90,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. الملف الرقمي للموظف — مستندات مصنّفة تلقائياً إلى 4 فئات
--    (شخصي / عقود وقرارات / شهادات ومؤهلات / تقييم أداء)
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  category     TEXT NOT NULL DEFAULT 'personal',
  name         TEXT NOT NULL,
  url          TEXT NOT NULL,
  mime_type    TEXT,
  size         BIGINT,
  description  TEXT,
  expiry_date  DATE,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. الإجازات — لتنبيهات بداية/نهاية الإجازة
CREATE TABLE IF NOT EXISTS public.employee_leaves (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type   TEXT NOT NULL DEFAULT 'annual',
  start_date   DATE NOT NULL,
  end_date     DATE NOT NULL,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. المرشحون للتوظيف (يشمل بيانات العرض الوظيفي كحقول مباشرة إبقاءً للبساطة)
CREATE TABLE IF NOT EXISTS public.job_candidates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  phone             TEXT,
  email             TEXT,
  position_applied  TEXT,
  cv_url            TEXT,
  skills            JSONB NOT NULL DEFAULT '[]'::JSONB,
  status            TEXT NOT NULL DEFAULT 'new',
  offer_status      TEXT NOT NULL DEFAULT 'none',
  offer_salary      NUMERIC,
  offer_start_date  DATE,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. سياسات الشركة
CREATE TABLE IF NOT EXISTS public.company_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT NOT NULL,
  category        TEXT,
  file_url        TEXT,
  description     TEXT,
  effective_date  DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. التراخيص والسجلات الحكومية للشركة
CREATE TABLE IF NOT EXISTS public.company_licenses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  license_number     TEXT,
  issuing_authority  TEXT,
  issue_date         DATE,
  expiry_date        DATE,
  file_url           TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. المراسلات الحكومية
CREATE TABLE IF NOT EXISTS public.gov_correspondence (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject     TEXT NOT NULL,
  direction   TEXT NOT NULL DEFAULT 'outgoing',
  authority   TEXT,
  date        DATE,
  reference   TEXT,
  file_url    TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. صلاحية الوصول لوحدة الموارد البشرية — علم بسيط واحد لكل حساب موظف
--    (المدير لديه وصول كامل دائماً بغض النظر عن هذا العلم)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hr_access BOOLEAN NOT NULL DEFAULT false;

-- فهارس
CREATE INDEX IF NOT EXISTS employee_documents_employee_idx ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS employee_leaves_employee_idx    ON public.employee_leaves(employee_id);

-- تفعيل RLS. المتصفح لا يتواصل مطلقاً مع جداول الموارد البشرية مباشرة —
-- كل الوصول يمر عبر خادم API الذي يستخدم مفتاح service role. لذلك السياسة
-- أدناه مقيّدة صراحة بدور service_role فقط (TO service_role)، بينما لا تحصل
-- الأدوار anon/authenticated (التي يستخدمها مفتاح المتصفح العام) على أي
-- سياسة إطلاقاً، أي أن RLS يمنعها من قراءة/تعديل هذه البيانات تماماً حتى لو
-- استُخرج مفتاح anon من كود المتصفح.
ALTER TABLE public.employees           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_leaves     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_candidates      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_policies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_licenses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gov_correspondence  ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  hr_table TEXT;
BEGIN
  FOREACH hr_table IN ARRAY ARRAY[
    'employees', 'employee_documents', 'employee_leaves', 'job_candidates',
    'company_policies', 'company_licenses', 'gov_correspondence'
  ]
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      hr_table || '_service_all',
      hr_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      hr_table || '_service_all',
      hr_table
    );
  END LOOP;
END $$;

-- ============================================================
-- ✅ بعد تشغيل هذا الكود تصبح وحدة الموارد البشرية جاهزة للاستخدام
--    (الملفات الرقمية للموظفين، التوظيف والمرشحين، وشؤون الشركة)
-- ============================================================
