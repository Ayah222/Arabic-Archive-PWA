-- ArchHive - durable Google Drive connection monitoring
-- Phase 18CA. PREPARED, NOT APPLIED. Running this is an owner action.
--
-- WHY THIS TABLE EXISTS
-- Monitor state was held in memory, which fails in three ways on Autoscale:
-- the history dies on every restart, each instance keeps a separate copy, and
-- "has the connection been healthy for eight days" cannot be answered from
-- memory that resets. One small table fixes all three.
--
-- WHY next_due_at IS THE IMPORTANT COLUMN
-- It is the lease. An instance claims a tenant with a conditional UPDATE that
-- only matches a row whose lease has expired, and the same statement pushes
-- the lease forward. Postgres makes that atomic, so exactly one instance wins
-- and the rest get zero rows. No leader election, no lock service, no timer
-- that must survive a restart.

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

-- This table holds no customer data and no credential: a state, a machine
-- reason, timestamps and counters. It is nonetheless tenant-scoped, and the
-- service role is the only writer, so row level security is enabled with no
-- permissive policy - matching how the other operational tables are treated.
alter table public.drive_connection_health enable row level security;

comment on table public.drive_connection_health is
  'Google Drive OAuth connection health per tenant. No credentials, no customer data.';
comment on column public.drive_connection_health.next_due_at is
  'Lease. A monitoring instance may claim this row only when now() >= next_due_at.';

-- THE CLAIM, for reference. The application issues this; it is recorded here
-- so the atomicity argument is reviewable alongside the schema.
--
--   update public.drive_connection_health
--      set next_due_at = now() + make_interval(secs => $lease_seconds),
--          claimed_by  = $instance_id,
--          claimed_at  = now()
--    where tenant_id in (
--            select tenant_id
--              from public.drive_connection_health
--             where next_due_at <= now()
--             order by next_due_at
--             limit $limit
--             for update skip locked
--          )
--   returning *;
--
-- "for update skip locked" is what lets several instances run the statement
-- at the same moment without blocking each other: each takes a different set
-- of rows, and no row is ever handed to two instances.

-- ROLLBACK
--   drop table if exists public.drive_connection_health;
-- Nothing else references it, so dropping it loses monitoring history and
-- nothing else. No customer data is involved.
