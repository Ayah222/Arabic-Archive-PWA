#!/bin/bash
set -e

# Dependency installation only.
#
# This hook used to end with "pnpm --filter db push", which runs
# "drizzle-kit push" against DATABASE_URL - the live database. The Drizzle
# schema at lib/db/src/schema/index.ts is still the untouched template: its
# body is "export {}" and the only pgTable("posts") sits inside a comment, so
# it declares ZERO tables. Pushing a zero-table schema at a populated database
# does not mean "no changes"; it means "drop everything".
#
# Measured against a throwaway PostgreSQL cluster seeded with three tables:
#
#   Warning  Found data-loss statements:
#   . You're about to delete projects table with 1 items
#   THIS ACTION WILL CAUSE DATA LOSS AND CANNOT BE REVERTED
#   Do you still want to push changes?
#   Error: Interactive prompts require a TTY terminal
#
# Nothing was dropped, but only because no terminal was attached. Replit fires
# this hook on a Git pane pull or merge, and the execution context is not ours
# to guarantee - so the protection was accidental. It is removed rather than
# made conditional: a merge is not the moment to mutate a schema, and nothing
# here needs to.
#
# Schema changes are deliberate, reviewed SQL applied on purpose. See
# artifacts/api-server/migrations/ for the shape that replaces this.
pnpm install --frozen-lockfile
