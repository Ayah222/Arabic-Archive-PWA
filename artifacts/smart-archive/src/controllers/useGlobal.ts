import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = "/api/sa";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: getUserRequestHeaders(), credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getUserRequestHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getUserRequestHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "PUT",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getUserRequestHeaders(),
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function del(path: string): Promise<void> {
  const r = await fetch(path, {
    method: "DELETE",
    credentials: "include",
    headers: {
      ...getUserRequestHeaders(),
    },
  });
  if (!r.ok) throw new Error(await r.text());
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    credentials: "include",
    headers: getUserRequestHeaders(),
    body: form,
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

/* ─── Auth helpers (sessionStorage — clears on tab/browser close) ─── */

export interface CurrentUser {
  id: string;
  username: string;
  name: string;
  role: "admin" | "employee" | "data_entry" | "viewer";
  hrAccess?: boolean;
}

export function getCurrentUser(): CurrentUser | null {
  try {
    const raw = sessionStorage.getItem("sa_user");
    if (!raw) return null;
    return JSON.parse(raw) as CurrentUser;
  } catch {
    return null;
  }
}

export function getUserRequestHeaders() {
  const user = getCurrentUser();
  return {
    "x-user-id": encodeURIComponent(user?.id ?? "guest"),
    "x-user-label": encodeURIComponent(user?.name ?? "guest"),
    "x-user-role": user?.role ?? "",
  };
}

export function setCurrentUser(user: CurrentUser | null) {
  if (user) sessionStorage.setItem("sa_user", JSON.stringify(user));
  else sessionStorage.removeItem("sa_user");
}

export function useCurrentUser() {
  return useQuery<CurrentUser | null>({
    queryKey: ["current-user"],
    queryFn: () => getCurrentUser(),
    staleTime: Infinity,
  });
}

/* ─── Existing hooks ─── */

export function useAllContractors(q?: string) {
  const url = `${API}/all/contractors${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return useQuery<Array<{ id: string; projectId: string; projectName: string; name: string; specialty: string; phone: string | null; email: string | null; status: string; notes: string | null; rating: { workQuality: number; scheduleCompliance: number; safetyStandards: number; executionSpeed: number; average: number; updatedAt: string } | null; createdAt: string }>>({
    queryKey: ["all-contractors", q],
    queryFn: () => get(url),
  });
}

export function useAllContracts(q?: string) {
  const url = `${API}/all/contracts${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return useQuery<Array<{ id: string; projectId: string; projectName: string; title: string; party: string; value: number; startDate: string; endDate: string; status: string; notes: string | null }>>({
    queryKey: ["all-contracts", q],
    queryFn: () => get(url),
  });
}

export function useAllMeetings(q?: string) {
  const url = `${API}/all/meetings${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return useQuery<Array<{ id: string; projectId: string; projectName: string; title: string; date: string; location: string | null; attendees: string[]; agenda: string | null; notes: string | null }>>({
    queryKey: ["all-meetings", q],
    queryFn: () => get(url),
  });
}

export function useAllLetters(q?: string) {
  const url = `${API}/all/letters${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return useQuery<Array<{ id: string; projectId: string; projectName: string; subject: string; direction: string; from: string; to: string; date: string; reference: string | null; autoRef: string; distributionStatus: string; recipients: string[]; notes: string | null }>>({
    queryKey: ["all-letters", q],
    queryFn: () => get(url),
  });
}

export function useSearch(q: string, from = "", to = "") {
  return useQuery<{
    projects: Array<{ id: string; name: string; client: string; status: string; progress: number }>;
    contractors: Array<{ id: string; name: string; specialty: string; projectName: string }>;
    contracts: Array<{ id: string; title: string; party: string; projectName: string }>;
    meetings: Array<{ id: string; title: string; date: string; projectName: string }>;
    letters: Array<{ id: string; subject: string; direction: string; reference: string | null; autoRef: string; projectName: string }>;
    documents: Array<{ id: string; projectId: string; name: string; docRef: string; createdAt: string; projectName: string }>;
    attachments: Array<{ id: string; projectId: string; name: string; customType: string; uploadedAt: string; projectName: string; dataUrl: string }>;
  }>({
    queryKey: ["search", q, from, to],
    queryFn: () => get(`${API}/search?${new URLSearchParams({ q, from, to })}`),
    enabled: q.length > 1 || Boolean(from || to),
  });
}

export interface FinanceRecord {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense";
  category: string;
  date: string;
  reminderDate: string | null;
  notes: string | null;
  projectId: string | null;
  createdAt: string;
}

export type FinanceInput = Omit<FinanceRecord, "id" | "createdAt">;

export function useFinance() {
  return useQuery<FinanceRecord[]>({
    queryKey: ["finance"],
    queryFn: () => get(`${API}/finance`),
  });
}

export function useFinanceActions() {
  const qc = useQueryClient();
  const refetch = () => qc.invalidateQueries({ queryKey: ["finance"] });

  const create = useMutation({
    mutationFn: (data: FinanceInput) => post<FinanceRecord>(`${API}/finance`, data),
    onSuccess: refetch,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FinanceInput> }) =>
      put<FinanceRecord>(`${API}/finance/${id}`, data),
    onSuccess: refetch,
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`${API}/finance/${id}`),
    onSuccess: refetch,
  });

  return { create, update, remove };
}

