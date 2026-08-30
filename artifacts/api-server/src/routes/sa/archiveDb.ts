// Supabase-backed persistence for the archive domain: projects, contracts,
// contractors, documents, meetings, letters, finance, contacts, categories,
// attachments, and audit logs. Replaces the old in-memory `store` arrays for
// these entities so data survives server restarts. Row <-> camelCase mapping
// keeps the existing REST API contract (and SA* types in store.ts) unchanged.
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type {
  SAProject,
  SAContract,
  SAProjectContractor,
  SAContractorRating,
  SADocument,
  SADocumentRevision,
  SAMeeting,
  SALetter,
  SAFinanceRecord,
  SAContact,
  SACategory,
  SAAttachment,
  SAAuditLog,
} from "./store";
import { deletePrivateObject, storageObjectUrl } from "../../lib/objectStorage";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/* ─────────────── Row <-> object mappers ─────────────── */

function toProject(row: Record<string, unknown>): SAProject {
  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? "",
    client: row.client as string,
    status: row.status as SAProject["status"],
    progress: Number(row.progress),
    startDate: row.start_date as string,
    endDate: (row.end_date as string) ?? null,
    budget: row.budget === null || row.budget === undefined ? null : Number(row.budget),
    location: (row.location as string) ?? null,
    coverImage: (row.cover_image as string) ?? null,
    mapsUrl: (row.maps_url as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toContract(row: Record<string, unknown>): SAContract {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    party: row.party as string,
    value: Number(row.value),
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    status: row.status as SAContract["status"],
    notes: (row.notes as string) ?? null,
    fileUrl: (row.file_url as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toContractor(row: Record<string, unknown>): SAProjectContractor {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    specialty: row.specialty as string,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    status: row.status as SAProjectContractor["status"],
    notes: (row.notes as string) ?? null,
    rating: (row.rating as SAContractorRating) ?? null,
    createdAt: row.created_at as string,
  };
}

function toDocument(row: Record<string, unknown>): SADocument {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    docRef: row.doc_ref as string,
    type: row.type as SADocument["type"],
    url: row.url as string,
    size: row.size === null || row.size === undefined ? null : Number(row.size),
    notes: (row.notes as string) ?? null,
    revisions: (row.revisions as SADocumentRevision[]) ?? [],
    currentRevision: Number(row.current_revision),
    approvalStatus: row.approval_status as SADocument["approvalStatus"],
    createdAt: row.created_at as string,
  };
}

function toMeeting(row: Record<string, unknown>): SAMeeting {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    date: row.date as string,
    location: (row.location as string) ?? null,
    attendees: (row.attendees as string[]) ?? [],
    agenda: (row.agenda as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toLetter(row: Record<string, unknown>): SALetter {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    subject: row.subject as string,
    direction: row.direction as SALetter["direction"],
    from: row.from_party as string,
    to: row.to_party as string,
    date: row.date as string,
    reference: (row.reference as string) ?? null,
    autoRef: row.auto_ref as string,
    recipients: (row.recipients as SALetter["recipients"]) ?? [],
    distributionStatus: row.distribution_status as SALetter["distributionStatus"],
    notes: (row.notes as string) ?? null,
    fileUrl: (row.file_url as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toFinance(row: Record<string, unknown>): SAFinanceRecord {
  return {
    id: row.id as string,
    title: row.title as string,
    amount: Number(row.amount),
    type: row.type as SAFinanceRecord["type"],
    category: row.category as string,
    date: row.date as string,
    reminderDate: (row.reminder_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    projectId: (row.project_id as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toContact(row: Record<string, unknown>): SAContact {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    role: row.role as SAContact["role"],
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toCategory(row: Record<string, unknown>): SACategory {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    name: row.name as string,
    createdAt: row.created_at as string,
  };
}

function toAttachment(row: Record<string, unknown>): SAAttachment {
  const objectPath = (row.object_path as string) ?? null;
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    entityType: row.entity_type as SAAttachment["entityType"],
    entityId: row.entity_id as string,
    dataUrl: objectPath ? storageObjectUrl(objectPath) : row.data_url as string,
    objectPath,
    name: row.name as string,
    customType: row.custom_type as string,
    mimeType: row.mime_type as string,
    size: Number(row.size),
    uploadedAt: row.uploaded_at as string,
  };
}

function toAuditLog(row: Record<string, unknown>): SAAuditLog {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    userLabel: row.user_label as string,
    action: row.action as SAAuditLog["action"],
    entity: row.entity as string,
    entityId: row.entity_id as string,
    description: row.description as string,
    timestamp: row.timestamp as string,
  };
}

/* ─────────────── Projects ─────────────── */

export async function listProjects(): Promise<SAProject[]> {
  const rows = unwrap(await supabaseAdmin().from("projects").select("*").order("created_at"));
  return (rows ?? []).map(toProject);
}

export async function getProject(id: string): Promise<SAProject | null> {
  const { data, error } = await supabaseAdmin().from("projects").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProject(data) : null;
}

export async function createProject(input: {
  name: string; description?: string; client?: string; status?: string; progress?: number;
  startDate?: string; endDate?: string | null; budget?: number | null; location?: string | null;
  coverImage?: string | null;
}): Promise<SAProject> {
  // Only the name is required from the caller; every other field has a sensible
  // default so a project can be created with just a title.
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("projects")
      .insert({
        name: input.name,
        description: input.description ?? "",
        client: input.client ?? "",
        status: input.status ?? "active",
        progress: input.progress ?? 0,
        start_date: input.startDate || new Date().toISOString().slice(0, 10),
        end_date: input.endDate ?? null,
        budget: input.budget ?? null,
        location: input.location ?? null,
        cover_image: input.coverImage ?? null,
      })
      .select()
      .single(),
  );
  return toProject(row);
}

export async function updateProject(
  id: string,
  patch: Partial<{
    name: string; description: string; client: string; status: string; progress: number;
    startDate: string; endDate: string | null; budget: number | null; location: string | null;
    coverImage: string | null; mapsUrl: string | null;
  }>,
): Promise<SAProject | null> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.client !== undefined) updates.client = patch.client;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.progress !== undefined) updates.progress = patch.progress;
  if (patch.startDate !== undefined) updates.start_date = patch.startDate;
  if (patch.endDate !== undefined) updates.end_date = patch.endDate;
  if (patch.budget !== undefined) updates.budget = patch.budget;
  if (patch.location !== undefined) updates.location = patch.location;
  if (patch.coverImage !== undefined) updates.cover_image = patch.coverImage;
  if (patch.mapsUrl !== undefined) updates.maps_url = patch.mapsUrl;

  const { data, error } = await supabaseAdmin().from("projects").update(updates).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toProject(data) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
  // Related tables have ON DELETE CASCADE (contracts, contractors, documents,
  // meetings, letters, contacts, categories, attachments) or SET NULL
  // (finance_records) on project_id, so a single delete is sufficient.
  const { error, count } = await supabaseAdmin().from("projects").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Contracts ─────────────── */

export async function listContracts(projectId: string): Promise<SAContract[]> {
  const rows = unwrap(
    await supabaseAdmin().from("contracts").select("*").eq("project_id", projectId).order("created_at"),
  );
  return (rows ?? []).map(toContract);
}

export async function listAllContracts(): Promise<SAContract[]> {
  const rows = unwrap(await supabaseAdmin().from("contracts").select("*").order("created_at"));
  return (rows ?? []).map(toContract);
}

export async function createContract(
  projectId: string,
  input: { title: string; party: string; value: number; startDate: string; endDate: string; status: string; notes?: string | null; fileUrl?: string | null },
): Promise<SAContract> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("contracts")
      .insert({
        project_id: projectId,
        title: input.title,
        party: input.party,
        value: input.value,
        start_date: input.startDate,
        end_date: input.endDate,
        status: input.status,
        notes: input.notes ?? null,
        file_url: input.fileUrl ?? null,
      })
      .select()
      .single(),
  );
  return toContract(row);
}

export async function updateContract(
  projectId: string,
  id: string,
  patch: Partial<{ title: string; party: string; value: number; startDate: string; endDate: string; status: string; notes: string | null; fileUrl: string | null }>,
): Promise<SAContract | null> {
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.party !== undefined) updates.party = patch.party;
  if (patch.value !== undefined) updates.value = patch.value;
  if (patch.startDate !== undefined) updates.start_date = patch.startDate;
  if (patch.endDate !== undefined) updates.end_date = patch.endDate;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.fileUrl !== undefined) updates.file_url = patch.fileUrl;

  const { data, error } = await supabaseAdmin()
    .from("contracts")
    .update(updates)
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toContract(data) : null;
}

export async function deleteContract(projectId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("contracts")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Contractors ─────────────── */

export async function listContractors(projectId: string): Promise<SAProjectContractor[]> {
  const rows = unwrap(
    await supabaseAdmin().from("contractors").select("*").eq("project_id", projectId).order("created_at"),
  );
  return (rows ?? []).map(toContractor);
}

export async function listAllContractors(): Promise<SAProjectContractor[]> {
  const rows = unwrap(await supabaseAdmin().from("contractors").select("*").order("created_at"));
  return (rows ?? []).map(toContractor);
}

export async function createContractor(
  projectId: string,
  input: { name: string; specialty: string; phone?: string | null; email?: string | null; status: string; notes?: string | null },
): Promise<SAProjectContractor> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("contractors")
      .insert({
        project_id: projectId,
        name: input.name,
        specialty: input.specialty,
        phone: input.phone ?? null,
        email: input.email ?? null,
        status: input.status,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );
  return toContractor(row);
}

export async function updateContractor(
  projectId: string,
  id: string,
  patch: Partial<{ name: string; specialty: string; phone: string | null; email: string | null; status: string; notes: string | null }>,
): Promise<SAProjectContractor | null> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.specialty !== undefined) updates.specialty = patch.specialty;
  if (patch.phone !== undefined) updates.phone = patch.phone;
  if (patch.email !== undefined) updates.email = patch.email;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  const { data, error } = await supabaseAdmin()
    .from("contractors")
    .update(updates)
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toContractor(data) : null;
}

