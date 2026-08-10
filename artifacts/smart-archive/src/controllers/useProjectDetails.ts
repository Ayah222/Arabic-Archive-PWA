import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SA, apiGet, apiPost, apiPatch, apiDel } from "../lib/apiClient";

/* ─── Types ─── */
export interface SAContract {
  id: string; projectId: string; title: string; party: string;
  value: number; startDate: string; endDate: string;
  status: "active" | "completed" | "pending" | "cancelled";
  notes: string | null; fileUrl: string | null; createdAt: string;
}

export interface SAProjectContractor {
  id: string; projectId: string; name: string; specialty: string;
  phone: string | null; email: string | null; status: "active" | "inactive";
  notes: string | null; rating: unknown | null; createdAt: string;
}

export interface SADocument {
  id: string; projectId: string; name: string; docRef: string;
  type: "pdf" | "image" | "word" | "excel" | "powerpoint" | "text" | "other";
  url: string; size: number | null; notes: string | null;
  revisions: unknown[]; currentRevision: number;
  approvalStatus: "under_review" | "approved" | "rejected" | "approved_with_notes";
  createdAt: string;
}

export interface SAMeeting {
  id: string; projectId: string; title: string; date: string;
  location: string | null; attendees: string[]; agenda: string | null;
  notes: string | null; createdAt: string;
}

export interface SALetter {
  id: string; projectId: string; subject: string;
  direction: "incoming" | "outgoing"; from: string; to: string;
  date: string; reference: string | null; autoRef: string;
  recipients: string[]; distributionStatus: string;
  notes: string | null; fileUrl: string | null; createdAt: string;
}

/* ─── Contracts ─────────────────────────────────────────────────────────────
 * Pages call:
 *   create.mutateAsync({ id: projectId, data: { ... } })
 *   update.mutateAsync({ id: projectId, cid: contractId, data: { ... } })
 *   remove.mutateAsync({ id: projectId, cid: contractId })
 * ─────────────────────────────────────────────────────────────────────────*/
const QK_CONTRACTS = (pid: string) => ["sa-contracts", pid];

export function useContracts(projectId: string) {
  const qc = useQueryClient();
  const inv = () => void qc.invalidateQueries({ queryKey: QK_CONTRACTS(projectId) });
  const base = `${SA}/projects/${projectId}/contracts`;

  const list = useQuery<SAContract[]>({
    queryKey: QK_CONTRACTS(projectId),
    queryFn: () => apiGet<SAContract[]>(base),
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: ({ data }: { id?: string; data: Partial<SAContract> }) =>
      apiPost<SAContract>(base, data),
    onSuccess: inv,
  });

  const update = useMutation({
    mutationFn: ({ cid, data }: { id?: string; cid: string; data: Partial<SAContract> }) =>
      apiPatch<SAContract>(`${base}/${cid}`, data),
    onSuccess: inv,
  });

  const remove = useMutation({
    mutationFn: ({ cid }: { id?: string; cid: string }) => apiDel(`${base}/${cid}`),
    onSuccess: inv,
  });

  return { list, create, update, remove };
}

/* ─── Project Contractors ────────────────────────────────────────────────────
 * Pages call:
 *   create.mutateAsync({ id: projectId, data: { ... } })
 *   update.mutateAsync({ id: projectId, cid: contractorId, data: { ... } })
 *   remove.mutateAsync({ id: projectId, cid: contractorId })
 * ─────────────────────────────────────────────────────────────────────────*/
const QK_PC = (pid: string) => ["sa-project-contractors", pid];

export function useProjectContractors(projectId: string) {
  const qc = useQueryClient();
  const inv = () => void qc.invalidateQueries({ queryKey: QK_PC(projectId) });
  const base = `${SA}/projects/${projectId}/contractors`;

  const list = useQuery<SAProjectContractor[]>({
    queryKey: QK_PC(projectId),
    queryFn: () => apiGet<SAProjectContractor[]>(base),
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: ({ data }: { id?: string; data: Partial<SAProjectContractor> }) =>
      apiPost<SAProjectContractor>(base, data),
    onSuccess: inv,
  });

  const update = useMutation({
    mutationFn: ({ cid, data }: { id?: string; cid: string; data: Partial<SAProjectContractor> }) =>
      apiPatch<SAProjectContractor>(`${base}/${cid}`, data),
    onSuccess: inv,
  });

  const remove = useMutation({
    mutationFn: ({ cid }: { id?: string; cid: string }) => apiDel(`${base}/${cid}`),
    onSuccess: inv,
  });

  return { list, create, update, remove };
}

