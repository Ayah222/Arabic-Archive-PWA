import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  getListProjectsQueryKey,
  getGetProjectQueryKey,
  useGetProject,
} from "@workspace/api-client-react";
import type { ListProjectsParams, ProjectInput, ProjectUpdate } from "@workspace/api-client-react";

export function useProjects(params?: ListProjectsParams) {
  return useListProjects(params);
}

export function useProject(id: string) {
  return useGetProject(id);
}

export function useProjectActions() {
  const qc = useQueryClient();

  const createProject = useCreateProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
    },
  });

  const updateProject = useUpdateProject({
    mutation: {
      onSuccess: (_data, vars) => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        qc.invalidateQueries({ queryKey: getGetProjectQueryKey(vars.id) });
      },
    },
  });

  const deleteProject = useDeleteProject({
    mutation: {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProjectsQueryKey() });
      },
    },
  });

  return { createProject, updateProject, deleteProject };
}

export type { ProjectInput, ProjectUpdate };
