import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import path from "node:path";

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

function safeSegment(value: string, fallback: string) {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}._-]+/gu, "_")
    .replace(/^[_\-.]+|[_\-.]+$/g, "")
    .slice(0, 120);
  return cleaned || fallback;
}

export function storageObjectUrl(objectName: string) {
  return `/api/sa/files/${Buffer.from(objectName, "utf8").toString("base64url")}`;
}

export function decodeStorageObjectRef(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

export async function savePrivateObject(input: {
  namespace: string;
  filename: string;
  bytes: Buffer;
  contentType?: string;
  segments?: string[];
}) {
  const filename = safeSegment(path.basename(input.filename), "file");
  const namespace = safeSegment(input.namespace, "uploads");
  const objectId = `${randomUUID()}-${filename}`;
  const { bucketName, objectName } = privateObjectLocation(
    namespace,
    ...(input.segments ?? []).map((segment) => safeSegment(segment, "item")),
    objectId,
  );
  await objectStorageClient.bucket(bucketName).file(objectName).save(input.bytes, {
    resumable: false,
    metadata: {
      contentType: input.contentType || "application/octet-stream",
      metadata: { originalName: input.filename },
    },
  });
  return {
    objectName,
    url: storageObjectUrl(objectName),
  };
}

export async function deletePrivateObject(objectName: string) {
  const { bucketName } = privateObjectLocation();
  await objectStorageClient.bucket(bucketName).file(objectName).delete({ ignoreNotFound: true });
}