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

function isPublicOrigin(value: string): boolean {
  if (!value) return false;
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname !== "localhost"
      && !hostname.endsWith(".localhost")
      && hostname !== "::1"
      && hostname !== "[::1]"
      && !hostname.startsWith("127.")
      && hostname !== "0.0.0.0";
  } catch {
    return false;
  }
}

export function getAppOrigin(req: Pick<Request, "headers" | "protocol">): string {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";
  const forwardedHost = firstHeader(req.headers["x-forwarded-host"]);
  const forwardedProto = firstHeader(req.headers["x-forwarded-proto"]);

  const requestOrigin = validOrigin(origin);
  // Browser Origin identifies the public app host. Proxy headers can contain an
  // internal localhost host in some deployment paths, so prefer Origin and
  // never issue auth links that send users to a loopback address.
  if (isPublicOrigin(requestOrigin)) return requestOrigin;

  if (forwardedHost) {
    const forwardedOrigin = validOrigin(`${forwardedProto || "https"}://${forwardedHost}`);
    if (isPublicOrigin(forwardedOrigin)) return forwardedOrigin;
  }

  const host = firstHeader(req.headers.host);
  const protocol = forwardedProto || req.protocol || "https";
  const hostOrigin = host ? validOrigin(`${protocol}://${host}`) : "";
  return isPublicOrigin(hostOrigin) ? hostOrigin : "";
}
