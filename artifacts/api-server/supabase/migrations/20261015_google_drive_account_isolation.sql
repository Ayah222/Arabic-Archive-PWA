-- A Google account must not be connected to more than one organization.
-- Refuse to install the constraint when legacy duplicate connections exist;
-- those connections must be reviewed and migrated without deleting file data.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.tenant_storage_connections
    WHERE provider = 'google_drive'
      AND connected_email IS NOT NULL
      AND btrim(connected_email) <> ''
    GROUP BY lower(btrim(connected_email))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Google Drive account isolation migration stopped: one Google account is connected to multiple organizations. Review and migrate those connections before applying this index.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS tenant_storage_connections_unique_drive_account_idx
  ON public.tenant_storage_connections (lower(btrim(connected_email)))
  WHERE provider = 'google_drive'
    AND connected_email IS NOT NULL
    AND btrim(connected_email) <> '';
