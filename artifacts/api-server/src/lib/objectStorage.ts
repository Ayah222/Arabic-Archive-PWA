import { Storage } from "@google-cloud/storage";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: { type: "json", subject_token_field_name: "access_token" },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export function privateObjectLocation(...segments: string[]) {
  const configuredDir = process.env.PRIVATE_OBJECT_DIR;
  if (!configuredDir) {
    throw new Error("PRIVATE_OBJECT_DIR is not configured for object storage");
  }

  const parts = configuredDir.replace(/^\/+/, "").split("/").filter(Boolean);
  const [bucketName, ...prefix] = parts;
  if (!bucketName) throw new Error("Invalid PRIVATE_OBJECT_DIR");

  return {
    bucketName,
    objectName: [...prefix, ...segments].filter(Boolean).join("/"),
  };
}