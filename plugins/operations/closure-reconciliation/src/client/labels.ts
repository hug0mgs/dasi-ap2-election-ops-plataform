import type {
  ClosureCategory,
  ClosureExceptionStatus,
  ClosureHistoryAction,
  ClosureItemStatus,
  ClosureRisk,
  ClosureSeverity,
  ClosureSignoffRole,
  ClosureStatus,
} from "../types";

export const STATUS: Record<ClosureStatus, string> = {
  DRAFT: "Rascunho",
  COLLECTING: "Em conciliação",
  IN_REVIEW: "Em revisão",
  PENDING_EXCEPTIONS: "Exceções pendentes",
  READY: "Pronta para encerrar",
  CLOSED: "Encerrada",
  CANCELLED: "Cancelada",
};

export const CATEGORY: Record<ClosureCategory, string> = {
  ASSET_RETURN: "Ativos não devolvidos",
  DELIVERY: "Entregas pendentes",
  DISPATCH: "Despachos abertos",
  EVIDENCE: "Evidências faltantes",
};

export const ITEM_STATUS: Record<ClosureItemStatus, string> = {
  PENDING: "Pendente",
  EXCEPTION: "Em exceção",
  RESOLVED: "Resolvido",
  ACCEPTED: "Aceito",
  DISMISSED: "Dispensado",
};

export const SEVERITY: Record<ClosureSeverity, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  CRITICAL: "Crítica",
};

export const RISK: Record<ClosureRisk, string> = {
  LOW: "Baixo",
  MEDIUM: "Médio",
  HIGH: "Alto",
};

export const EXCEPTION_STATUS: Record<ClosureExceptionStatus, string> = {
  REGISTERED: "Aguardando aprovação",
  ACCEPTED: "Aprovada",
  EXPIRED: "Vencida",
  REVOKED: "Revogada",
};

export const SIGNOFF_ROLE: Record<ClosureSignoffRole, string> = {
  OPERATIONS_LEAD: "Liderança de operações",
  LOGISTICS: "Logística",
  FIELD: "Operação de campo",
  AUDIT: "Auditoria",
};

export const HISTORY_ACTION: Record<ClosureHistoryAction, string> = {
  CREATED: "Conciliação criada",
  UPDATED: "Conciliação atualizada",
  REFRESHED: "Detecção executada",
  ITEM_RESOLVED: "Item resolvido",
  ITEM_DISMISSED: "Item dispensado",
  ITEM_REOPENED: "Item reaberto",
  EXCEPTION_REGISTERED: "Exceção registrada",
  EXCEPTION_ACCEPTED: "Exceção aprovada",
  EXCEPTION_REVOKED: "Exceção revogada",
  SIGNOFF_ADDED: "Assinatura registrada",
  SIGNOFF_REMOVED: "Assinatura removida",
  SUBMITTED: "Conciliação submetida",
  APPROVED: "Conciliação aprovada",
  REOPENED: "Conciliação reaberta",
  CLOSED: "Encerramento concluído",
  CANCELLED: "Conciliação cancelada",
};

export type Tone = "neutral" | "success" | "warning" | "danger";

export function statusTone(status: ClosureStatus): Tone {
  if (status === "CLOSED") return "success";
  if (status === "READY") return "success";
  if (status === "CANCELLED") return "danger";
  if (status === "PENDING_EXCEPTIONS") return "danger";
  if (status === "IN_REVIEW") return "warning";
  return "neutral";
}

export function severityTone(severity: ClosureSeverity): Tone {
  if (severity === "CRITICAL" || severity === "HIGH") return "danger";
  if (severity === "MEDIUM") return "warning";
  return "neutral";
}

export function itemTone(status: ClosureItemStatus): Tone {
  if (status === "RESOLVED" || status === "ACCEPTED") return "success";
  if (status === "EXCEPTION") return "warning";
  if (status === "DISMISSED") return "neutral";
  return "danger";
}

export function exceptionTone(status: ClosureExceptionStatus): Tone {
  if (status === "ACCEPTED") return "success";
  if (status === "REGISTERED") return "warning";
  if (status === "EXPIRED" || status === "REVOKED") return "danger";
  return "neutral";
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDay(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}
