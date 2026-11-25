import {
  ClosureExceptionStatus,
  ClosureItemStatus,
  ClosureSeverity,
  ClosureSignoffRole,
} from "@prisma/client";

/**
 * Regras puras da conciliação de encerramento.
 *
 * O cálculo vive no backend e é reutilizado por dashboard, detalhe e testes.
 * O frontend consome o resultado derivado e nunca mantém uma segunda fonte de
 * verdade para prontidão, bloqueio ou lacunas de assinatura.
 */

export const SEVERITY_WEIGHT: Record<ClosureSeverity, number> = {
  [ClosureSeverity.CRITICAL]: 4,
  [ClosureSeverity.HIGH]: 3,
  [ClosureSeverity.MEDIUM]: 2,
  [ClosureSeverity.LOW]: 1,
};

/** Risco residual de uma pendência tratada por exceção justificada. */
export const RESIDUAL_RISK_FACTOR = 0.4;

export const MINIMUM_SIGNOFF_ROLES: readonly ClosureSignoffRole[] = [
  ClosureSignoffRole.OPERATIONS_LEAD,
  ClosureSignoffRole.LOGISTICS,
];

export const RECOMMENDED_SIGNOFF_ROLES: readonly ClosureSignoffRole[] = [
  ClosureSignoffRole.FIELD,
  ClosureSignoffRole.AUDIT,
];

export const SIGNOFF_PENALTY: Record<ClosureSignoffRole, number> = {
  [ClosureSignoffRole.OPERATIONS_LEAD]: 10,
  [ClosureSignoffRole.LOGISTICS]: 10,
  [ClosureSignoffRole.FIELD]: 5,
  [ClosureSignoffRole.AUDIT]: 5,
};

export const SIGNOFF_LABELS: Record<ClosureSignoffRole, string> = {
  [ClosureSignoffRole.OPERATIONS_LEAD]: "Liderança de operações",
  [ClosureSignoffRole.LOGISTICS]: "Logística",
  [ClosureSignoffRole.FIELD]: "Operação de campo",
  [ClosureSignoffRole.AUDIT]: "Auditoria",
};

export interface WeightedItem {
  status: ClosureItemStatus;
  severity: ClosureSeverity;
  blocking: boolean;
}

export interface ExceptionLike {
  status: ClosureExceptionStatus | string;
  validUntil: Date | string | null;
}

export interface SignoffLike {
  role: ClosureSignoffRole | string;
}

export interface EvaluationInput {
  items: WeightedItem[];
  exceptions: ExceptionLike[];
  signoffs: SignoffLike[];
  lastRefreshedAt: Date | string | null;
  now?: Date;
  /**
   * Exceções ainda registradas são aceitáveis na submissão: elas levam a
   * conciliação para `PENDING_EXCEPTIONS`. Aprovação e encerramento continuam
   * exigindo aprovação de todas as exceções.
   */
  allowOpenExceptions?: boolean;
}

export interface ClosureEvaluationResult {
  readinessScore: number;
  blockingItems: number;
  readyToClose: boolean;
  blockers: string[];
  signoffGaps: ClosureSignoffRole[];
  acceptedExceptions: number;
  openExceptions: number;
  expiredExceptions: number;
}

const TREATED_STATUSES: readonly ClosureItemStatus[] = [
  ClosureItemStatus.RESOLVED,
  ClosureItemStatus.DISMISSED,
];

const RESIDUAL_STATUSES: readonly ClosureItemStatus[] = [
  ClosureItemStatus.EXCEPTION,
  ClosureItemStatus.ACCEPTED,
];

function toTime(value: Date | string | null): number | null {
  if (!value) return null;
  const time = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(time) ? time : null;
}

export function isExceptionExpired(
  exception: ExceptionLike,
  now: Date = new Date(),
): boolean {
  if (exception.status !== ClosureExceptionStatus.ACCEPTED) return false;
  const validUntil = toTime(exception.validUntil);
  return validUntil !== null && validUntil < now.getTime();
}

export function isPendingItem(item: WeightedItem): boolean {
  return item.status === ClosureItemStatus.PENDING;
}

export function isTreatedItem(item: WeightedItem): boolean {
  return TREATED_STATUSES.includes(item.status);
}

export function countBlocking(items: WeightedItem[]): number {
  return items.filter((item) => item.blocking && isPendingItem(item)).length;
}

