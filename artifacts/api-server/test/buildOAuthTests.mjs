// Builds the OAuth reliability tests.
//
// tenantDrive.ts reaches the database and Google directly. Only those two are
// substituted; the OAuth logic under test is the real, unmodified source.
// The build FAILS if the database fake is not used, so a test cannot quietly
// start talking to production.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");

const FAKES = {
  "lib/supabaseAdmin": `
    export const rows = { connection: null };
    export const calls = { select: 0, upsert: 0, upserted: [] };
    export const supabaseAdmin = () => ({
      from: () => ({
        select: () => { calls.select += 1; return {
          eq: () => ({ maybeSingle: async () => ({ data: rows.connection, error: null }) }),
        }; },
        upsert: async (value) => { calls.upsert += 1; calls.upserted.push(value); return { error: null }; },
      }),
    });
    export const __setConnection = (c) => { rows.connection = c; };
  `,
  "lib/logger": `
    export const lines = [];
    export const logger = {
      info: (...a) => lines.push(a), warn: (...a) => lines.push(a),
      error: (...a) => lines.push(a), debug: (...a) => lines.push(a),
    };
  `,
};

const used = new Set();

await build({
  entryPoints: [join(here, "oauth.test.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: join(here, ".oauth.test.mjs"),
  logLevel: "warning",
  plugins: [{
    name: "oauth-fakes",
    setup(b) {
      b.onResolve({ filter: /.*/ }, (args) => {
        for (const key of Object.keys(FAKES)) {
          const tail = key.split("/").pop();
          if (args.path.endsWith("/" + tail) || args.path === "./" + tail) {
            used.add(key);
            return { path: key, namespace: "fake" };
          }
        }
        return null;
      });
      b.onLoad({ filter: /.*/, namespace: "fake" }, (args) => ({
        contents: FAKES[args.path], loader: "js", resolveDir: join(src, "lib"),
      }));
    },
  }],
});

if (!used.has("lib/supabaseAdmin")) {
  console.error("REFUSED: the database module was not substituted");
  process.exit(1);
}
console.log("oauth harness built; substituted " + used.size + " modules");
