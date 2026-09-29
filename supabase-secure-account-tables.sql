-- Lock account and invitation records to trusted server-side operations.
-- The API uses the service_role key; browser anon/authenticated roles receive
-- no table privileges and there are no permissive client-facing RLS policies.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hr_access BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

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

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
REVOKE ALL PRIVILEGES ON TABLE public.profiles, public.invitations
  FROM PUBLIC, anon, authenticated;
GRANT ALL PRIVILEGES ON TABLE public.profiles, public.invitations TO service_role;