export async function updateContractorRating(
  projectId: string,
  id: string,
  rating: SAContractorRating,
): Promise<SAProjectContractor | null> {
  const { data, error } = await supabaseAdmin()
    .from("contractors")
    .update({ rating })
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toContractor(data) : null;
}

export async function deleteContractor(projectId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("contractors")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Documents ─────────────── */

export async function listDocuments(projectId: string): Promise<SADocument[]> {
  const rows = unwrap(
    await supabaseAdmin().from("documents").select("*").eq("project_id", projectId).order("created_at"),
  );
  return (rows ?? []).map(toDocument);
}

export async function listAllDocuments(): Promise<SADocument[]> {
  const rows = unwrap(await supabaseAdmin().from("documents").select("*").order("created_at"));
  return (rows ?? []).map(toDocument);
}

export async function getDocument(projectId: string, id: string): Promise<SADocument | null> {
  const { data, error } = await supabaseAdmin()
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toDocument(data) : null;
}

export async function createDocument(
  projectId: string,
  input: { name: string; docRef: string; type: string; url: string; size?: number | null; notes?: string | null; revisions: SADocumentRevision[] },
): Promise<SADocument> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("documents")
      .insert({
        project_id: projectId,
        name: input.name,
        doc_ref: input.docRef,
        type: input.type,
        url: input.url,
        size: input.size ?? null,
        notes: input.notes ?? null,
        revisions: input.revisions,
        current_revision: 0,
        approval_status: "under_review",
      })
      .select()
      .single(),
  );
  return toDocument(row);
}

