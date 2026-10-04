-- Smart Archive: additive multi-tenant foundation.
-- Existing records are retained under the initial organization "الجهة الحالية".
-- Run once against the same Supabase project used by the API.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.organizations (id, name, slug)
VALUES ('00000000-0000-4000-8000-000000000001', 'الجهة الحالية', 'legacy')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.organization_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'data_entry', 'viewer')),
  hr_access BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'pending', 'disabled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, user_id)
);
ALTER TABLE public.organization_memberships
  ADD COLUMN IF NOT EXISTS hr_access BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS organization_memberships_user_idx
  ON public.organization_memberships(user_id, status);

CREATE TABLE IF NOT EXISTS public.tenant_storage_connections (
  tenant_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google_drive')),
  encrypted_credentials JSONB NOT NULL,
  root_folder_id TEXT,
  connected_email TEXT,
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tenant-owned data in the archive, HR, messaging, and invitation domains.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'projects', 'contracts', 'contractors', 'documents', 'meetings', 'letters',
    'finance_records', 'contacts', 'categories', 'attachments', 'audit_logs',
    'project_photos', 'notifications', 'agencies', 'employees',
    'employee_documents', 'employee_leaves', 'job_candidates', 'company_policies',
    'company_licenses', 'gov_correspondence', 'messages', 'invitations'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT',
      table_name
    );
    EXECUTE format(
      'UPDATE public.%I SET tenant_id = %L::uuid WHERE tenant_id IS NULL',
      table_name,
      '00000000-0000-4000-8000-000000000001'
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN tenant_id DROP DEFAULT',
      table_name
    );
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN tenant_id SET NOT NULL', table_name);
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I(tenant_id)',
      table_name || '_tenant_id_idx',
      table_name
    );
    EXECUTE format(
      'CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I(tenant_id, id)',
      table_name || '_tenant_id_id_unique',
      table_name
    );
  END LOOP;
END $$;

-- One authenticated account may be a member of more than one organization.
INSERT INTO public.organization_memberships (tenant_id, user_id, role, hr_access, status)
SELECT
  '00000000-0000-4000-8000-000000000001'::uuid,
  p.id::text,
  CASE WHEN p.role IN ('admin', 'super_admin') THEN 'admin'
       WHEN p.role = 'viewer' THEN 'viewer'
       ELSE 'data_entry' END,
  p.hr_access,
  CASE WHEN p.status = 'active' OR p.is_active IS TRUE THEN 'active' ELSE 'pending' END
FROM public.profiles AS p
ON CONFLICT (tenant_id, user_id) DO NOTHING;

INSERT INTO public.organization_memberships (tenant_id, user_id, role, hr_access, status)
VALUES ('00000000-0000-4000-8000-000000000001', 'admin', 'admin', true, 'active')
ON CONFLICT (tenant_id, user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.tenant_has_membership(target_tenant UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships AS membership
    WHERE membership.tenant_id = target_tenant
      AND membership.user_id = auth.uid()::text
      AND membership.status = 'active'
  );
$$;

REVOKE ALL ON FUNCTION public.tenant_has_membership(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_has_membership(UUID) TO authenticated;
GRANT SELECT ON public.organizations, public.organization_memberships TO authenticated;
GRANT ALL ON public.organizations, public.organization_memberships, public.tenant_storage_connections TO service_role;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_storage_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS organizations_member_read ON public.organizations;
CREATE POLICY organizations_member_read ON public.organizations
  FOR SELECT TO authenticated USING (public.tenant_has_membership(id));
DROP POLICY IF EXISTS memberships_self_read ON public.organization_memberships;
CREATE POLICY memberships_self_read ON public.organization_memberships
  FOR SELECT TO authenticated USING (user_id = auth.uid()::text);
DROP POLICY IF EXISTS organizations_service_all ON public.organizations;
CREATE POLICY organizations_service_all ON public.organizations
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS memberships_service_all ON public.organization_memberships;
CREATE POLICY memberships_service_all ON public.organization_memberships
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS tenant_storage_service_all ON public.tenant_storage_connections;
CREATE POLICY tenant_storage_service_all ON public.tenant_storage_connections
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'projects', 'contracts', 'contractors', 'documents', 'meetings', 'letters',
    'finance_records', 'contacts', 'categories', 'attachments', 'audit_logs',
    'project_photos', 'notifications', 'agencies', 'employees',
    'employee_documents', 'employee_leaves', 'job_candidates', 'company_policies',
    'company_licenses', 'gov_correspondence', 'messages', 'invitations'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant_member', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.tenant_has_membership(tenant_id)) WITH CHECK (public.tenant_has_membership(tenant_id))',
      table_name || '_tenant_member',
      table_name
    );
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_service_all', table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      table_name || '_service_all',
      table_name
    );
  END LOOP;
END $$;

-- Protect project/employee foreign keys from cross-tenant links even when an
-- API handler receives a foreign record ID.
CREATE OR REPLACE FUNCTION public.enforce_same_tenant_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_tenant UUID;
  parent_id UUID;
BEGIN
  parent_id := NULLIF(to_jsonb(NEW) ->> TG_ARGV[1], '')::uuid;
  IF parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  EXECUTE format('SELECT tenant_id FROM public.%I WHERE id = $1', TG_ARGV[0])
    INTO parent_tenant USING parent_id;
  IF parent_tenant IS NULL OR parent_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Referenced record belongs to a different tenant'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  relation RECORD;
BEGIN
  FOR relation IN
    SELECT * FROM (VALUES
      ('contracts', 'projects', 'project_id'),
      ('contractors', 'projects', 'project_id'),
      ('documents', 'projects', 'project_id'),
      ('meetings', 'projects', 'project_id'),
      ('letters', 'projects', 'project_id'),
      ('finance_records', 'projects', 'project_id'),
      ('contacts', 'projects', 'project_id'),
      ('categories', 'projects', 'project_id'),
      ('attachments', 'projects', 'project_id'),
      ('agencies', 'projects', 'project_id'),
      ('project_photos', 'projects', 'project_id'),
      ('notifications', 'projects', 'project_id'),
      ('employee_documents', 'employees', 'employee_id'),
      ('employee_leaves', 'employees', 'employee_id')
    ) AS refs(child_table, parent_table, reference_column)
  LOOP
    IF to_regclass(format('public.%I', relation.child_table)) IS NULL
      OR to_regclass(format('public.%I', relation.parent_table)) IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = relation.child_table
          AND column_name = relation.reference_column
      ) THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      'DROP TRIGGER IF EXISTS %I ON public.%I',
      relation.child_table || '_same_tenant_ref',
      relation.child_table
    );
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF tenant_id, %I ON public.%I FOR EACH ROW EXECUTE FUNCTION public.enforce_same_tenant_reference(%L, %L)',
      relation.child_table || '_same_tenant_ref',
      relation.reference_column,
      relation.child_table,
      relation.parent_table,
      relation.reference_column
    );
  END LOOP;
END $$;