/* ─── Contacts (Prompt 5) ─── */

export interface ContactRecord {
  id: string;
  projectId: string;
  name: string;
  role: "owner" | "consultant" | "contractor" | "technical_office" | "other";
  phone: string | null;
  email: string | null;
  notes: string | null;
  createdAt: string;
}

export type ContactInput = Omit<ContactRecord, "id" | "projectId" | "createdAt">;

export function useContacts(projectId: string) {
  return useQuery<ContactRecord[]>({
    queryKey: ["contacts", projectId],
    queryFn: () => get(`${API}/projects/${projectId}/contacts`),
  });
}

export function useContactActions(projectId: string) {
  const qc = useQueryClient();
  const refetch = () => qc.invalidateQueries({ queryKey: ["contacts", projectId] });

  const create = useMutation({
    mutationFn: (data: ContactInput) => post<ContactRecord>(`${API}/projects/${projectId}/contacts`, data),
    onSuccess: refetch,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ContactInput> }) =>
      patch<ContactRecord>(`${API}/projects/${projectId}/contacts/${id}`, data),
    onSuccess: refetch,
  });

  const remove = useMutation({
    mutationFn: (id: string) => del(`${API}/projects/${projectId}/contacts/${id}`),
    onSuccess: refetch,
  });

  return { create, update, remove };
}

/* ─── Reports (Prompt 3) ─── */

export interface ProjectReport {
  generatedAt: string;
  period: "weekly" | "monthly";
  project: { id: string; name: string; client: string; status: string; progress: number; location: string | null };
  summary: { totalDocuments: number; totalLetters: number; totalContracts: number; totalMeetings: number; totalContacts: number; newDocumentsInPeriod: number; newLettersInPeriod: number };
  documentStatus: { underReview: number; approved: number; rejected: number; approvedWithNotes: number; overdue: number };
  overdueDocuments: Array<{ id: string; name: string; daysPending: number; uploadedAt?: string }>;
  revisionChanges: Array<{ docName: string; fromRev: number; toRev: number; date: string }>;
  pendingLetters: Array<{ id: string; subject: string; to: string; date: string; autoRef: string; distributionStatus: string }>;
  expiringContracts: Array<{ id: string; title: string; party: string; endDate: string; daysLeft: number }>;
}

export function useReports(period: "weekly" | "monthly" = "weekly") {
  return useQuery<ProjectReport[]>({
    queryKey: ["reports", period],
    queryFn: () => get(`${API}/reports?period=${period}`),
  });
}

