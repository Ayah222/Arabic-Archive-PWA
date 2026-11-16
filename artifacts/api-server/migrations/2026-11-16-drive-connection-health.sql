-- ArchHive - durable Google Drive connection monitoring
-- Phase 18CB. PREPARED, NOT APPLIED. Running this is an owner action.
--
-- WHY THIS TABLE EXISTS
-- Monitor state was held in memory, which fails three ways on Autoscale: the
-- history dies on every restart, each instance keeps a separate copy, and
-- "has the connection been healthy for eight days" cannot be answered from
-- memory that resets.
--
-- TWO MECHANISMS, AND THEY ARE NOT THE SAME THING
--   next_due_at  is the LEASE. It decides WHO may work on a tenant now.
--   lease_token  is the FENCE. It decides WHOSE RESULT is still valid when
--                the work finishes.
-- A lease alone is not enough: a worker can be paused past its lease, the
-- row gets re-claimed by a newer worker, and then the old worker wakes up
-- and writes a stale result over the fresh one. The fence closes that: every
-- claim mints a new token, and a write only applies if the token still
-- matches. A stale worker's update matches zero rows and is discarded.

create table if not exists public.drive_connection_health (
  tenant_id              uuid primary key,
  state                  text        not null default 'disconnected',
  reason                 text        not null default 'never_checked',
  consecutive_failures   integer     not null default 0,
  last_checked_at        timestamptz,
  last_success_at        timestamptz,
  last_failure_at        timestamptz,
  last_failure_reason    text,
  -- the lease: a row may be claimed only when now() >= next_due_at
  next_due_at            timestamptz not null default now(),
  -- the fence: regenerated on every claim; a write must present it
  lease_token            uuid        not null default gen_random_uuid(),
  claimed_by             text,
  claimed_at             timestamptz,
  last_alert_state       text,
  last_alert_at          timestamptz,
  last_delivery_status   text,
  last_delivery_error    text,
  -- bounded in application code to the most recent 50 entries
  transitions            jsonb       not null default '[]'::jsonb,
  updated_at             timestamptz not null default now(),

  constraint drive_connection_health_state_check check (
    state in ('healthy', 'degraded', 'reauth_required', 'disconnected', 'misconfigured')
  ),
  constraint drive_connection_health_delivery_check check (
    last_delivery_status is null
    or last_delivery_status in ('delivered', 'failed', 'pending')
  )
);

-- the only query the claim path runs, so it is the only index needed
create index if not exists drive_connection_health_due_idx
  on public.drive_connection_health (next_due_at);

-- No customer data and no credential: states, machine reasons, timestamps
-- and counters. Tenant-scoped nonetheless, and the service role is the only
-- writer, so RLS is enabled with no permissive policy - matching how the
-- other operational tables are treated.
alter table public.drive_connection_health enable row level security;

comment on table public.drive_connection_health is
  'Google Drive OAuth connection health per tenant. No credentials, no customer data.';
comment on column public.drive_connection_health.next_due_at is
  'Lease. A monitoring worker may claim this row only when now() >= next_due_at.';
comment on column public.drive_connection_health.lease_token is
  'Fence. Regenerated on every claim; a write must present the current token.';

-- ---------------------------------------------------------------------------
-- THE CLAIM
--
-- "for update skip locked" is what lets several instances run this at the
-- same moment without blocking: each takes a different set of rows, and no
-- row is ever handed to two workers.
--
-- The join to tenant_storage_connections is the "only monitor real
-- connections" rule. A tenant with no google_drive row has nothing to probe,
-- and probing it would manufacture a disconnected alert for a tenant that
-- never asked for Drive.
-- ---------------------------------------------------------------------------
create or replace function public.claim_drive_health_rows(
  p_now            timestamptz,
  p_lease_seconds  integer,
  p_limit          integer,
  p_instance       text
)
returns setof public.drive_connection_health
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  update public.drive_connection_health h
     set next_due_at = p_now + make_interval(secs => greatest(p_lease_seconds, 1)),
         lease_token = gen_random_uuid(),
         claimed_by  = p_instance,
         claimed_at  = p_now,
         updated_at  = p_now
   where h.tenant_id in (
           select c.tenant_id
             from public.drive_connection_health c
             join public.tenant_storage_connections t
               on t.tenant_id = c.tenant_id
              and t.provider = 'google_drive'
            where c.next_due_at <= p_now
            order by c.next_due_at
            limit greatest(coalesce(p_limit, 50), 0)
            for update of c skip locked
         )
  returning h.*;