export async function saveDocumentRevisions(
  projectId: string,
  id: string,
  patch: { revisions: SADocumentRevision[]; currentRevision: number; url: string; approvalStatus: string },
): Promise<SADocument | null> {
  const { data, error } = await supabaseAdmin()
    .from("documents")
    .update({
      revisions: patch.revisions,
      current_revision: patch.currentRevision,
      url: patch.url,
      approval_status: patch.approvalStatus,
    })
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toDocument(data) : null;
}

export async function deleteDocument(projectId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("documents")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function nextDocRef(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DOC-${year}-`;
  const { data, error } = await supabaseAdmin().from("documents").select("doc_ref").ilike("doc_ref", `${prefix}%`);
  if (error) throw new Error(error.message);
  const max = (data ?? []).reduce((m: number, r: { doc_ref: string }) => {
    const match = /(\d+)$/.exec(r.doc_ref ?? "");
    return Math.max(m, match ? parseInt(match[1], 10) : 0);
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/* ─────────────── Meetings ─────────────── */

export async function listMeetings(projectId: string): Promise<SAMeeting[]> {
  const rows = unwrap(
    await supabaseAdmin().from("meetings").select("*").eq("project_id", projectId).order("date", { ascending: false }),
  );
  return (rows ?? []).map(toMeeting);
}

export async function listAllMeetings(): Promise<SAMeeting[]> {
  const rows = unwrap(await supabaseAdmin().from("meetings").select("*"));
  return (rows ?? []).map(toMeeting);
}

export async function createMeeting(
  projectId: string,
  input: { title: string; date: string; location?: string | null; attendees: string[]; agenda?: string | null; notes?: string | null },
): Promise<SAMeeting> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("meetings")
      .insert({
        project_id: projectId,
        title: input.title,
        date: input.date,
        location: input.location ?? null,
        attendees: input.attendees,
        agenda: input.agenda ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );
  return toMeeting(row);
}

export async function updateMeeting(
  projectId: string,
  id: string,
  patch: Partial<{ title: string; date: string; location: string | null; attendees: string[]; agenda: string | null; notes: string | null }>,
): Promise<SAMeeting | null> {
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.date !== undefined) updates.date = patch.date;
  if (patch.location !== undefined) updates.location = patch.location;
  if (patch.attendees !== undefined) updates.attendees = patch.attendees;
  if (patch.agenda !== undefined) updates.agenda = patch.agenda;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  const { data, error } = await supabaseAdmin()
    .from("meetings")
    .update(updates)
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toMeeting(data) : null;
}

export async function deleteMeeting(projectId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("meetings")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Letters ─────────────── */

export async function listLetters(projectId: string): Promise<SALetter[]> {
  const rows = unwrap(
    await supabaseAdmin().from("letters").select("*").eq("project_id", projectId).order("date", { ascending: false }),
  );
  return (rows ?? []).map(toLetter);
}

export async function listAllLetters(): Promise<SALetter[]> {
  const rows = unwrap(await supabaseAdmin().from("letters").select("*"));
  return (rows ?? []).map(toLetter);
}

export async function createLetter(
  projectId: string,
  input: {
    subject: string; direction: string; from: string; to: string; date: string;
    reference?: string | null; autoRef: string; recipients: string[]; distributionStatus: string;
    notes?: string | null; fileUrl?: string | null;
  },
): Promise<SALetter> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("letters")
      .insert({
        project_id: projectId,
        subject: input.subject,
        direction: input.direction,
        from_party: input.from,
        to_party: input.to,
        date: input.date,
        reference: input.reference ?? null,
        auto_ref: input.autoRef,
        recipients: input.recipients,
        distribution_status: input.distributionStatus,
        notes: input.notes ?? null,
        file_url: input.fileUrl ?? null,
      })
      .select()
      .single(),
  );
  return toLetter(row);
}

export async function updateLetter(
  projectId: string,
  id: string,
  patch: Partial<{ distributionStatus: string; recipients: string[] }>,
): Promise<SALetter | null> {
  const updates: Record<string, unknown> = {};
  if (patch.distributionStatus !== undefined) updates.distribution_status = patch.distributionStatus;
  if (patch.recipients !== undefined) updates.recipients = patch.recipients;

  const { data, error } = await supabaseAdmin()
    .from("letters")
    .update(updates)
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toLetter(data) : null;
}

export async function deleteLetter(projectId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("letters")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

export async function nextLetterRef(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `LTR-${year}-`;
  const { data, error } = await supabaseAdmin().from("letters").select("auto_ref").ilike("auto_ref", `${prefix}%`);
  if (error) throw new Error(error.message);
  const max = (data ?? []).reduce((m: number, r: { auto_ref: string }) => {
    const match = /(\d+)$/.exec(r.auto_ref ?? "");
    return Math.max(m, match ? parseInt(match[1], 10) : 0);
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

/* ─────────────── Finance ─────────────── */

export async function listFinance(): Promise<SAFinanceRecord[]> {
  const rows = unwrap(await supabaseAdmin().from("finance_records").select("*").order("created_at", { ascending: false }));
  return (rows ?? []).map(toFinance);
}

export async function createFinanceRecord(input: {
  title: string; amount: number; type: string; category: string; date: string;
  reminderDate?: string | null; notes?: string | null; projectId?: string | null;
}): Promise<SAFinanceRecord> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("finance_records")
      .insert({
        title: input.title,
        amount: input.amount,
        type: input.type,
        category: input.category,
        date: input.date,
        reminder_date: input.reminderDate ?? null,
        notes: input.notes ?? null,
        project_id: input.projectId ?? null,
      })
      .select()
      .single(),
  );
  return toFinance(row);
}

export async function updateFinanceRecord(
  id: string,
  patch: Partial<{ title: string; amount: number; type: string; category: string; date: string; reminderDate: string | null; notes: string | null; projectId: string | null }>,
): Promise<SAFinanceRecord | null> {
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.amount !== undefined) updates.amount = patch.amount;
  if (patch.type !== undefined) updates.type = patch.type;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.date !== undefined) updates.date = patch.date;
  if (patch.reminderDate !== undefined) updates.reminder_date = patch.reminderDate;
  if (patch.notes !== undefined) updates.notes = patch.notes;
  if (patch.projectId !== undefined) updates.project_id = patch.projectId;

  const { data, error } = await supabaseAdmin().from("finance_records").update(updates).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toFinance(data) : null;
}

export async function deleteFinanceRecord(id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin().from("finance_records").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Contacts ─────────────── */

export async function listContacts(projectId: string): Promise<SAContact[]> {
  const rows = unwrap(await supabaseAdmin().from("contacts").select("*").eq("project_id", projectId).order("created_at"));
  return (rows ?? []).map(toContact);
}

export async function createContact(
  projectId: string,
  input: { name: string; role: string; phone?: string | null; email?: string | null; notes?: string | null },
): Promise<SAContact> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("contacts")
      .insert({
        project_id: projectId,
        name: input.name,
        role: input.role,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );
  return toContact(row);
}

export async function updateContact(
  projectId: string,
  id: string,
  patch: Partial<{ name: string; role: string; phone: string | null; email: string | null; notes: string | null }>,
): Promise<SAContact | null> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.role !== undefined) updates.role = patch.role;
  if (patch.phone !== undefined) updates.phone = patch.phone;
  if (patch.email !== undefined) updates.email = patch.email;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  const { data, error } = await supabaseAdmin()
    .from("contacts")
    .update(updates)
    .eq("id", id)
    .eq("project_id", projectId)
    .select()
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toContact(data) : null;
}

export async function deleteContact(projectId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("contacts")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Categories ─────────────── */

export async function listCategories(projectId: string): Promise<SACategory[]> {
  const rows = unwrap(await supabaseAdmin().from("categories").select("*").eq("project_id", projectId).order("created_at"));
  return (rows ?? []).map(toCategory);
}

export async function createCategory(projectId: string, name: string): Promise<SACategory> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin().from("categories").insert({ project_id: projectId, name }).select().single(),
  );
  return toCategory(row);
}

export async function deleteCategory(projectId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("categories")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Attachments ─────────────── */

export async function listAttachments(
  projectId: string,
  filters: { entityType?: string; entityId?: string } = {},
): Promise<SAAttachment[]> {
  let query = supabaseAdmin().from("attachments").select("*").eq("project_id", projectId);
  if (filters.entityType) query = query.eq("entity_type", filters.entityType);
  if (filters.entityId) query = query.eq("entity_id", filters.entityId);
  const rows = unwrap(await query.order("uploaded_at", { ascending: false }));
  return (rows ?? []).map(toAttachment);
}

export async function createAttachment(
  projectId: string,
  input: { entityType: string; entityId?: string; objectPath: string; name: string; customType?: string; mimeType?: string; size?: number },
): Promise<SAAttachment> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("attachments")
      .insert({
        project_id: projectId,
        entity_type: input.entityType,
        entity_id: input.entityId ?? projectId,
        object_path: input.objectPath,
        data_url: null,
        name: input.name,
        custom_type: input.customType ?? "مستند",
        mime_type: input.mimeType ?? "application/octet-stream",
        size: input.size ?? 0,
      })
      .select()
      .single(),
  );
  return toAttachment(row);
}

export async function deleteAttachmentsByCategory(projectId: string, categoryId: string): Promise<number> {
  const existing = unwrap(
    await supabaseAdmin()
      .from("attachments")
      .select("object_path")
      .eq("project_id", projectId)
      .eq("entity_type", "custom_doc")
      .eq("entity_id", categoryId),
  ) as Array<{ object_path?: string | null }>;
  const { error, count } = await supabaseAdmin()
    .from("attachments")
    .delete({ count: "exact" })
    .eq("project_id", projectId)
    .eq("entity_type", "custom_doc")
    .eq("entity_id", categoryId);
  if (error) throw new Error(error.message);
  await Promise.all(existing.flatMap((item) => item.object_path ? [deletePrivateObject(item.object_path)] : []));
  return count ?? 0;
}

export async function deleteAttachment(projectId: string, id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("attachments")
    .delete()
    .eq("id", id)
    .eq("project_id", projectId)
    .select("object_path")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return false;
  if (data.object_path) await deletePrivateObject(data.object_path);
  return true;
}

/* ─────────────── Search helpers (unfiltered lists for global/reports/voice) ── */

export async function allAttachments(): Promise<SAAttachment[]> {
  const rows = unwrap(await supabaseAdmin().from("attachments").select("*"));
  return (rows ?? []).map(toAttachment);
}

export async function allCategories(): Promise<SACategory[]> {
  const rows = unwrap(await supabaseAdmin().from("categories").select("*"));
  return (rows ?? []).map(toCategory);
}

export async function allContacts(): Promise<SAContact[]> {
  const rows = unwrap(await supabaseAdmin().from("contacts").select("*"));
  return (rows ?? []).map(toContact);
}

/* ─────────────── Audit log ─────────────── */

export async function addAuditLog(
  userId: string,
  userLabel: string,
  action: "create" | "update" | "delete",
  entity: string,
  entityId: string,
  description: string,
): Promise<void> {
  const { error } = await supabaseAdmin().from("audit_logs").insert({
    user_id: userId,
    user_label: userLabel,
    action,
    entity,
    entity_id: entityId,
    description,
  });
  if (error) console.error("Failed to write audit log:", error.message);
}

export async function listAuditLogs(filters: { entity?: string; userId?: string; limit: number }): Promise<SAAuditLog[]> {
  let query = supabaseAdmin().from("audit_logs").select("*").order("timestamp", { ascending: false });
  if (filters.entity) query = query.eq("entity", filters.entity);
  if (filters.userId) query = query.eq("user_id", filters.userId);
  const rows = unwrap(await query.limit(filters.limit));
  return (rows ?? []).map(toAuditLog);
}
