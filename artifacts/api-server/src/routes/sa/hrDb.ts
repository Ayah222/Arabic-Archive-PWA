// Supabase-backed persistence for the HR module: employees, employee
// documents, employee leaves, job candidates, company policies, company
// licenses, and government correspondence. Follows the same row <-> camelCase
// mapping convention as archiveDb.ts.
import { supabaseAdmin } from "../../lib/supabaseAdmin";
import type {
  HREmployee,
  HREmployeeDocument,
  HREmployeeLeave,
  HRCandidate,
  HRPolicy,
  HRLicense,
  HRCorrespondence,
} from "./hrTypes";

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

/* ─────────────── Row <-> object mappers ─────────────── */

function toEmployee(row: Record<string, unknown>): HREmployee {
  return {
    id: row.id as string,
    name: row.name as string,
    nationalId: (row.national_id as string) ?? null,
    position: (row.position as string) ?? null,
    department: (row.department as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    hireDate: (row.hire_date as string) ?? null,
    employmentType: (row.employment_type as HREmployee["employmentType"]) ?? "full_time",
    status: (row.status as HREmployee["status"]) ?? "active",
    probationDays: Number(row.probation_days ?? 90),
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function toEmployeeDocument(row: Record<string, unknown>): HREmployeeDocument {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    category: row.category as HREmployeeDocument["category"],
    name: row.name as string,
    url: row.url as string,
    mimeType: (row.mime_type as string) ?? null,
    size: row.size === null || row.size === undefined ? null : Number(row.size),
    description: (row.description as string) ?? null,
    expiryDate: (row.expiry_date as string) ?? null,
    uploadedAt: row.uploaded_at as string,
  };
}

function toEmployeeLeave(row: Record<string, unknown>): HREmployeeLeave {
  return {
    id: row.id as string,
    employeeId: row.employee_id as string,
    leaveType: (row.leave_type as HREmployeeLeave["leaveType"]) ?? "annual",
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toCandidate(row: Record<string, unknown>): HRCandidate {
  return {
    id: row.id as string,
    name: row.name as string,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    positionApplied: (row.position_applied as string) ?? null,
    cvUrl: (row.cv_url as string) ?? null,
    skills: (row.skills as string[]) ?? [],
    status: (row.status as HRCandidate["status"]) ?? "new",
    offerStatus: (row.offer_status as HRCandidate["offerStatus"]) ?? "none",
    offerSalary: row.offer_salary === null || row.offer_salary === undefined ? null : Number(row.offer_salary),
    offerStartDate: (row.offer_start_date as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toPolicy(row: Record<string, unknown>): HRPolicy {
  return {
    id: row.id as string,
    title: row.title as string,
    category: (row.category as string) ?? null,
    fileUrl: (row.file_url as string) ?? null,
    description: (row.description as string) ?? null,
    effectiveDate: (row.effective_date as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toLicense(row: Record<string, unknown>): HRLicense {
  return {
    id: row.id as string,
    name: row.name as string,
    licenseNumber: (row.license_number as string) ?? null,
    issuingAuthority: (row.issuing_authority as string) ?? null,
    issueDate: (row.issue_date as string) ?? null,
    expiryDate: (row.expiry_date as string) ?? null,
    fileUrl: (row.file_url as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

function toCorrespondence(row: Record<string, unknown>): HRCorrespondence {
  return {
    id: row.id as string,
    subject: row.subject as string,
    direction: row.direction as HRCorrespondence["direction"],
    authority: (row.authority as string) ?? null,
    date: (row.date as string) ?? null,
    reference: (row.reference as string) ?? null,
    fileUrl: (row.file_url as string) ?? null,
    notes: (row.notes as string) ?? null,
    createdAt: row.created_at as string,
  };
}

/* ─────────────── Employees ─────────────── */

export async function listEmployees(): Promise<HREmployee[]> {
  const rows = unwrap(await supabaseAdmin().from("employees").select("*").order("created_at", { ascending: false }));
  return (rows ?? []).map(toEmployee);
}

export async function getEmployee(id: string): Promise<HREmployee | null> {
  const { data, error } = await supabaseAdmin().from("employees").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toEmployee(data) : null;
}

export async function createEmployee(input: {
  name: string; nationalId?: string | null; position?: string | null; department?: string | null;
  phone?: string | null; email?: string | null; hireDate?: string | null;
  employmentType?: string; status?: string; probationDays?: number; notes?: string | null;
}): Promise<HREmployee> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("employees")
      .insert({
        name: input.name,
        national_id: input.nationalId ?? null,
        position: input.position ?? null,
        department: input.department ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        hire_date: input.hireDate ?? null,
        employment_type: input.employmentType ?? "full_time",
        status: input.status ?? "active",
        probation_days: input.probationDays ?? 90,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );
  return toEmployee(row);
}

export async function updateEmployee(
  id: string,
  patch: Partial<{
    name: string; nationalId: string | null; position: string | null; department: string | null;
    phone: string | null; email: string | null; hireDate: string | null;
    employmentType: string; status: string; probationDays: number; notes: string | null;
  }>,
): Promise<HREmployee | null> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.nationalId !== undefined) updates.national_id = patch.nationalId;
  if (patch.position !== undefined) updates.position = patch.position;
  if (patch.department !== undefined) updates.department = patch.department;
  if (patch.phone !== undefined) updates.phone = patch.phone;
  if (patch.email !== undefined) updates.email = patch.email;
  if (patch.hireDate !== undefined) updates.hire_date = patch.hireDate;
  if (patch.employmentType !== undefined) updates.employment_type = patch.employmentType;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.probationDays !== undefined) updates.probation_days = patch.probationDays;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  const { data, error } = await supabaseAdmin().from("employees").update(updates).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toEmployee(data) : null;
}

export async function deleteEmployee(id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin().from("employees").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Employee documents ─────────────── */

export async function listEmployeeDocuments(employeeId: string): Promise<HREmployeeDocument[]> {
  const rows = unwrap(
    await supabaseAdmin().from("employee_documents").select("*").eq("employee_id", employeeId).order("uploaded_at", { ascending: false }),
  );
  return (rows ?? []).map(toEmployeeDocument);
}

export async function listAllEmployeeDocuments(): Promise<HREmployeeDocument[]> {
  const rows = unwrap(await supabaseAdmin().from("employee_documents").select("*"));
  return (rows ?? []).map(toEmployeeDocument);
}

export async function createEmployeeDocument(
  employeeId: string,
  input: { category: string; name: string; url: string; mimeType?: string | null; size?: number | null; description?: string | null; expiryDate?: string | null },
): Promise<HREmployeeDocument> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("employee_documents")
      .insert({
        employee_id: employeeId,
        category: input.category,
        name: input.name,
        url: input.url,
        mime_type: input.mimeType ?? null,
        size: input.size ?? null,
        description: input.description ?? null,
        expiry_date: input.expiryDate ?? null,
      })
      .select()
      .single(),
  );
  return toEmployeeDocument(row);
}

export async function deleteEmployeeDocument(employeeId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("employee_documents")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("employee_id", employeeId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Employee leaves ─────────────── */

export async function listEmployeeLeaves(employeeId: string): Promise<HREmployeeLeave[]> {
  const rows = unwrap(
    await supabaseAdmin().from("employee_leaves").select("*").eq("employee_id", employeeId).order("start_date", { ascending: false }),
  );
  return (rows ?? []).map(toEmployeeLeave);
}

export async function listAllEmployeeLeaves(): Promise<HREmployeeLeave[]> {
  const rows = unwrap(await supabaseAdmin().from("employee_leaves").select("*"));
  return (rows ?? []).map(toEmployeeLeave);
}

export async function createEmployeeLeave(
  employeeId: string,
  input: { leaveType: string; startDate: string; endDate: string; notes?: string | null },
): Promise<HREmployeeLeave> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("employee_leaves")
      .insert({
        employee_id: employeeId,
        leave_type: input.leaveType,
        start_date: input.startDate,
        end_date: input.endDate,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );
  return toEmployeeLeave(row);
}

export async function deleteEmployeeLeave(employeeId: string, id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin()
    .from("employee_leaves")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("employee_id", employeeId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Candidates ─────────────── */

export async function listCandidates(): Promise<HRCandidate[]> {
  const rows = unwrap(await supabaseAdmin().from("job_candidates").select("*").order("created_at", { ascending: false }));
  return (rows ?? []).map(toCandidate);
}

export async function getCandidate(id: string): Promise<HRCandidate | null> {
  const { data, error } = await supabaseAdmin().from("job_candidates").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCandidate(data) : null;
}

export async function createCandidate(input: {
  name: string; phone?: string | null; email?: string | null; positionApplied?: string | null;
  cvUrl?: string | null; skills?: string[]; status?: string; notes?: string | null;
}): Promise<HRCandidate> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("job_candidates")
      .insert({
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        position_applied: input.positionApplied ?? null,
        cv_url: input.cvUrl ?? null,
        skills: input.skills ?? [],
        status: input.status ?? "new",
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );
  return toCandidate(row);
}

export async function updateCandidate(
  id: string,
  patch: Partial<{
    name: string; phone: string | null; email: string | null; positionApplied: string | null;
    cvUrl: string | null; skills: string[]; status: string; offerStatus: string;
    offerSalary: number | null; offerStartDate: string | null; notes: string | null;
  }>,
): Promise<HRCandidate | null> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.phone !== undefined) updates.phone = patch.phone;
  if (patch.email !== undefined) updates.email = patch.email;
  if (patch.positionApplied !== undefined) updates.position_applied = patch.positionApplied;
  if (patch.cvUrl !== undefined) updates.cv_url = patch.cvUrl;
  if (patch.skills !== undefined) updates.skills = patch.skills;
  if (patch.status !== undefined) updates.status = patch.status;
  if (patch.offerStatus !== undefined) updates.offer_status = patch.offerStatus;
  if (patch.offerSalary !== undefined) updates.offer_salary = patch.offerSalary;
  if (patch.offerStartDate !== undefined) updates.offer_start_date = patch.offerStartDate;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  const { data, error } = await supabaseAdmin().from("job_candidates").update(updates).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCandidate(data) : null;
}

export async function deleteCandidate(id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin().from("job_candidates").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Company policies ─────────────── */

export async function listPolicies(): Promise<HRPolicy[]> {
  const rows = unwrap(await supabaseAdmin().from("company_policies").select("*").order("created_at", { ascending: false }));
  return (rows ?? []).map(toPolicy);
}

export async function createPolicy(input: {
  title: string; category?: string | null; fileUrl?: string | null; description?: string | null; effectiveDate?: string | null;
}): Promise<HRPolicy> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("company_policies")
      .insert({
        title: input.title,
        category: input.category ?? null,
        file_url: input.fileUrl ?? null,
        description: input.description ?? null,
        effective_date: input.effectiveDate ?? null,
      })
      .select()
      .single(),
  );
  return toPolicy(row);
}

export async function updatePolicy(
  id: string,
  patch: Partial<{ title: string; category: string | null; fileUrl: string | null; description: string | null; effectiveDate: string | null }>,
): Promise<HRPolicy | null> {
  const updates: Record<string, unknown> = {};
  if (patch.title !== undefined) updates.title = patch.title;
  if (patch.category !== undefined) updates.category = patch.category;
  if (patch.fileUrl !== undefined) updates.file_url = patch.fileUrl;
  if (patch.description !== undefined) updates.description = patch.description;
  if (patch.effectiveDate !== undefined) updates.effective_date = patch.effectiveDate;

  const { data, error } = await supabaseAdmin().from("company_policies").update(updates).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toPolicy(data) : null;
}

export async function deletePolicy(id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin().from("company_policies").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Company licenses ─────────────── */

export async function listLicenses(): Promise<HRLicense[]> {
  const rows = unwrap(await supabaseAdmin().from("company_licenses").select("*").order("created_at", { ascending: false }));
  return (rows ?? []).map(toLicense);
}

export async function listAllLicenses(): Promise<HRLicense[]> {
  return listLicenses();
}

export async function createLicense(input: {
  name: string; licenseNumber?: string | null; issuingAuthority?: string | null;
  issueDate?: string | null; expiryDate?: string | null; fileUrl?: string | null; notes?: string | null;
}): Promise<HRLicense> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("company_licenses")
      .insert({
        name: input.name,
        license_number: input.licenseNumber ?? null,
        issuing_authority: input.issuingAuthority ?? null,
        issue_date: input.issueDate ?? null,
        expiry_date: input.expiryDate ?? null,
        file_url: input.fileUrl ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );
  return toLicense(row);
}

export async function updateLicense(
  id: string,
  patch: Partial<{ name: string; licenseNumber: string | null; issuingAuthority: string | null; issueDate: string | null; expiryDate: string | null; fileUrl: string | null; notes: string | null }>,
): Promise<HRLicense | null> {
  const updates: Record<string, unknown> = {};
  if (patch.name !== undefined) updates.name = patch.name;
  if (patch.licenseNumber !== undefined) updates.license_number = patch.licenseNumber;
  if (patch.issuingAuthority !== undefined) updates.issuing_authority = patch.issuingAuthority;
  if (patch.issueDate !== undefined) updates.issue_date = patch.issueDate;
  if (patch.expiryDate !== undefined) updates.expiry_date = patch.expiryDate;
  if (patch.fileUrl !== undefined) updates.file_url = patch.fileUrl;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  const { data, error } = await supabaseAdmin().from("company_licenses").update(updates).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toLicense(data) : null;
}

export async function deleteLicense(id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin().from("company_licenses").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/* ─────────────── Government correspondence ─────────────── */

export async function listCorrespondence(): Promise<HRCorrespondence[]> {
  const rows = unwrap(await supabaseAdmin().from("gov_correspondence").select("*").order("created_at", { ascending: false }));
  return (rows ?? []).map(toCorrespondence);
}

export async function createCorrespondence(input: {
  subject: string; direction?: string; authority?: string | null; date?: string | null; reference?: string | null; fileUrl?: string | null; notes?: string | null;
}): Promise<HRCorrespondence> {
  const row = unwrap<Record<string, unknown>>(
    await supabaseAdmin()
      .from("gov_correspondence")
      .insert({
        subject: input.subject,
        direction: input.direction ?? "outgoing",
        authority: input.authority ?? null,
        date: input.date ?? null,
        reference: input.reference ?? null,
        file_url: input.fileUrl ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single(),
  );
  return toCorrespondence(row);
}

export async function updateCorrespondence(
  id: string,
  patch: Partial<{ subject: string; direction: string; authority: string | null; date: string | null; reference: string | null; fileUrl: string | null; notes: string | null }>,
): Promise<HRCorrespondence | null> {
  const updates: Record<string, unknown> = {};
  if (patch.subject !== undefined) updates.subject = patch.subject;
  if (patch.direction !== undefined) updates.direction = patch.direction;
  if (patch.authority !== undefined) updates.authority = patch.authority;
  if (patch.date !== undefined) updates.date = patch.date;
  if (patch.reference !== undefined) updates.reference = patch.reference;
  if (patch.fileUrl !== undefined) updates.file_url = patch.fileUrl;
  if (patch.notes !== undefined) updates.notes = patch.notes;

  const { data, error } = await supabaseAdmin().from("gov_correspondence").update(updates).eq("id", id).select().maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toCorrespondence(data) : null;
}

export async function deleteCorrespondence(id: string): Promise<boolean> {
  const { error, count } = await supabaseAdmin().from("gov_correspondence").delete({ count: "exact" }).eq("id", id);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
