import type { Request } from "express";

function firstHeader(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim() ?? "";
}

function validOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export function getAppOrigin(req: Pick<Request, "headers" | "protocol">): string {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const forwardedHost = firstHeader(req.headers["x-forwarded-host"]);
  const forwardedProto = firstHeader(req.headers["x-forwarded-proto"]);

  // Prefer Replit's public reverse-proxy host over Origin, which can be local.
  if (forwardedHost) {
    const originProtocol = origin ? validOrigin(origin).split(":")[0] : "";
    const protocol = forwardedProto || originProtocol || "https";
    const forwardedOrigin = validOrigin(`${protocol}://${forwardedHost}`);
    if (forwardedOrigin) return forwardedOrigin;
  }

  const requestOrigin = validOrigin(origin);
  if (requestOrigin) return requestOrigin;

  const host = firstHeader(req.headers.host);
  const protocol = forwardedProto || req.protocol || "https";
  return host ? validOrigin(`${protocol}://${host}`) : "";
}
