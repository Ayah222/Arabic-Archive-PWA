import { useQueryClient } from "@tanstack/react-query";
import {
  useListContracts, useCreateContract, useUpdateContract, useDeleteContract,
  getListContractsQueryKey,
  useListProjectContractors, useCreateProjectContractor, useUpdateProjectContractor, useDeleteProjectContractor,
  getListProjectContractorsQueryKey,
  useListDocuments, useCreateDocument, useDeleteDocument,
  getListDocumentsQueryKey,
  useListMeetings, useCreateMeeting, useUpdateMeeting, useDeleteMeeting,
  getListMeetingsQueryKey,
  useListLetters, useCreateLetter, useDeleteLetter,
  getListLettersQueryKey,
} from "@workspace/api-client-react";

export function useContracts(projectId: string) {
  const qc = useQueryClient();
  const list = useListContracts(projectId);
  const create = useCreateContract({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListContractsQueryKey(projectId) }) } });
  const update = useUpdateContract({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListContractsQueryKey(projectId) }) } });
  const remove = useDeleteContract({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListContractsQueryKey(projectId) }) } });
  return { list, create, update, remove };
}

export function useProjectContractors(projectId: string) {
  const qc = useQueryClient();
  const list = useListProjectContractors(projectId);
  const create = useCreateProjectContractor({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListProjectContractorsQueryKey(projectId) }) } });
  const update = useUpdateProjectContractor({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListProjectContractorsQueryKey(projectId) }) } });
  const remove = useDeleteProjectContractor({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListProjectContractorsQueryKey(projectId) }) } });
  return { list, create, update, remove };
}

export function useDocuments(projectId: string) {
  const qc = useQueryClient();
  const list = useListDocuments(projectId);
  const create = useCreateDocument({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListDocumentsQueryKey(projectId) }) } });
  const remove = useDeleteDocument({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListDocumentsQueryKey(projectId) }) } });
  return { list, create, remove };
}

export function useMeetings(projectId: string) {
  const qc = useQueryClient();
  const list = useListMeetings(projectId);
  const create = useCreateMeeting({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListMeetingsQueryKey(projectId) }) } });
  const update = useUpdateMeeting({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListMeetingsQueryKey(projectId) }) } });
  const remove = useDeleteMeeting({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListMeetingsQueryKey(projectId) }) } });
  return { list, create, update, remove };
}

export function useLetters(projectId: string) {
  const qc = useQueryClient();
  const list = useListLetters(projectId);
  const create = useCreateLetter({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListLettersQueryKey(projectId) }) } });
  const remove = useDeleteLetter({ mutation: { onSuccess: () => qc.invalidateQueries({ queryKey: getListLettersQueryKey(projectId) }) } });
  return { list, create, remove };
}
