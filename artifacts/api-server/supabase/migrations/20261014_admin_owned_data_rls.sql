-- Administrative audit history and notification state are server-owned.
-- Keep them inside the tenant, and restrict direct authenticated access to admins.

DROP POLICY IF EXISTS audit_logs_tenant_select ON public.audit_logs;
CREATE POLICY audit_logs_tenant_select ON public.audit_logs
  FOR SELECT TO authenticated
  USING (public.tenant_has_role(tenant_id, ARRAY['admin']));

DROP POLICY IF EXISTS notifications_tenant_select ON public.notifications;
DROP POLICY IF EXISTS notifications_tenant_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_tenant_update ON public.notifications;
DROP POLICY IF EXISTS notifications_tenant_delete ON public.notifications;
CREATE POLICY notifications_tenant_select ON public.notifications
  FOR SELECT TO authenticated
  USING (public.tenant_has_role(tenant_id, ARRAY['admin']));
CREATE POLICY notifications_tenant_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.tenant_has_role(tenant_id, ARRAY['admin']));
CREATE POLICY notifications_tenant_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (public.tenant_has_role(tenant_id, ARRAY['admin']))
  WITH CHECK (public.tenant_has_role(tenant_id, ARRAY['admin']));
CREATE POLICY notifications_tenant_delete ON public.notifications
  FOR DELETE TO authenticated
  USING (public.tenant_has_role(tenant_id, ARRAY['admin']));
