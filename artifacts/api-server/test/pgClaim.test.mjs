// REAL Postgres validation of the lease and the fence.
//
// Phase 18CA proved the claiming rule against an in-memory fake. A fake
// cannot prove that the SQL compiles, that "for update skip locked" behaves
// as claimed under genuine concurrent transactions, or that the function
// signatures match what the application sends. This runs the actual
// migration against a throwaway PostgreSQL cluster and drives it with real
// concurrent connections.
//
// It touches NO production database. The cluster is created in a temporary
// directory, listens on a unix socket only, and is destroyed afterwards.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// pg lives in the pnpm store at the workspace root, not in this
// package's node_modules. Importing it by absolute path avoids adding
// anything to a node_modules tree that production shares.
const pg = (await import(process.env.PGCLAIM_PG)).default;

const DSN = process.env.PGCLAIM_DSN;
const MIGRATION = process.env.PGCLAIM_MIGRATION;

let pool;

before(async () => {
  pool = new pg.Pool({ connectionString: DSN, max: 12 });
  // The claim function references tenant_storage_connections, and a
  // language-sql function is validated at CREATE time - so the table it
  // joins must exist first. In production it already does.
  await pool.query(`
    create table if not exists public.tenant_storage_connections (
      tenant_id uuid primary key,
      provider  text not null
    );
  `);
  // the real migration, verbatim - not a hand-copied subset
  await pool.query(readFileSync(MIGRATION, "utf8"));
});

after(async () => {
  await pool?.end();
});

async function reset(tenants, provider = "google_drive") {
  await pool.query("truncate public.drive_connection_health");
  await pool.query("truncate public.tenant_storage_connections");
  for (const id of tenants) {
    await pool.query(
      "insert into public.tenant_storage_connections (tenant_id, provider) values ($1, $2)",
      [id, provider]);
  }
  await pool.query("select public.ensure_drive_health_rows()");
  // The database sets next_due_at from its own clock, so the probe time
  // must come from the same clock. Comparing it with a JS Date races when
  // the two land in the same millisecond.
  const { rows } = await pool.query("select (now() + interval '1 second') as t");
  return rows[0].t;
}

const T1 = "11111111-1111-4111-8111-111111111111";
const T2 = "22222222-2222-4222-8222-222222222222";
const T3 = "33333333-3333-4333-8333-333333333333";

const claim = (now, lease, limit, instance) =>
  pool.query(`select * from public.claim_drive_health_rows(
      p_now => $1, p_lease_seconds => $2, p_limit => $3, p_instance => $4)`,
    [now, lease, limit, instance]);

test("the migration applies cleanly to a real PostgreSQL", async () => {
  const { rows } = await pool.query(`
    select table_name from information_schema.tables
     where table_schema = 'public' and table_name = 'drive_connection_health'`);
  assert.equal(rows.length, 1);
  const fns = await pool.query(`
    select routine_name from information_schema.routines
     where routine_schema = 'public'
       and routine_name in ('claim_drive_health_rows','save_drive_health_row',
                            'ensure_drive_health_rows')
     order by routine_name`);
  assert.deepEqual(fns.rows.map((r) => r.routine_name),
    ["claim_drive_health_rows", "ensure_drive_health_rows", "save_drive_health_row"]);
});

test("only tenants with a google_drive connection are registered", async () => {
  await reset([T1, T2]);
  await pool.query(
    "insert into public.tenant_storage_connections (tenant_id, provider) values ($1,$2)",
    [T3, "dropbox"]);
  await pool.query("select public.ensure_drive_health_rows()");
  const { rows } = await pool.query("select tenant_id from public.drive_connection_health order by tenant_id");
  assert.deepEqual(rows.map((r) => r.tenant_id).sort(), [T1, T2].sort(),
    "a tenant with no Drive connection must never be monitored");
});

test("registration is idempotent", async () => {
  await reset([T1]);
  await pool.query("select public.ensure_drive_health_rows()");
  await pool.query("select public.ensure_drive_health_rows()");
  const { rows } = await pool.query("select count(*)::int as n from public.drive_connection_health");
  assert.equal(rows[0].n, 1);
});

// ------------------------------------------------- REAL concurrent claims
test("CONCURRENT claims hand each row to exactly ONE worker", async () => {
  const tenants = [T1, T2, T3];
  const now = await reset(tenants);
  const results = await Promise.all([
    claim(now, 900, 10, "w1"), claim(now, 900, 10, "w2"),
    claim(now, 900, 10, "w3"), claim(now, 900, 10, "w4"),
  ]);
  const claimed = results.flatMap((r) => r.rows.map((row) => row.tenant_id));
  assert.equal(claimed.length, tenants.length, "every row claimed exactly once in total");
  assert.equal(new Set(claimed).size, tenants.length, "no row handed to two workers");
});

test("a second claim inside the lease returns nothing", async () => {
  const now = await reset([T1]);
  const first = await claim(now, 900, 10, "w1");
  assert.equal(first.rows.length, 1);
  const second = await claim(now, 900, 10, "w2");
  assert.equal(second.rows.length, 0, "the lease has not expired");
});

