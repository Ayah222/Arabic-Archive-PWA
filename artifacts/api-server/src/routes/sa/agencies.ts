import { Router, type IRouter } from "express";
import { parseSupabaseObjectPath, signedSupabaseUrl } from "../../lib/supabaseStorage";
import { supabaseAdmin } from "../../lib/supabaseAdmin";

const router: IRouter = Router();

export interface AgencyRecord {
  id: string;
  projectId: string | null;
  projectName: string | null;
  clientName: string;
  authorizationNumber: string;
  expiresOn: string | null;
  status: "active" | "expired";
  attachmentPath: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  attachmentMimeType: string | null;
  attachmentSize: number;
  createdAt: string;
  updatedAt: string;
}

function agencyStatus(expiresOn: string | null) {
  return expiresOn && new Date(`${expiresOn}T23:59:59.999Z`).getTime() < Date.now()
    ? "expired"
    : "active";
}

async function toAgency(row: Record<string, unknown>): Promise<AgencyRecord> {
  const attachmentPath = (row.attachment_path as string | null) ?? null;
  const supabasePath = parseSupabaseObjectPath(attachmentPath);
  return {
    id: row.id as string,
    projectId: (row.project_id as string | null) ?? null,
    projectName: (row.project_name as string | null) ?? null,
    clientName: (row.client_name as string) ?? "",
    authorizationNumber: (row.authorization_number as string) ?? "",
    expiresOn: (row.expires_on as string | null) ?? null,
    status: agencyStatus((row.expires_on as string | null) ?? null),
    attachmentPath,
    attachmentUrl: supabasePath ? await signedSupabaseUrl(supabasePath) : null,
    attachmentName: (row.attachment_name as string | null) ?? null,
    attachmentMimeType: (row.attachment_mime_type as string | null) ?? null,
    attachmentSize: Number(row.attachment_size ?? 0),
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

async function listAgencyRows(projectId?: string) {
  let query = supabaseAdmin()
    .from("agencies")
    .select("*, projects(name)")
    .order("created_at", { ascending: false });
  if (projectId) query = query.eq("project_id", projectId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    ...(row as Record<string, unknown>),
    project_name: (row as { projects?: { name?: string } | null }).projects?.name ?? null,
  })) as Array<Record<string, unknown>>;
}

router.get("/sa/agencies", async (req, res): Promise<void> => {
  const rows = await listAgencyRows(typeof req.query.projectId === "string" ? req.query.projectId : undefined);
  res.json(await Promise.all(rows.map(toAgency)));
});

router.post("/sa/agencies", async (req, res): Promise<void> => {
  const {
    projectId,
    clientName,
    authorizationNumber,
    expiresOn,
    attachmentPath,
    attachmentName,
    attachmentMimeType,
    attachmentSize,
  } = req.body as Record<string, unknown>;

  if (!String(clientName ?? "").trim() || !String(authorizationNumber ?? "").trim()) {
    res.status(400).json({ error: "clientName and authorizationNumber are required" });
    return;
  }

  const values = {
    project_id: projectId || null,
    client_name: String(clientName).trim(),
    authorization_number: String(authorizationNumber).trim(),
    expires_on: expiresOn || null,
    attachment_path: attachmentPath || null,
    attachment_name: attachmentName || null,
    attachment_mime_type: attachmentMimeType || null,
    attachment_size: Number(attachmentSize || 0),
    updated_at: new Date().toISOString(),
  };

  let result;
  if (projectId) {
    const existing = await supabaseAdmin().from("agencies").select("id").eq("project_id", projectId).maybeSingle();
    if (existing.error) throw new Error(existing.error.message);
    result = existing.data
      ? await supabaseAdmin().from("agencies").update(values).eq("id", existing.data.id).select().single()
      : await supabaseAdmin().from("agencies").insert(values).select().single();
  } else {
    result = await supabaseAdmin().from("agencies").insert(values).select().single();
  }
  if (result.error) throw new Error(result.error.message);
  const rows = await listAgencyRows();
  const resultId = (result.data as { id: string }).id;
  const row = rows.find((item) => item.id === resultId);
  res.status(201).json(await toAgency(row ?? result.data));
});

router.patch("/sa/agencies/:id", async (req, res): Promise<void> => {
  const allowed: Record<string, string | number | null> = {};
  const body = req.body as Record<string, unknown>;
  if (body.clientName !== undefined) allowed.client_name = String(body.clientName).trim();
  if (body.authorizationNumber !== undefined) allowed.authorization_number = String(body.authorizationNumber).trim();
  if (body.expiresOn !== undefined) allowed.expires_on = body.expiresOn ? String(body.expiresOn) : null;
  if (body.attachmentPath !== undefined) allowed.attachment_path = body.attachmentPath ? String(body.attachmentPath) : null;
  if (body.attachmentName !== undefined) allowed.attachment_name = body.attachmentName ? String(body.attachmentName) : null;
  if (body.attachmentMimeType !== undefined) allowed.attachment_mime_type = body.attachmentMimeType ? String(body.attachmentMimeType) : null;
  if (body.attachmentSize !== undefined) allowed.attachment_size = Number(body.attachmentSize || 0);
  allowed.updated_at = new Date().toISOString();
  const result = await supabaseAdmin().from("agencies").update(allowed).eq("id", req.params.id).select().single();
  if (result.error) {
    res.status(400).json({ error: result.error.message });
    return;
  }
  const rows = await listAgencyRows();
  const resultId = (result.data as { id: string }).id;
  res.json(await toAgency(rows.find((item) => item.id === resultId) ?? result.data));
});

export default router;