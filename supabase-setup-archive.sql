-- ============================================================
-- Smart Archive — Archive Data Setup SQL (Prompt: تفريغ البيانات الوهمية)
-- شغّل هذا الكود في: Supabase Dashboard → SQL Editor
-- بعد تشغيله تُخزَّن المشاريع والعقود والمقاولون والخطابات والمستندات
-- والاجتماعات والشؤون المالية وجهات الاتصال وسجل النشاط بشكل دائم
-- بدلاً من الذاكرة المؤقتة للخادم.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. المشاريع
CREATE TABLE IF NOT EXISTS public.projects (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  client       TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'active',
  progress     INTEGER NOT NULL DEFAULT 0,
  start_date   DATE NOT NULL,
  end_date     DATE,
  budget       NUMERIC,
  location     TEXT,
  cover_image  TEXT,
  maps_url     TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. العقود
CREATE TABLE IF NOT EXISTS public.contracts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  party       TEXT NOT NULL,
  value       NUMERIC NOT NULL,
  start_date  DATE NOT NULL,
  end_date    DATE NOT NULL,
  status      TEXT NOT NULL DEFAULT 'active',
  notes       TEXT,
  file_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. المقاولون
CREATE TABLE IF NOT EXISTS public.contractors (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  specialty   TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  notes       TEXT,
  rating      JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. المستندات (مع سجل الإصدارات)
CREATE TABLE IF NOT EXISTS public.documents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  doc_ref           TEXT NOT NULL,
  type              TEXT NOT NULL,
  url               TEXT NOT NULL,
  size              BIGINT,
  notes             TEXT,
  revisions         JSONB NOT NULL DEFAULT '[]'::JSONB,
  current_revision  INTEGER NOT NULL DEFAULT 0,
  approval_status   TEXT NOT NULL DEFAULT 'under_review',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. الاجتماعات
CREATE TABLE IF NOT EXISTS public.meetings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  date        DATE NOT NULL,
  location    TEXT,
  attendees   JSONB NOT NULL DEFAULT '[]'::JSONB,
  agenda      TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. الخطابات
CREATE TABLE IF NOT EXISTS public.letters (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  subject              TEXT NOT NULL,
  direction            TEXT NOT NULL,
  from_party           TEXT NOT NULL,
  to_party             TEXT NOT NULL,
  date                 DATE NOT NULL,
  reference            TEXT,
  auto_ref             TEXT NOT NULL,
  recipients           JSONB NOT NULL DEFAULT '[]'::JSONB,
  distribution_status  TEXT NOT NULL DEFAULT 'not_sent',
  notes                TEXT,
  file_url             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. الشؤون المالية
CREATE TABLE IF NOT EXISTS public.finance_records (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  amount         NUMERIC NOT NULL,
  type           TEXT NOT NULL,
  category       TEXT NOT NULL,
  date           DATE NOT NULL,
  reminder_date  DATE,
  notes          TEXT,
  project_id     UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. جهات الاتصال
CREATE TABLE IF NOT EXISTS public.contacts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  role        TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. تصنيفات المستندات المخصصة
CREATE TABLE IF NOT EXISTS public.categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. المرفقات
CREATE TABLE IF NOT EXISTS public.attachments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  data_url     TEXT NOT NULL,
  name         TEXT NOT NULL,
  custom_type  TEXT NOT NULL DEFAULT 'مستند',
  mime_type    TEXT NOT NULL DEFAULT 'application/octet-stream',
  size         BIGINT NOT NULL DEFAULT 0,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. سجل النشاط
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      TEXT NOT NULL,
  user_label   TEXT NOT NULL,
  action       TEXT NOT NULL,
  entity       TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  description  TEXT NOT NULL,
  "timestamp"  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- فهارس لتسريع الاستعلامات المرتبطة بالمشروع
CREATE INDEX IF NOT EXISTS contracts_project_id_idx    ON public.contracts(project_id);
CREATE INDEX IF NOT EXISTS contractors_project_id_idx  ON public.contractors(project_id);
CREATE INDEX IF NOT EXISTS documents_project_id_idx    ON public.documents(project_id);
CREATE INDEX IF NOT EXISTS meetings_project_id_idx     ON public.meetings(project_id);
CREATE INDEX IF NOT EXISTS letters_project_id_idx      ON public.letters(project_id);
CREATE INDEX IF NOT EXISTS finance_records_project_idx ON public.finance_records(project_id);
CREATE INDEX IF NOT EXISTS contacts_project_id_idx     ON public.contacts(project_id);
CREATE INDEX IF NOT EXISTS categories_project_id_idx   ON public.categories(project_id);
CREATE INDEX IF NOT EXISTS attachments_project_id_idx  ON public.attachments(project_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx       ON public.audit_logs(entity);

-- تفعيل RLS — الخادم يستخدم مفتاح service role الذي يتجاوز RLS دائماً،
-- ونضيف سياسات صريحة بنفس نمط supabase-setup.sql لبقية الجداول.
ALTER TABLE public.projects       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contractors    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meetings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.letters        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  archive_table TEXT;
BEGIN
  FOREACH archive_table IN ARRAY ARRAY[
    'projects', 'contracts', 'contractors', 'documents', 'meetings',
    'letters', 'finance_records', 'contacts', 'categories', 'attachments', 'audit_logs'
  ]
  LOOP
    -- PostgreSQL supports IF EXISTS for DROP POLICY, but not
    -- IF NOT EXISTS for CREATE POLICY. Remove only this script's
    -- named policy so the script can be safely run again.
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I',
      archive_table || '_service_all',
      archive_table
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (true) WITH CHECK (true)',
      archive_table || '_service_all',
      archive_table
    );
  END LOOP;
END $$;

-- ============================================================
-- ✅ بعد تشغيل هذا الكود يصبح أرشيف المشاريع جاهزاً للبيانات الحقيقية
--    (تم حذف كل المشاريع والعقود والمقاولين التجريبية من كود الخادم)
-- ============================================================
