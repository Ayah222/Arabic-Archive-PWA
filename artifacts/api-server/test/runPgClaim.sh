#!/usr/bin/env bash
# Spins up a THROWAWAY PostgreSQL cluster, applies the real migration, runs
# the concurrency and fencing tests against it, then destroys the cluster.
# Touches no production database: unix socket only, temporary directory.
set -u

ROOT=/tmp/pgclaim
export PGDATA="$ROOT/data"
SOCK="$ROOT/sock"

rm -rf "$ROOT"
mkdir -p "$PGDATA" "$SOCK"

initdb -D "$PGDATA" -U runner --auth=trust > "$ROOT/initdb.log" 2>&1
if [ $? -ne 0 ]; then
  echo "initdb FAILED"
  tail -5 "$ROOT/initdb.log"
  exit 1
fi

pg_ctl -D "$PGDATA" -o "-k $SOCK -h ''" -l "$ROOT/pg.log" start > /dev/null 2>&1
sleep 3

psql -h "$SOCK" -U runner -d postgres -c 'create database claimtest' > /dev/null 2>&1
if [ $? -ne 0 ]; then
  echo "could not create the test database"
  tail -10 "$ROOT/pg.log"
  pg_ctl -D "$PGDATA" stop > /dev/null 2>&1
  exit 1
fi

VERSION=$(psql -h "$SOCK" -U runner -d claimtest -tAc 'select version()' | cut -c1-25)
echo "throwaway cluster up: $VERSION"

cd "$HOME/workspace/.local/archhive-mon/artifacts/api-server" || exit 1
PGCLAIM_DSN="postgresql://runner@localhost/claimtest?host=$SOCK" \
PGCLAIM_MIGRATION="$PWD/migrations/2026-11-16-drive-connection-health.sql" \
PGCLAIM_PG="/home/runner/workspace/node_modules/.pnpm/pg@8.20.0/node_modules/pg/lib/index.js" \
node --test test/pgClaim.test.mjs 2>&1 | grep -E 'AssertionError|actual:|expected:|^. (tests|pass|fail)' | head -24

pg_ctl -D "$PGDATA" stop > /dev/null 2>&1
rm -rf "$ROOT"
echo "(cluster destroyed)"
