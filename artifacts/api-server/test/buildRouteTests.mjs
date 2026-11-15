// Builds the HTTP route tests.
//
// The routes import the database, the Google SDK and the session layer
// directly, so there is no constructor to inject through. Rather than
// refactor seven production files to make them testable - a large change
// dressed up as a test - this substitutes those modules AT BUNDLE TIME with
// fakes. The route code under test is the real, unmodified source.
//
// Nothing here can reach Supabase, Google, or Replit Object Storage: the
// modules that could are replaced before the bundle is written, and the
// build FAILS if a replacement is not used.
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, "..", "src");

/** Module specifier -> fake source. Keys are matched on the tail of the path. */
const FAKES = {
  "lib/supabaseAdmin": `export const supabaseAdmin = () => { throw new Error("DB reached in a route test"); };`,

  "lib/tenantContext": `
    let tenant = "tenant-a";
    export const DEFAULT_TENANT_ID = "tenant-default";
    export const currentTenantId = () => tenant;
    export const runWithTenant = async (_t, fn) => fn();
    export const __setTenant = (t) => { tenant = t; };
  `,

  "lib/emailArchiveAuth": `
    let actor = null;
    export const verifyEmailArchiveSession = () => actor;
    export const hasAdminAccess = (a) => Boolean(a && a.role === "admin");
    export const __setActor = (a) => { actor = a; };
  `,

  "lib/objectStorage": `
    import { Buffer } from "node:buffer";
    export const calls = { download: 0, save: 0, meta: 0 };
    const store = new Map([["app/tenant-a/hr/file.pdf", Buffer.from("replit-bytes")]]);
    export const downloadPrivateObject = async (name) => {
      calls.download += 1;
      const b = store.get(name);
      if (!b) throw new Error("No such object");
      return b;
    };
    export const getPrivateObjectMetadata = async () => {
      calls.meta += 1;
      return { metadata: { originalName: "تقرير.pdf" } };
    };
    export const isTenantPrivateObject = (name, tenantId) => name.startsWith("app/" + tenantId + "/");
    export const saveTenantPrivateObject = async (input) => {
      calls.save += 1;
      return { objectName: "app/" + input.tenantId + "/uploads/new.bin", url: "/api/sa/files/x" };
    };
    export const storageObjectUrl = (n) => "/api/sa/files/" + Buffer.from(n, "utf8").toString("base64url");
    export const privateObjectLocation = () => ({ bucketName: "b", objectName: "app" });
    export const decodeStorageObjectRef = (v) => Buffer.from(v, "base64url").toString("utf8");
    export const deletePrivateObject = async () => {};
    export const archiveState = { value: { emails: [] } };
    export const objectStorageClient = {
      bucket: () => ({
        file: () => ({
          exists: async () => [true],
          download: async () => [Buffer.from(JSON.stringify(archiveState.value), "utf8")],
          save: async () => {},
        }),
      }),
    };
  `,

  "lib/tenantDrive": `
    export const calls = { oauthRead: 0, decrypt: 0, save: 0 };
    export class GoogleDriveAccessDeniedError extends Error {}
    export const parseTenantDriveObjectPath = (v) =>
      typeof v === "string" && v.startsWith("drive://") ? v.slice(8) : null;
    // Stands in for the REAL downloadTenantFile, whose first act is to
    // decrypt a refresh token. If a legacy tenant ever reaches here, this
    // counter proves it.
    export const downloadTenantFile = async (tenantId, fileId) => {
      calls.oauthRead += 1;
      calls.decrypt += 1;
      if (fileId === "oauthFILE000001") {
        return { bytes: Buffer.from("oauth-bytes"), filename: "عقد.pdf", contentType: "application/pdf" };
      }
      if (fileId === "otherTENANT001") throw new Error("Google Drive file belongs to a different organization");
      throw new Error("Google Drive download failed (404)");
    };
    export const deleteTenantFile = async () => {};
    export const saveTenantFile = async (i) => { calls.save += 1; return { objectName: "drive://newFILE00001" }; };
    export const getTenantDriveMetadata = async () => ({});
    export const findTenantFileByAppProperty = async () => null;
    export const getTenantDriveStatus = async () => ({ connected: true, connectedEmail: "x@y.z" });
    export const finishDriveOAuth = async () => ({});
    export const getDriveOAuthAuthorizationUrl = () => "https://accounts.google.com/o/oauth2/v2/auth?x=1";
    export const getDriveOAuthRedirectUri = () => "https://archiva.cloud/api/sa/tenants/storage/oauth/callback";
  `,

  "lib/legacyDriveAccess": `
    export const calls = { legacyRead: 0 };
    let provider = "legacy-service-account";
    export const __setProvider = (p) => { provider = p; };
    export const tenantUsesLegacyDriveConnection = async () => provider === "legacy-service-account";
    export const legacyDriveDepsFor = (tenantId) => ({
      lookupReference: async (fileId) =>
        fileId === "legacyFILE00001" && tenantId === "tenant-a" ? { projectId: "p1", recordedSize: 12 } : null,
      getAccessToken: async () => "synthetic-token",
      fetchImpl: async (url) => {
        calls.legacyRead += 1;
        if (String(url).includes("alt=media")) {
          return new Response(Buffer.from("legacy-bytes"), { status: 200, headers: { "content-length": "12" } });
        }
        return new Response(JSON.stringify({
          id: "legacyFILE00001", name: "خطاب.pdf", mimeType: "application/pdf", size: "12", trashed: false,
        }), { status: 200, headers: { "content-type": "application/json" } });
      },
      authorizeProject: async (projectId) => projectId === "p1",
    });
  `,

  "lib/supabaseStorage": `
    export const parseSupabaseObjectPath = () => null;
    export const downloadSupabaseObject = async () => Buffer.from("");
    export const uploadSupabaseObject = async () => "";
    export const deleteSupabaseObject = async () => {};
    export const supabaseObjectPath = () => "";
    export const decodeSupabasePath = () => "";
    export const signedSupabaseUrl = async () => "";
    export const SUPABASE_STORAGE_DISABLED_MESSAGE = "disabled";
  `,

  "sa/archiveDb": `
    export const fixtures = { attachment: null };
    export const listAttachments = async () => fixtures.attachment ? [fixtures.attachment] : [];
    export const listAttachmentsByIds = async () => fixtures.attachment ? [fixtures.attachment] : [];
    export const listAttachmentStorageByIds = async () => fixtures.attachment ? [fixtures.attachment] : [];
    export const createAttachment = async (p, a) => ({ id: "att1", ...a });
    export const deleteAttachment = async () => {};
    export const deleteAttachmentFolder = async () => {};
    export const addAuditLog = async () => {};
    export const __setAttachment = (a) => { fixtures.attachment = a; };
  `,

  "@replit/connectors-sdk": `
    export class ReplitConnectors {
      async getConnectionSettings() { throw new Error("no connector in tests"); }
      async getAccessToken() { throw new Error("no connector in tests"); }
    }
  `,
  "lib/logger": `export const logger = { info(){}, warn(){}, error(){}, debug(){} };`,
};

