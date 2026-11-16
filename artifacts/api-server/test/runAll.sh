#!/usr/bin/env bash
# The single reproducible verification entry point for the durable monitoring
# branch. Run from artifacts/api-server. Touches no production database and
# no network: the HTTP and OAuth harnesses REFUSE to build if a real module
# escapes substitution, and the Postgres suite uses a throwaway cluster.
set -u
cd "$(dirname "$0")/.." || exit 1
ESB=/home/runner/workspace/node_modules/.pnpm/esbuild@0.27.3/node_modules/esbuild/bin/esbuild

echo "=== unit ==="
for f in src/lib/*.test.ts; do
  "$ESB" "$f" --bundle --platform=node --format=esm --packages=external \
    --outfile="src/lib/.$(basename "$f" .test.ts).mjs" --log-level=warning || exit 1
done
( cd src/lib && node --test .*.mjs 2>&1 | grep -E '^. (tests|pass|fail)|^✖' )
rm -f src/lib/.*.mjs

echo "=== oauth ==="
node test/buildOAuthTests.mjs > /dev/null || exit 1
node --test test/.oauth.test.mjs 2>&1 | grep -E '^. (tests|pass|fail)|^✖'
rm -f test/.oauth.test.mjs

echo "=== HTTP ==="
node test/buildRouteTests.mjs > /dev/null || exit 1
node --test test/.routes.test.mjs 2>&1 | grep -E '^. (tests|pass|fail)|^✖'
rm -f test/.routes.test.mjs

echo "=== real postgres ==="
bash test/runPgClaim.sh

echo "=== tsc ==="
npx tsc --noEmit -p tsconfig.json
echo "tsc exit: $?"
