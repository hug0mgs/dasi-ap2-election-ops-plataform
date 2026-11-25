import { apiClient } from "@eops/api-client";
import type {
  ConcurrencyInput,
  CreateInspectionInput,
  FindingInput,
  InspectionAnswer,
  InspectionAssigneeRole,
  InspectionDashboard,
  InspectionEvidenceTarget,
  InspectionFilters,
  InspectionFitness,
  InspectionReferences,
  InspectionTemplate,
  PollingPlaceInspection,
} from "../../types";
const base = "/polling-place-inspections";
export const pollingPlaceInspectionsService = {
  references: () => apiClient.get<InspectionReferences>(`${base}/references`),
  catalog: () => apiClient.get<InspectionTemplate[]>(`${base}/catalog`),
  dashboard: (query: InspectionFilters = {}) =>
    apiClient.get<InspectionDashboard>(`${base}/dashboard`, { query }),
  list: (query: InspectionFilters = {}) =>
    apiClient.get<PollingPlaceInspection[]>(base, { query }),
  get: (id: string) => apiClient.get<PollingPlaceInspection>(`${base}/${id}`),
  history: (id: string) =>
    apiClient.get<PollingPlaceInspection["history"]>(`${base}/${id}/history`),
  create: (input: CreateInspectionInput) =>
    apiClient.post<PollingPlaceInspection>(base, input),
  update: (
    id: string,
    input: ConcurrencyInput & { accessNotes?: string; localContact?: string },
  ) => apiClient.patch<PollingPlaceInspection>(`${base}/${id}`, input),
  assign: (
    id: string,
    input: ConcurrencyInput & { userId: string; role: InspectionAssigneeRole },
  ) => apiClient.post<PollingPlaceInspection>(`${base}/${id}/assignees`, input),
  unassign: (id: string, assignmentId: string, input: ConcurrencyInput) =>
    apiClient.delete<PollingPlaceInspection>(
      `${base}/${id}/assignees/${assignmentId}`,
      { query: input },
    ),
  schedule: (id: string, input: ConcurrencyInput & { plannedAt: string }) =>
    apiClient.post<PollingPlaceInspection>(`${base}/${id}/schedule`, input),
  start: (id: string, input: ConcurrencyInput) =>
    apiClient.post<PollingPlaceInspection>(`${base}/${id}/start`, input),
  respond: (
    id: string,
    responseId: string,
    input: ConcurrencyInput & {
      answer: InspectionAnswer;
      observation?: string;
      justification?: string;
    },
  ) =>
    apiClient.put<PollingPlaceInspection>(
      `${base}/${id}/responses/${responseId}`,
      input,
    ),
  finding: (id: string, input: FindingInput) =>
    apiClient.post<PollingPlaceInspection>(`${base}/${id}/findings`, input),
  resolve: (
    id: string,
    findingId: string,
    input: ConcurrencyInput & { resolution: string },
  ) =>
    apiClient.post<PollingPlaceInspection>(
      `${base}/${id}/findings/${findingId}/resolve`,
      input,
    ),
  acceptRisk: (
    id: string,
    findingId: string,
    input: ConcurrencyInput & { reason: string; validUntil: string },
  ) =>
    apiClient.post<PollingPlaceInspection>(
      `${base}/${id}/findings/${findingId}/accept-risk`,
      input,
    ),
  evidence: (
    id: string,
    input: ConcurrencyInput & {
      evidenceId: string;
      targetType: InspectionEvidenceTarget;
      targetId: string;
      remove?: boolean;
    },
  ) =>
    apiClient.put<PollingPlaceInspection>(
      `${base}/${id}/evidence-links`,
      input,
    ),
  submit: (id: string, input: ConcurrencyInput) =>
    apiClient.post<PollingPlaceInspection>(`${base}/${id}/submit`, input),
  approve: (
    id: string,
    input: ConcurrencyInput & { fitness: InspectionFitness; reason?: string },
  ) => apiClient.post<PollingPlaceInspection>(`${base}/${id}/approve`, input),
  requestChanges: (id: string, input: ConcurrencyInput & { reason: string }) =>
    apiClient.post<PollingPlaceInspection>(
      `${base}/${id}/request-changes`,
      input,
    ),
  reopen: (id: string, input: ConcurrencyInput & { reason: string }) =>
    apiClient.post<PollingPlaceInspection>(`${base}/${id}/reopen`, input),
  cancel: (id: string, input: ConcurrencyInput & { reason: string }) =>
    apiClient.post<PollingPlaceInspection>(`${base}/${id}/cancel`, input),
};
