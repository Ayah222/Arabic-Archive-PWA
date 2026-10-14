-- Enforce one organization per Supabase account and apply the app's role
-- permissions at the database boundary as defense in depth.

CREATE UNIQUE INDEX IF NOT EXISTS organization_memberships_single_org_user_idx
  ON public.organization_memberships (user_id)
  WHERE user_id <> 'admin';

CREATE OR REPLACE FUNCTION public.tenant_has_membership(target_tenant UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
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

CREATE OR REPLACE FUNCTION public.tenant_has_role(target_tenant UUID, allowed_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_memberships AS membership
    WHERE membership.tenant_id = target_tenant
      AND membership.user_id = auth.uid()::text
      AND membership.status = 'active'
      AND membership.role = ANY (allowed_roles)
  );
$$;

REVOKE ALL ON FUNCTION public.tenant_has_membership(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.tenant_has_role(UUID, TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tenant_has_membership(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tenant_has_role(UUID, TEXT[]) TO authenticated;
GRANT SELECT ON public.organization_memberships TO authenticated;

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'projects', 'contracts', 'contractors', 'documents', 'meetings', 'letters',
    'finance_records', 'contacts', 'categories', 'attachments',
    'project_photos', 'notifications', 'agencies', 'employees',
    'employee_documents', 'employee_leaves', 'job_candidates', 'company_policies',
    'company_licenses', 'gov_correspondence', 'messages'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant_member', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant_select', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant_insert', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant_update', table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', table_name || '_tenant_delete', table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.tenant_has_membership(tenant_id))',
      table_name || '_tenant_select',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.tenant_has_role(tenant_id, ARRAY[''admin'', ''data_entry'']))',
      table_name || '_tenant_insert',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.tenant_has_role(tenant_id, ARRAY[''admin'', ''data_entry''])) WITH CHECK (public.tenant_has_role(tenant_id, ARRAY[''admin'', ''data_entry'']))',
      table_name || '_tenant_update',
      table_name
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.tenant_has_role(tenant_id, ARRAY[''admin'']))',
      table_name || '_tenant_delete',
      table_name
    );
  END LOOP;
END
$$;

-- Audit history is written only by the trusted API service role.
DROP POLICY IF EXISTS audit_logs_tenant_member ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_update ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_delete ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_select ON public.audit_logs;
CREATE POLICY audit_logs_tenant_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.tenant_has_membership(tenant_id));

-- Invitations contain account workflow data and remain server-only.
DROP POLICY IF EXISTS invitations_tenant_member ON public.invitations;
DROP POLICY IF EXISTS invitations_tenant_select ON public.invitations;
DROP POLICY IF EXISTS invitations_tenant_insert ON public.invitations;
DROP POLICY IF EXISTS invitations_tenant_update ON public.invitations;
DROP POLICY IF EXISTS invitations_tenant_delete ON public.invitations;