export function useProjectReport(projectId: string, period: "weekly" | "monthly" = "weekly") {
  return useQuery<ProjectReport>({
    queryKey: ["report", projectId, period],
    queryFn: () => get(`${API}/reports/${projectId}?period=${period}`),
    enabled: !!projectId,
  });
}

/* ─── Audit log (Prompt 7) ─── */

export interface AuditLogEntry {
  id: string;
  userId: string;
  userLabel: string;
  action: "create" | "update" | "delete";
  entity: string;
  entityId: string;
  description: string;
  timestamp: string;
}

export function useAuditLog(entity?: string, limit = 100) {
  const params = new URLSearchParams();
  if (entity) params.set("entity", entity);
  params.set("limit", String(limit));
  return useQuery<AuditLogEntry[]>({
    queryKey: ["audit", entity, limit],
    queryFn: () => get(`${API}/audit?${params.toString()}`),
  });
}

/* ─── Users (Prompt 7 + 8) ─── */

export interface UserRecord {
  id: string;
  username: string;
  name: string;
  role: "admin" | "data_entry" | "viewer";
  createdAt: string;
}

export function useUsers() {
  return useQuery<UserRecord[]>({
    queryKey: ["users"],
    queryFn: () => get(`${API}/users`),
  });
}

export function useAuthActions() {
  const qc = useQueryClient();

  const login = useMutation({
    mutationFn: (data: { username: string; password: string }) =>
      post<CurrentUser>(`${API}/auth/login`, data),
    onSuccess: (user) => {
      setCurrentUser(user);
      qc.invalidateQueries({ queryKey: ["current-user"] });
    },
  });

  const register = useMutation({
    mutationFn: (data: { username: string; password: string; name: string }) =>
      post<CurrentUser>(`${API}/auth/register`, data),
    onSuccess: (user) => {
      setCurrentUser(user);
      qc.invalidateQueries({ queryKey: ["current-user"] });
    },
  });

  const logout = () => {
    setCurrentUser(null);
    qc.invalidateQueries({ queryKey: ["current-user"] });
  };

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      patch<{ id: string; role: string }>(`${API}/users/${id}/role`, { role }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  return { login, register, logout, changeRole };
}

/* ─── Letter distribution status update ─── */
export function useLetterActions(projectId: string) {
  const qc = useQueryClient();

  const updateDistribution = useMutation({
    mutationFn: ({ letterId, distributionStatus }: { letterId: string; distributionStatus: string }) =>
      patch<unknown>(`${API}/projects/${projectId}/letters/${letterId}`, { distributionStatus }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["letters", projectId] });
      qc.invalidateQueries({ queryKey: ["all-letters"] });
    },
  });

  return { updateDistribution };
}

/* ─── Contractor rating ─── */
export function useContractorRating(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cid, scores }: { cid: string; scores: { workQuality: number; scheduleCompliance: number; safetyStandards: number; executionSpeed: number } }) =>
      patch<unknown>(`${API}/projects/${projectId}/contractors/${cid}/rating`, scores),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contractors", projectId] });
      qc.invalidateQueries({ queryKey: ["all-contractors"] });
    },
  });
}

/* ─── Global create hooks (with project selector) ─── */
export function useGlobalCreateContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: { title: string; party: string; value: number; startDate: string; endDate: string; status: string; notes: string | null; fileUrl: string | null } }) =>
      post<unknown>(`${API}/projects/${projectId}/contracts`, data),
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["contracts", projectId] });
      qc.invalidateQueries({ queryKey: ["all-contracts"] });
    },
  });
}

export function useGlobalCreateContractor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: { name: string; specialty: string; phone: string | null; email: string | null; status: string; notes: string | null } }) =>
      post<unknown>(`${API}/projects/${projectId}/contractors`, data),
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["contractors", projectId] });
      qc.invalidateQueries({ queryKey: ["all-contractors"] });
    },
  });
}

export function useGlobalCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: { title: string; date: string; location: string | null; agenda: string | null; notes: string | null; attendees: string[] } }) =>
      post<unknown>(`${API}/projects/${projectId}/meetings`, data),
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["meetings", projectId] });
      qc.invalidateQueries({ queryKey: ["all-meetings"] });
    },
  });
}

