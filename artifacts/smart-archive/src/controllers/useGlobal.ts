import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

const API = "/api/sa";

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

async function del(path: string): Promise<void> {
  const r = await fetch(path, { method: "DELETE" });
  if (!r.ok) throw new Error(await r.text());
}

export function useAllContractors(q?: string) {
  const url = `${API}/all/contractors${q ? `?q=${encodeURIComponent(q)}` : ""}`;
  return useQuery<Array<{ id: string; projectId: string; projectName: string; name: string; specialty: string; phone: string | null; email: string | null; status: string; notes: string | null; createdAt: string }>>({
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
  return useQuery<Array<{ id: string; projectId: string; projectName: string; subject: string; direction: string; from: string; to: string; date: string; reference: string | null; notes: string | null }>>({
    queryKey: ["all-letters", q],
    queryFn: () => get(url),
  });
}

export function useSearch(q: string) {
  return useQuery<{
    projects: Array<{ id: string; name: string; client: string; status: string; progress: number }>;
    contractors: Array<{ id: string; name: string; specialty: string; projectName: string }>;
    contracts: Array<{ id: string; title: string; party: string; projectName: string }>;
    meetings: Array<{ id: string; title: string; date: string; projectName: string }>;
    letters: Array<{ id: string; subject: string; direction: string; projectName: string }>;
  }>({
    queryKey: ["search", q],
    queryFn: () => get(`${API}/search?q=${encodeURIComponent(q)}`),
    enabled: q.length > 1,
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