test("the row becomes claimable again after the lease expires", async () => {
  const t0 = new Date(await reset([T1]));
  await claim(t0.toISOString(), 1, 10, "w1");
  const later = new Date(t0.getTime() + 5000).toISOString();
  const again = await claim(later, 900, 10, "w2");
  assert.equal(again.rows.length, 1);
  assert.equal(again.rows[0].claimed_by, "w2");
});

test("every claim mints a NEW fence token", async () => {
  await reset([T1]);
  const t0 = new Date();
  const a = await claim(t0.toISOString(), 1, 10, "w1");
  const b = await claim(new Date(t0.getTime() + 5000).toISOString(), 900, 10, "w2");
  assert.notEqual(a.rows[0].lease_token, b.rows[0].lease_token);
});

// --------------------------------------------------------------- fencing
// NAMED notation on purpose. The application calls this through PostgREST
// with named parameters, so a renamed parameter would break production
// while a positional test stayed green.
const save = (tenantId, token, state, reason) =>
  pool.query(`select public.save_drive_health_row(
      p_tenant_id            => $1,
      p_lease_token          => $2,
      p_state                => $3,
      p_reason               => $4,
      p_consecutive_failures => $5,
      p_last_checked_at      => now(),
      p_last_success_at      => now(),
      p_last_failure_at      => null,
      p_last_failure_reason  => null,
      p_last_alert_state     => null,
      p_last_alert_at        => null,
      p_last_delivery_status => null,
      p_last_delivery_error  => null,
      p_transitions          => '[]'::jsonb) as written`,
    [tenantId, token, state, reason, 0]);

test("the holder of the fence can write", async () => {
  const t = await reset([T1]);
  const claimed = await claim(t, 900, 10, "w1");
  const token = claimed.rows[0].lease_token;
  const { rows } = await save(T1, token, "healthy", "ok");
  assert.equal(rows[0].written, 1);
  const stored = await pool.query("select state from public.drive_connection_health where tenant_id=$1", [T1]);
  assert.equal(stored.rows[0].state, "healthy");
});

test("A STALE WORKER CANNOT OVERWRITE A NEWER RESULT", async () => {
  // the scenario the fence exists for: a worker is paused past its lease,
  // a newer worker takes the row and finishes, then the old one wakes up
  await reset([T1]);
  const t0 = new Date();
  const slow = await claim(t0.toISOString(), 1, 10, "slow");
  const slowToken = slow.rows[0].lease_token;

  const fast = await claim(new Date(t0.getTime() + 5000).toISOString(), 900, 10, "fast");
  const fastToken = fast.rows[0].lease_token;
  await save(T1, fastToken, "reauth_required", "invalid_grant");

  const late = await save(T1, slowToken, "healthy", "ok");
  assert.equal(late.rows[0].written, 0, "the stale write must match zero rows");

  const stored = await pool.query("select state, reason from public.drive_connection_health where tenant_id=$1", [T1]);
  assert.equal(stored.rows[0].state, "reauth_required", "the newer result survived");
  assert.equal(stored.rows[0].reason, "invalid_grant");
});

test("a forged or absent token writes nothing", async () => {
  const t = await reset([T1]);
  await claim(t, 900, 10, "w1");
  const forged = await save(T1, "99999999-9999-4999-8999-999999999999", "healthy", "ok");
  assert.equal(forged.rows[0].written, 0);
});

test("a worker that crashes before writing loses only its own result", async () => {
  await reset([T1]);
  const t0 = new Date();
  await claim(t0.toISOString(), 1, 10, "crashed");          // never writes
  const next = await claim(new Date(t0.getTime() + 5000).toISOString(), 900, 10, "w2");
  assert.equal(next.rows.length, 1, "the row is recovered by the next worker");
  const { rows } = await save(T1, next.rows[0].lease_token, "healthy", "ok");
  assert.equal(rows[0].written, 1);
});

test("the limit is respected and the oldest due rows go first", async () => {
  await reset([T1, T2, T3]);
  await pool.query("update public.drive_connection_health set next_due_at = now() - interval '10 minutes' where tenant_id=$1", [T1]);
  await pool.query("update public.drive_connection_health set next_due_at = now() - interval '5 minutes' where tenant_id=$1", [T2]);
  await pool.query("update public.drive_connection_health set next_due_at = now() - interval '1 minute' where tenant_id=$1", [T3]);
  const { rows } = await claim(new Date().toISOString(), 900, 2, "w1");
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((r) => r.tenant_id).sort(), [T1, T2].sort());
});

test("the state constraint rejects an unknown state", async () => {
  await reset([T1]);
  await assert.rejects(() => pool.query(
    "update public.drive_connection_health set state='nonsense' where tenant_id=$1", [T1]));
});

test("concurrent claim and write do not deadlock under load", async () => {
  const many = Array.from({ length: 8 }, (_, i) =>
    `${String(i + 1).repeat(8)}-aaaa-4aaa-8aaa-${String(i + 1).repeat(12)}`);
  const now = await reset(many);
  const workers = Array.from({ length: 6 }, (_, w) => (async () => {
    const claimed = await claim(now, 900, 3, `w${w}`);
    for (const row of claimed.rows) {
      await save(row.tenant_id, row.lease_token, "healthy", "ok");
    }
    return claimed.rows.length;
  })());
  const counts = await Promise.all(workers);
  assert.equal(counts.reduce((a, b) => a + b, 0), many.length,
    "every row claimed exactly once across six concurrent workers");
});