export function useGlobalCreateLetter() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, data }: { projectId: string; data: { subject: string; direction: string; from: string; to: string; date: string; reference: string | null; notes: string | null; fileUrl: string | null } }) =>
      post<unknown>(`${API}/projects/${projectId}/letters`, data),
    onSuccess: (_d, { projectId }) => {
      qc.invalidateQueries({ queryKey: ["letters", projectId] });
      qc.invalidateQueries({ queryKey: ["all-letters"] });
    },
  });
}

/* ─── Photos ─── */
export interface SAPhoto {
  id: string; projectId: string; dataUrl: string;
  name: string; description: string; uploadedAt: string;
}

export function useProjectPhotos(projectId: string) {
  return useQuery<SAPhoto[]>({
    queryKey: ["photos", projectId],
    queryFn: () => fetch(`${API}/projects/${projectId}/photos`).then(r => r.json()),
    enabled: !!projectId,
  });
}

export function usePhotoActions(projectId: string) {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (data: { file: File; name: string; description: string }) => {
      const form = new FormData();
      form.append("file", data.file);
      form.append("name", data.name);
      form.append("description", data.description);
      return postForm<SAPhoto>(`${API}/projects/${projectId}/photos`, form);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos", projectId] }),
  });
  const remove = useMutation({
    mutationFn: (photoId: string) =>
      fetch(`${API}/projects/${projectId}/photos/${photoId}`, { method: "DELETE" }).then(r => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos", projectId] }),
  });
  return { add, remove };
}

/* ─── Attachments (flexible docs on any entity) ─── */
export interface SAAttachment {
  id: string;
  projectId: string;
  entityType: "contract" | "meeting" | "letter" | "custom_doc";
  entityId: string;
  dataUrl: string;
  objectPath?: string | null;
  name: string;
  customType: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
}

export function useEntityAttachments(projectId: string, entityType: string, entityId: string) {
  return useQuery<SAAttachment[]>({
    queryKey: ["attachments", projectId, entityType, entityId],
    queryFn: () => get(`${API}/projects/${projectId}/attachments?entityType=${encodeURIComponent(entityType)}&entityId=${encodeURIComponent(entityId)}`),
    enabled: !!projectId && !!entityId,
  });
}

export function useAttachmentActions(projectId: string) {
  const qc = useQueryClient();
  const add = useMutation({
    mutationFn: (data: { entityType: string; entityId: string; file: File; name: string; customType: string }) => {
      const form = new FormData();
      form.append("file", data.file);
      form.append("entityType", data.entityType);
      form.append("entityId", data.entityId);
      form.append("name", data.name);
      form.append("customType", data.customType);
      return postForm<SAAttachment>(`${API}/projects/${projectId}/attachments`, form);
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["attachments", projectId, vars.entityType, vars.entityId] });
    },
  });
  const remove = useMutation({
    mutationFn: ({ aid, entityType, entityId }: { aid: string; entityType: string; entityId: string }) =>
      del(`${API}/projects/${projectId}/attachments/${aid}`).then(() => ({ aid, entityType, entityId })),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["attachments", projectId, vars.entityType, vars.entityId] });
    },
  });
  return { add, remove };
}

/* ─── Categories (named folders per project) ─── */
export interface SACategory {
  id: string;
  projectId: string;
  name: string;
  createdAt: string;
}

export function useCategories(projectId: string) {
  return useQuery<SACategory[]>({
    queryKey: ["categories", projectId],
    queryFn: () => get(`${API}/projects/${projectId}/categories`),
    enabled: !!projectId,
  });
}

