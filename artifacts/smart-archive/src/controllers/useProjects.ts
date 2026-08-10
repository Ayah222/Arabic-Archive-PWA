import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SA, apiGet, apiPost, apiPatch, apiDel } from "../lib/apiClient";

export interface SAProject {
  id: string;
  name: string;
  description: string;
  client: string;
  status: "active" | "completed" | "on_hold" | "cancelled";
  progress: number;
  startDate: string;
  endDate: string | null;
  budget: number | null;
  location: string | null;
  coverImage: string | null;
  mapsUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectInput {
  name: string;
  description: string;
  client: string;
  status: "active" | "completed" | "on_hold" | "cancelled";
  progress: number;
  startDate: string;
  endDate?: string | null;
  budget?: number | null;
  location?: string | null;
  coverImage?: string | null;
}

export interface ProjectUpdate {
  name?: string;
  description?: string;
  client?: string;
  status?: "active" | "completed" | "on_hold" | "cancelled";
  progress?: number;
  startDate?: string;
  endDate?: string | null;
  budget?: number | null;
  location?: string | null;
  coverImage?: string | null;
}

export interface ListProjectsParams {
  q?: string;
  status?: string;
}

const QK_LIST = (p?: ListProjectsParams) =>
  ["sa-projects", p?.q ?? "", p?.status ?? ""];
const QK_ONE = (id: string) => ["sa-project", id];

export function useProjects(params?: ListProjectsParams) {
  const qs = params
    ? "?" + new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
      ).toString()
    : "";
  return useQuery<SAProject[]>({
    queryKey: QK_LIST(params),
    queryFn: () => apiGet<SAProject[]>(`${SA}/projects${qs}`),
    staleTime: 30_000,
  });
}

export function useProject(id: string) {
  return useQuery<SAProject>({
    queryKey: QK_ONE(id),
    queryFn: () => apiGet<SAProject>(`${SA}/projects/${id}`),
    enabled: !!id,
    staleTime: 30_000,
  });
}

export function useProjectActions() {
  const qc = useQueryClient();
  const invalidate = () => void qc.invalidateQueries({ queryKey: ["sa-projects"] });

  // Pages call: createProject.mutateAsync({ data: input })
  const createProject = useMutation({
    mutationFn: ({ data }: { data: ProjectInput }) =>
      apiPost<SAProject>(`${SA}/projects`, data),
    onSuccess: invalidate,
  });

  // Pages call: updateProject.mutateAsync({ id, data: update })
  const updateProject = useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProjectUpdate }) =>
      apiPatch<SAProject>(`${SA}/projects/${id}`, data),
    onSuccess: (_d, vars) => {
      invalidate();
      void qc.invalidateQueries({ queryKey: QK_ONE(vars.id) });
    },
  });

  // Pages call: deleteProject.mutateAsync({ id })
  const deleteProject = useMutation({
    mutationFn: ({ id }: { id: string }) => apiDel(`${SA}/projects/${id}`),
    onSuccess: invalidate,
  });

  return { createProject, updateProject, deleteProject };
}