/* ─── Documents ──────────────────────────────────────────────────────────────
 * Pages call:
 *   create.mutateAsync({ id: projectId, data: { ... } })
 *   remove.mutateAsync({ id: projectId, did: docId })
 * ─────────────────────────────────────────────────────────────────────────*/
const QK_DOCS = (pid: string) => ["sa-documents", pid];

export function useDocuments(projectId: string) {
  const qc = useQueryClient();
  const inv = () => void qc.invalidateQueries({ queryKey: QK_DOCS(projectId) });
  const base = `${SA}/projects/${projectId}/documents`;

  const list = useQuery<SADocument[]>({
    queryKey: QK_DOCS(projectId),
    queryFn: () => apiGet<SADocument[]>(base),
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: ({ data }: { id?: string; data: Partial<SADocument> }) =>
      apiPost<SADocument>(base, data),
    onSuccess: inv,
  });

  const remove = useMutation({
    mutationFn: ({ did }: { id?: string; did: string }) => apiDel(`${base}/${did}`),
    onSuccess: inv,
  });

  return { list, create, remove };
}

/* ─── Meetings ───────────────────────────────────────────────────────────────
 * Pages call:
 *   create.mutateAsync({ id: projectId, data: { ... } })
 *   update.mutateAsync({ id: projectId, mid: meetingId, data: { ... } })   ← not used yet
 *   remove.mutateAsync({ id: projectId, mid: meetingId })
 * ─────────────────────────────────────────────────────────────────────────*/
const QK_MEETINGS = (pid: string) => ["sa-meetings", pid];

export function useMeetings(projectId: string) {
  const qc = useQueryClient();
  const inv = () => void qc.invalidateQueries({ queryKey: QK_MEETINGS(projectId) });
  const base = `${SA}/projects/${projectId}/meetings`;

  const list = useQuery<SAMeeting[]>({
    queryKey: QK_MEETINGS(projectId),
    queryFn: () => apiGet<SAMeeting[]>(base),
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: ({ data }: { id?: string; data: Partial<SAMeeting> }) =>
      apiPost<SAMeeting>(base, data),
    onSuccess: inv,
  });

  const update = useMutation({
    mutationFn: ({ mid, data }: { id?: string; mid?: string; data: Partial<SAMeeting> }) =>
      apiPatch<SAMeeting>(`${base}/${mid}`, data),
    onSuccess: inv,
  });

  const remove = useMutation({
    mutationFn: ({ mid }: { id?: string; mid: string }) => apiDel(`${base}/${mid}`),
    onSuccess: inv,
  });

  return { list, create, update, remove };
}

/* ─── Letters ────────────────────────────────────────────────────────────────
 * Pages call:
 *   create.mutateAsync({ id: projectId, data: { ... } })
 *   remove.mutateAsync({ id: projectId, lid: letterId })
 * ─────────────────────────────────────────────────────────────────────────*/
const QK_LETTERS = (pid: string) => ["sa-letters", pid];

export function useLetters(projectId: string) {
  const qc = useQueryClient();
  const inv = () => void qc.invalidateQueries({ queryKey: QK_LETTERS(projectId) });
  const base = `${SA}/projects/${projectId}/letters`;

  const list = useQuery<SALetter[]>({
    queryKey: QK_LETTERS(projectId),
    queryFn: () => apiGet<SALetter[]>(base),
    enabled: !!projectId,
  });

  const create = useMutation({
    mutationFn: ({ data }: { id?: string; data: Partial<SALetter> }) =>
      apiPost<SALetter>(base, data),
    onSuccess: inv,
  });

  const remove = useMutation({
    mutationFn: ({ lid }: { id?: string; lid: string }) => apiDel(`${base}/${lid}`),
    onSuccess: inv,
  });

  return { list, create, remove };
}