$$;

comment on function public.claim_drive_health_rows is
  'Atomically leases due rows to one worker. Mints a new fence token per claim.';

-- ---------------------------------------------------------------------------
-- THE FENCED WRITE
--
-- Returns the number of rows written: 1 when this worker still holds the
-- fence, 0 when a newer worker has taken over. The caller treats 0 as
-- "discard my result", never as an error - being overtaken is normal when a
-- worker is slow, and the newer result is the correct one.
-- ---------------------------------------------------------------------------
create or replace function public.save_drive_health_row(
  p_tenant_id            uuid,
  p_lease_token          uuid,
  p_state                text,
  p_reason               text,
  p_consecutive_failures integer,
  p_last_checked_at      timestamptz,
  p_last_success_at      timestamptz,
  p_last_failure_at      timestamptz,
  p_last_failure_reason  text,
  p_last_alert_state     text,
  p_last_alert_at        timestamptz,
  p_last_delivery_status text,
  p_last_delivery_error  text,
  p_transitions          jsonb
)
returns integer
language plpgsql
volatile
security invoker
set search_path = public, pg_temp
as $$
declare
  v_written integer;
begin
  update public.drive_connection_health
     set state                = p_state,
         reason               = p_reason,
         consecutive_failures = p_consecutive_failures,
         last_checked_at      = p_last_checked_at,
         last_success_at      = p_last_success_at,
         last_failure_at      = p_last_failure_at,
         last_failure_reason  = p_last_failure_reason,
         last_alert_state     = p_last_alert_state,
         last_alert_at        = p_last_alert_at,
         last_delivery_status = p_last_delivery_status,
         last_delivery_error  = p_last_delivery_error,
         transitions          = p_transitions,
         updated_at           = now()
   where tenant_id   = p_tenant_id
     and lease_token = p_lease_token;   -- the fence
  get diagnostics v_written = row_count;
  return v_written;
end;
$$;

comment on function public.save_drive_health_row is
  'Writes a monitoring result only if the caller still holds the fence token.';

-- ---------------------------------------------------------------------------
-- REGISTRATION. Idempotent, and only for tenants that actually have a Drive
-- connection - the same rule the claim enforces.
-- ---------------------------------------------------------------------------
create or replace function public.ensure_drive_health_rows()
returns integer
language sql
volatile
security invoker
set search_path = public, pg_temp
as $$
  with inserted as (
    insert into public.drive_connection_health (tenant_id)
    select t.tenant_id
      from public.tenant_storage_connections t
     where t.provider = 'google_drive'
    on conflict (tenant_id) do nothing
    returning 1
  )
  select coalesce(count(*), 0)::integer from inserted;
$$;

-- Execute is granted to PUBLIC by default, and PostgREST publishes every
-- function in the public schema. Security invoker plus RLS already means an
-- anonymous caller would get nothing back, but an unauthenticated endpoint
-- that exists at all is surface that does not need to exist. Only the
-- service role runs the monitor.
--
-- Guarded by role existence so the same file applies verbatim to a bare
-- PostgreSQL in the test harness, where the Supabase roles do not exist.
do $grants$
declare
  fn text;
begin
  foreach fn in array array[
    'public.claim_drive_health_rows(timestamptz, integer, integer, text)',
    'public.save_drive_health_row(uuid, uuid, text, text, integer, timestamptz, timestamptz, timestamptz, text, text, timestamptz, text, text, jsonb)',
    'public.ensure_drive_health_rows()'
  ] loop
    execute format('revoke execute on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke execute on function %s from anon', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'authenticated') then
      execute format('revoke execute on function %s from authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end
$grants$;

-- ROLLBACK
--   drop function if exists public.ensure_drive_health_rows();
--   drop function if exists public.save_drive_health_row(uuid, uuid, text, text,
--     integer, timestamptz, timestamptz, timestamptz, text, text, timestamptz,
--     text, text, jsonb);
--   drop function if exists public.claim_drive_health_rows(timestamptz, integer,
--     integer, text);
--   drop table if exists public.drive_connection_health;
-- Nothing else references any of them. Dropping loses monitoring history and
-- nothing else; no customer data is involved.
