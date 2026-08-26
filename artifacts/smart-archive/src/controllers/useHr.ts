// Hand-written React Query hooks for the HR module, matching the plain-fetch
// convention already used across the app's non-core-entity features
// (useGlobal.ts). Not generated from the OpenAPI contract.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getUserRequestHeaders } from "./useGlobal";

const API = "/api/sa/hr";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: getUserRequestHeaders() });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getUserRequestHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function patch<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...getUserRequestHeaders() },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function del(path: string): Promise<void> {
  const r = await fetch(path, { method: "DELETE", headers: getUserRequestHeaders() });
  if (!r.ok) throw new Error(await r.text());
}

/* ─── Types ─── */

export interface HREmployee {
  id: string; name: string; nationalId: string | null; position: string | null; department: string | null;
  phone: string | null; email: string | null; hireDate: string | null;
  employmentType: "full_time" | "part_time" | "contract"; status: "active" | "on_leave" | "terminated";
  probationDays: number; notes: string | null; createdAt: string; updatedAt: string;
}
export type HRDocumentCategory = "personal" | "contract" | "qualifications" | "performance";
export interface HREmployeeDocument {
  id: string; employeeId: string; category: HRDocumentCategory; name: string; url: string;
  mimeType: string | null; size: number | null; description: string | null; expiryDate: string | null; uploadedAt: string;
}
export interface HREmployeeLeave {
  id: string; employeeId: string; leaveType: string; startDate: string; endDate: string; notes: string | null; createdAt: string;
}
export interface HRCandidate {
  id: string; name: string; phone: string | null; email: string | null; positionApplied: string | null;
  cvUrl: string | null; skills: string[]; status: string; offerStatus: string;
  offerSalary: number | null; offerStartDate: string | null; notes: string | null; createdAt: string;
}
export interface HRPolicy {
  id: string; title: string; category: string | null; fileUrl: string | null; description: string | null; effectiveDate: string | null; createdAt: string;
}
export interface HRLicense {
  id: string; name: string; licenseNumber: string | null; issuingAuthority: string | null;
  issueDate: string | null; expiryDate: string | null; fileUrl: string | null; notes: string | null; createdAt: string;
}
export interface HRCorrespondence {
  id: string; subject: string; direction: "incoming" | "outgoing"; authority: string | null;
  date: string | null; reference: string | null; fileUrl: string | null; notes: string | null; createdAt: string;
}

/* ─── Employees ─── */

export function useEmployees() {
  return useQuery<HREmployee[]>({ queryKey: ["hr-employees"], queryFn: () => get(`${API}/employees`) });
}
export function useEmployee(id: string | undefined) {
  return useQuery<HREmployee>({ queryKey: ["hr-employee", id], queryFn: () => get(`${API}/employees/${id}`), enabled: !!id });
}
export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<HREmployee>) => post<HREmployee>(`${API}/employees`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-employees"] }),
  });
}
export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<HREmployee> & { id: string }) => patch<HREmployee>(`${API}/employees/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hr-employees"] });
      qc.invalidateQueries({ queryKey: ["hr-employee", vars.id] });
    },
  });
}
export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`${API}/employees/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-employees"] }),
  });
}

/* ─── Employee documents ─── */

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery<HREmployeeDocument[]>({
    queryKey: ["hr-employee-documents", employeeId],
    queryFn: () => get(`${API}/employees/${employeeId}/documents`),
    enabled: !!employeeId,
  });
}
export function useSuggestDocumentCategory() {
  return useMutation({
    mutationFn: (body: { filename: string; description?: string }) =>
      post<{ category: HRDocumentCategory }>(`${API}/documents/suggest-category`, body),
  });
}
export function useCreateEmployeeDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<HREmployeeDocument>) => post<HREmployeeDocument>(`${API}/employees/${employeeId}/documents`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-employee-documents", employeeId] }),
  });
}
export function useDeleteEmployeeDocument(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) => del(`${API}/employees/${employeeId}/documents/${documentId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-employee-documents", employeeId] }),
  });
}

/* ─── Employee leaves ─── */

export function useEmployeeLeaves(employeeId: string | undefined) {
  return useQuery<HREmployeeLeave[]>({
    queryKey: ["hr-employee-leaves", employeeId],
    queryFn: () => get(`${API}/employees/${employeeId}/leaves`),
    enabled: !!employeeId,
  });
}
export function useCreateEmployeeLeave(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<HREmployeeLeave>) => post<HREmployeeLeave>(`${API}/employees/${employeeId}/leaves`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-employee-leaves", employeeId] }),
  });
}
export function useDeleteEmployeeLeave(employeeId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (leaveId: string) => del(`${API}/employees/${employeeId}/leaves/${leaveId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-employee-leaves", employeeId] }),
  });
}

/* ─── Candidates ─── */

export function useCandidates() {
  return useQuery<HRCandidate[]>({ queryKey: ["hr-candidates"], queryFn: () => get(`${API}/candidates`) });
}
export function useCandidate(id: string | undefined) {
  return useQuery<HRCandidate>({ queryKey: ["hr-candidate", id], queryFn: () => get(`${API}/candidates/${id}`), enabled: !!id });
}
export function useCreateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<HRCandidate>) => post<HRCandidate>(`${API}/candidates`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-candidates"] }),
  });
}
export function useUpdateCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: Partial<HRCandidate> & { id: string }) => patch<HRCandidate>(`${API}/candidates/${id}`, body),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hr-candidates"] });
      qc.invalidateQueries({ queryKey: ["hr-candidate", vars.id] });
    },
  });
}
export function useDeleteCandidate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`${API}/candidates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-candidates"] }),
  });
}
export function useExtractCvSkills() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cvUrl }: { id: string; cvUrl?: string }) =>
      post<{ skills: string[]; extracted: boolean; candidate?: HRCandidate }>(`${API}/candidates/${id}/extract-skills`, { cvUrl }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["hr-candidates"] });
      qc.invalidateQueries({ queryKey: ["hr-candidate", vars.id] });
    },
  });
}

/* ─── Corporate: policies ─── */

export function usePolicies() {
  return useQuery<HRPolicy[]>({ queryKey: ["hr-policies"], queryFn: () => get(`${API}/policies`) });
}
export function useCreatePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<HRPolicy>) => post<HRPolicy>(`${API}/policies`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-policies"] }),
  });
}
export function useDeletePolicy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`${API}/policies/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-policies"] }),
  });
}

/* ─── Corporate: licenses ─── */

export function useLicenses() {
  return useQuery<HRLicense[]>({ queryKey: ["hr-licenses"], queryFn: () => get(`${API}/licenses`) });
}
export function useCreateLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<HRLicense>) => post<HRLicense>(`${API}/licenses`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-licenses"] }),
  });
}
export function useDeleteLicense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`${API}/licenses/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-licenses"] }),
  });
}

/* ─── Corporate: correspondence ─── */

export function useCorrespondence() {
  return useQuery<HRCorrespondence[]>({ queryKey: ["hr-correspondence"], queryFn: () => get(`${API}/correspondence`) });
}
export function useCreateCorrespondence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<HRCorrespondence>) => post<HRCorrespondence>(`${API}/correspondence`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-correspondence"] }),
  });
}
export function useDeleteCorrespondence() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => del(`${API}/correspondence/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["hr-correspondence"] }),
  });
}
