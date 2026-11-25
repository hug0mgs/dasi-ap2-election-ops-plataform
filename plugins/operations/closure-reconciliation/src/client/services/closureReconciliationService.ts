import { apiClient } from "@eops/api-client";
import type {
  ClosureDashboard,
  ClosureDetail,
  ClosureFilters,
  ClosureHistory,
  ClosureReferences,
  ClosureRuleSet,
  ClosureSummary,
  CreateClosureInput,
  ExceptionInput,
  SignoffInput,
  UpdateClosureInput,
} from "../../types";

const base = "/closure-reconciliation";

export const closureReconciliationService = {
  references: () => apiClient.get<ClosureReferences>(`${base}/references`),
  rules: () => apiClient.get<ClosureRuleSet>(`${base}/rules`),
  dashboard: (query: ClosureFilters = {}) =>
    apiClient.get<ClosureDashboard>(`${base}/dashboard`, { query }),
  list: (query: ClosureFilters = {}) =>
    apiClient.get<ClosureSummary[]>(base, { query }),
  get: (id: string) => apiClient.get<ClosureDetail>(`${base}/${id}`),
  history: (id: string) =>
    apiClient.get<ClosureHistory[]>(`${base}/${id}/history`),
  create: (input: CreateClosureInput) =>
    apiClient.post<ClosureDetail>(base, input),
  update: (id: string, input: UpdateClosureInput) =>
    apiClient.patch<ClosureDetail>(`${base}/${id}`, input),
  refresh: (id: string, expectedUpdatedAt: string) =>
    apiClient.post<ClosureDetail>(`${base}/${id}/refresh`, {
      expectedUpdatedAt,
    }),
  resolveItem: (
    id: string,
    itemId: string,
    input: { expectedUpdatedAt: string; resolutionNote: string },
  ) =>
    apiClient.post<ClosureDetail>(
      `${base}/${id}/items/${itemId}/resolve`,
      input,
    ),
  dismissItem: (
    id: string,
    itemId: string,
    input: { expectedUpdatedAt: string; reason: string },
  ) =>
    apiClient.post<ClosureDetail>(
      `${base}/${id}/items/${itemId}/dismiss`,
      input,
    ),
  reopenItem: (
    id: string,
    itemId: string,
    input: { expectedUpdatedAt: string; reason: string },
  ) =>
    apiClient.post<ClosureDetail>(
      `${base}/${id}/items/${itemId}/reopen`,
      input,
    ),
  registerException: (id: string, input: ExceptionInput) =>
    apiClient.post<ClosureDetail>(`${base}/${id}/exceptions`, input),
  acceptException: (
    id: string,
    exceptionId: string,
    input: { expectedUpdatedAt: string; note?: string },
  ) =>
    apiClient.post<ClosureDetail>(
      `${base}/${id}/exceptions/${exceptionId}/accept`,
      input,
    ),
  revokeException: (
    id: string,
    exceptionId: string,
    input: { expectedUpdatedAt: string; reason: string },
  ) =>
    apiClient.post<ClosureDetail>(
      `${base}/${id}/exceptions/${exceptionId}/revoke`,
      input,
    ),
  signoff: (id: string, input: SignoffInput) =>
    apiClient.post<ClosureDetail>(`${base}/${id}/signoffs`, input),
  removeSignoff: (
    id: string,
    signoffId: string,
    expectedUpdatedAt: string,
  ) =>
    apiClient.delete<ClosureDetail>(`${base}/${id}/signoffs/${signoffId}`, {
      query: { expectedUpdatedAt },
    }),
  submit: (id: string, expectedUpdatedAt: string) =>
    apiClient.post<ClosureDetail>(`${base}/${id}/submit`, {
      expectedUpdatedAt,
    }),
  approve: (id: string, expectedUpdatedAt: string, note?: string) =>
    apiClient.post<ClosureDetail>(`${base}/${id}/approve`, {
      expectedUpdatedAt,
      note,
    }),
  close: (id: string, expectedUpdatedAt: string, closureReason: string) =>
    apiClient.post<ClosureDetail>(`${base}/${id}/close`, {
      expectedUpdatedAt,
      closureReason,
    }),
  reopen: (id: string, expectedUpdatedAt: string, reason: string) =>
    apiClient.post<ClosureDetail>(`${base}/${id}/reopen`, {
      expectedUpdatedAt,
      reason,
    }),
  cancel: (id: string, expectedUpdatedAt: string, reason: string) =>
    apiClient.post<ClosureDetail>(`${base}/${id}/cancel`, {
      expectedUpdatedAt,
      reason,
    }),
};