/**
 * Penalidade de um item, em unidades de peso.
 *
 * - `RESOLVED`/`DISMISSED`: zero;
 * - `EXCEPTION`/`ACCEPTED`: risco residual de 40%;
 * - `PENDING`: peso integral por severidade.
 */
export function itemPenalty(item: WeightedItem): number {
  const weight = SEVERITY_WEIGHT[item.severity] ?? 1;
  if (isTreatedItem(item)) return 0;
  if (RESIDUAL_STATUSES.includes(item.status)) {
    return weight * RESIDUAL_RISK_FACTOR;
  }
  return weight;
}

export function totalWeight(items: WeightedItem[]): number {
  return items.reduce(
    (sum, item) => sum + (SEVERITY_WEIGHT[item.severity] ?? 1),
    0,
  );
}

export function pendingPenalty(items: WeightedItem[]): number {
  return items.reduce((sum, item) => sum + itemPenalty(item), 0);
}

export function signoffGaps(
  signoffs: SignoffLike[],
  required: readonly ClosureSignoffRole[] = MINIMUM_SIGNOFF_ROLES,
): ClosureSignoffRole[] {
  const present = new Set(signoffs.map((signoff) => signoff.role));
  return required.filter((role) => !present.has(role));
}

export function signoffPenalty(signoffs: SignoffLike[]): number {
  const present = new Set(signoffs.map((signoff) => signoff.role));
  return (Object.keys(SIGNOFF_PENALTY) as ClosureSignoffRole[]).reduce(
    (sum, role) => sum + (present.has(role) ? 0 : SIGNOFF_PENALTY[role]),
    0,
  );
}

export function computeReadiness(
  items: WeightedItem[],
  signoffs: SignoffLike[],
): number {
  const weight = totalWeight(items);
  const penalty = pendingPenalty(items);
  const detectionScore =
    weight === 0 ? 100 : 100 - Math.round((100 * penalty) / weight);
  return Math.max(0, Math.min(100, detectionScore - signoffPenalty(signoffs)));
}

export function evaluateClosure(
  input: EvaluationInput,
): ClosureEvaluationResult {
  const now = input.now ?? new Date();
  const blocking = countBlocking(input.items);
  const gaps = signoffGaps(input.signoffs);
  const expired = input.exceptions.filter((exception) =>
    isExceptionExpired(exception, now),
  ).length;
  const open = input.exceptions.filter(
    (exception) => exception.status === ClosureExceptionStatus.REGISTERED,
  ).length;
  const accepted = input.exceptions.filter(
    (exception) => exception.status === ClosureExceptionStatus.ACCEPTED,
  ).length;

  const blockers: string[] = [];
  if (!input.lastRefreshedAt) {
    blockers.push(
      "Sem detecção registrada: atualize as pendências antes de submeter.",
    );
  }
  if (blocking > 0) {
    blockers.push(
      `${blocking} pendência(s) impeditiva(s) sem tratamento ou exceção aprovada.`,
    );
  }
  if (open > 0 && !input.allowOpenExceptions) {
    blockers.push(`${open} exceção(ões) aguardando aprovação.`);
  }
  if (expired > 0) {
    blockers.push(`${expired} exceção(ões) aprovada(s) com validade vencida.`);
  }
  if (gaps.length > 0) {
    blockers.push(
      `Assinatura obrigatória ausente: ${gaps
        .map((role) => SIGNOFF_LABELS[role])
        .join(", ")}.`,
    );
  }

  return {
    readinessScore: computeReadiness(input.items, input.signoffs),
    blockingItems: blocking,
    readyToClose: blockers.length === 0,
    blockers,
    signoffGaps: gaps,
    acceptedExceptions: accepted,
    openExceptions: open,
    expiredExceptions: expired,
  };
}

/**
 * Escalona a severidade de uma pendência vencida.
 *
 * A regra é conservadora: item vencido nunca desce de `HIGH` e item crítico
 * permanece crítico.
 */
export function escalateSeverity(
  base: ClosureSeverity,
  dueAt: Date | string | null,
  now: Date = new Date(),
): ClosureSeverity {
  if (base === ClosureSeverity.CRITICAL) return base;
  const due = toTime(dueAt);
  if (due !== null && due < now.getTime()) return ClosureSeverity.HIGH;
  return base;
}

export function summarizeCategory(
  items: Array<{ category: string; status: ClosureItemStatus }>,
  category: string,
): number {
  return items.filter(
    (item) =>
      item.category === category && item.status !== ClosureItemStatus.RESOLVED,
  ).length;
}