export function useCategoryActions(projectId: string) {
  const qc = useQueryClient();
  const create = useMutation({
    mutationFn: (name: string) =>
      post<SACategory>(`${API}/projects/${projectId}/categories`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories", projectId] }),
  });
  const remove = useMutation({
    mutationFn: (cid: string) =>
      del(`${API}/projects/${projectId}/categories/${cid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories", projectId] });
      qc.invalidateQueries({ queryKey: ["attachments", projectId] });
    },
  });
  return { create, remove };
}

/* ─── Update project extra fields (mapsUrl etc.) ─── */
export function useUpdateProjectExtra(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { mapsUrl?: string | null }) =>
      patch<unknown>(`${API}/projects/${projectId}/extra`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project", projectId] });
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

/* ─── Document approval + revision ─── */
export function useDocumentActions(projectId: string) {
  const qc = useQueryClient();

  const updateApproval = useMutation({
    mutationFn: ({ docId, approvalStatus, revNumber }: { docId: string; approvalStatus: string; revNumber?: number }) =>
      patch<unknown>(`${API}/projects/${projectId}/documents/${docId}/approval`, { approvalStatus, revNumber }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", projectId] }),
  });

  const addRevision = useMutation({
    mutationFn: ({ docId, url, notes }: { docId: string; url: string; notes?: string }) =>
      post<unknown>(`${API}/projects/${projectId}/documents/${docId}/revisions`, { url, notes }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["documents", projectId] }),
  });

  return { updateApproval, addRevision };
}

/* ─── Gmail email archive ─── */
export interface ArchivedEmailAttachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface ArchivedEmail {
  id: string;
  gmailMessageId: string;
  gmailThreadId: string;
  subject: string;
  from: string;
  to: string;
  cc: string;
  bcc: string;
  replyTo: string;
  direction: "incoming" | "outgoing";
  sentAt: string;
  receivedAt: string;
  snippet: string;
  preview?: string;
  bodyText?: string;
  bodyHtml?: string | null;
  labels: string[];
  attachments: ArchivedEmailAttachment[];
  sizeBytes: number;
  archivedAt: string;
}

export interface EmailArchiveFilters {
  q?: string;
  direction?: "" | "incoming" | "outgoing";
  from?: string;
  to?: string;
  start?: string;
  end?: string;
}

export interface EmailArchiveDashboard {
  gmailAddress: string | null;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastHistoryId: string | null;
  nextPageToken: string | null;
  lastError: string | null;
  syncing: boolean;
  messageCount: number;
  incomingCount: number;
  outgoingCount: number;
  attachmentCount: number;
  storageBytes: number;
}

export function useEmailArchive(filters: EmailArchiveFilters) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return useQuery<ArchivedEmail[]>({
    queryKey: ["email-archive", query],
    queryFn: () => get(`${API}/email-archive${query ? `?${query}` : ""}`),
  });
}

export function useArchivedEmail(id: string | null) {
  return useQuery<ArchivedEmail>({
    queryKey: ["email-archive-message", id],
    queryFn: () => get(`${API}/email-archive/${id}`),
    enabled: Boolean(id),
  });
}

export function useEmailArchiveDashboard() {
  return useQuery<EmailArchiveDashboard>({
    queryKey: ["email-archive-dashboard"],
    queryFn: () => get(`${API}/email-archive/dashboard`),
    refetchInterval: 30_000,
  });
}

export function useEmailArchiveActions() {
  const qc = useQueryClient();
  const sync = useMutation({
    mutationFn: () => post<{ added: number; skipped: number; attachments: number; hasMore: boolean; syncedAt: string }>(`${API}/email-archive/sync`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["email-archive"] });
      qc.invalidateQueries({ queryKey: ["email-archive-dashboard"] });
    },
  });
  return { sync };
}

export function emailAttachmentDownloadUrl(emailId: string, attachmentId: string) {
  return `${API}/email-archive/${emailId}/attachments/${attachmentId}/download`;
}

export async function downloadArchivedEmailAttachment(emailId: string, attachmentId: string, filename: string) {
  const response = await fetch(emailAttachmentDownloadUrl(emailId, attachmentId), {
    headers: getUserRequestHeaders(),
  });
  if (!response.ok) throw new Error(await response.text());
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