const used = new Set();

const fakePlugin = {
  name: "archhive-fakes",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (args) => {
      for (const key of Object.keys(FAKES)) {
        const tail = key.split("/").pop();
        if (args.path.endsWith("/" + tail) || args.path === "./" + tail || args.path.endsWith("../" + tail)) {
          used.add(key);
          return { path: key, namespace: "fake" };
        }
      }
      return null;
    });
    b.onLoad({ filter: /.*/, namespace: "fake" }, (args) => ({
      contents: FAKES[args.path],
      loader: "js",
      // A fake may import a REAL sibling (driveFlags, for instance). Without
      // a resolveDir those relative specifiers have no base to resolve from.
      // onResolve still runs first, so a sibling that is itself faked stays
      // faked.
      resolveDir: join(src, "lib"),
    }));
  },
};

await build({
  entryPoints: [join(here, "routes.test.ts")],
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  outfile: join(here, ".routes.test.mjs"),
  plugins: [fakePlugin],
  logLevel: "warning",
});

const missing = Object.keys(FAKES).filter((k) => !used.has(k));
// A fake that was never used means the real module got through, and the test
// would silently be hitting the database or Google.
const REQUIRED = ["lib/tenantDrive", "lib/legacyDriveAccess", "lib/objectStorage", "lib/emailArchiveAuth"];
const escaped = REQUIRED.filter((k) => missing.includes(k));
if (escaped.length > 0) {
  console.error("REFUSED: these real modules were not substituted: " + escaped.join(", "));
  process.exit(1);
}
console.log("harness built; substituted " + used.size + " modules");
