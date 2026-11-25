export type ClosureStatus =
  | "DRAFT"
  | "COLLECTING"
  | "IN_REVIEW"
  | "PENDING_EXCEPTIONS"
  | "READY"
  | "CLOSED"
  | "CANCELLED";

export type ClosureCategory =
  | "ASSET_RETURN"
  | "DELIVERY"
  | "DISPATCH"
  | "EVIDENCE";

export type ClosureItemStatus =
  | "PENDING"
  | "EXCEPTION"
  | "RESOLVED"
  | "ACCEPTED"
  | "DISMISSED";

export type ClosureSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ClosureRisk = "LOW" | "MEDIUM" | "HIGH";

export type ClosureExceptionStatus =
  | "REGISTERED"
  | "ACCEPTED"
  | "EXPIRED"
  | "REVOKED";

export type ClosureSignoffRole =
  | "OPERATIONS_LEAD"
  | "LOGISTICS"
  | "FIELD"
  | "AUDIT";

export type ClosureHistoryAction =
  | "CREATED"
  | "UPDATED"
  | "REFRESHED"
  | "ITEM_RESOLVED"
  | "ITEM_DISMISSED"
  | "ITEM_REOPENED"
  | "EXCEPTION_REGISTERED"
  | "EXCEPTION_ACCEPTED"
  | "EXCEPTION_REVOKED"
  | "SIGNOFF_ADDED"
  | "SIGNOFF_REMOVED"
  | "SUBMITTED"
  | "APPROVED"
  | "REOPENED"
  | "CLOSED"
  | "CANCELLED";

export interface ClosureFilters {
  electionId?: string;
  electoralZoneId?: string;
  status?: ClosureStatus;
  category?: ClosureCategory;
  severity?: ClosureSeverity;
  blocking?: boolean;
  from?: string;
  to?: string;
}

export interface ClosureReference {
  id: string;
  name: string;
}

export interface ClosureReferences {
  elections: Array<ClosureReference & { year: number; status: string }>;
  zones: Array<ClosureReference & { electionId: string; number: number }>;
  users: Array<ClosureReference & { email: string }>;
}

export interface ClosureRuleDescription {
  category: ClosureCategory;
  label: string;
  blocking: boolean;
  description: string;
  sources: string[];
}

export interface ClosureRuleSet {
  categories: ClosureRuleDescription[];
  severities: ClosureSeverity[];
  risks: ClosureRisk[];
  signoffRoles: ClosureSignoffRole[];
  minimumSignoffRoles: ClosureSignoffRole[];
  recommendedSignoffRoles: ClosureSignoffRole[];
}

export interface ClosureItem {
  id: string;
  category: ClosureCategory;
  sourceType: string;
  sourceId: string;
  referenceLabel: string;
  title: string;
  detail?: string | null;
  severity: ClosureSeverity;
  blocking: boolean;
  status: ClosureItemStatus;
  dueAt?: string | null;
  detectedAt: string;
  lastSeenAt: string;
  resolvedAt?: string | null;
  resolvedById?: string | null;
  resolutionNote?: string | null;
  payload?: unknown;
}

export interface ClosureException {
  id: string;
  itemId?: string | null;
  category: ClosureCategory;
  risk: ClosureRisk;
  justification: string;
  mitigation?: string | null;
  status: ClosureExceptionStatus;
  validUntil?: string | null;
  registeredById: string;
  registeredByName?: string | null;
  approvedById?: string | null;
  approvedAt?: string | null;
  revokedAt?: string | null;
  revokedById?: string | null;
  revokeReason?: string | null;
  createdAt: string;
  updatedAt: string;
  item?: { id: string; referenceLabel: string; title: string } | null;
}

export interface ClosureSignoff {
  id: string;
  role: ClosureSignoffRole;
  userId: string;
  userNameSnapshot: string;
  statement: string;
  signedAt: string;
}

export interface ClosureHistory {
  id: string;
  action: ClosureHistoryAction;
  actorId?: string | null;
  summary: string;
  fromStatus?: ClosureStatus | null;
  toStatus?: ClosureStatus | null;
  payload?: unknown;
  createdAt: string;
}

export interface ClosureSummary {
  id: string;
  code: string;
  electionId: string;
  electoralZoneId?: string | null;
  status: ClosureStatus;
  notes?: string | null;
  closureReason?: string | null;
  assetsUnreturned: number;
  deliveriesPending: number;
  dispatchesOpen: number;
  evidenceMissing: number;
  exceptionsOpen: number;
  exceptionsAccepted: number;
  exceptionsExpired: number;
  blockingItems: number;
  readinessScore: number;
  lastRefreshedAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  createdById?: string | null;
  submittedById?: string | null;
  approvedById?: string | null;
  closedById?: string | null;
  updatedAt: string;
  election: { id: string; name: string; year: number };
  electoralZone?: { id: string; number: number; name: string } | null;
}

export interface ClosureEvaluation {
  readinessScore: number;
  blockingItems: number;
  readyToClose: boolean;
  blockers: string[];
  signoffGaps: ClosureSignoffRole[];
}

export interface ClosureDetail extends ClosureSummary {
  items: ClosureItem[];
  exceptions: ClosureException[];
  signoffs: ClosureSignoff[];
  history: ClosureHistory[];
  evaluation: ClosureEvaluation;
}

export interface ClosureDashboard {
  totals: {
    reconciliations: number;
    open: number;
    ready: number;
    closed: number;
    cancelled: number;
  };
  pending: {
    assetsUnreturned: number;
    deliveriesPending: number;
    dispatchesOpen: number;
    evidenceMissing: number;
    blockingItems: number;
    exceptionsOpen: number;
  };
  severity: Partial<Record<ClosureSeverity, number>>;
  category: Partial<Record<ClosureCategory, number>>;
  averageReadiness: number;
  attention: ClosureSummary[];
}

export interface ConcurrencyInput {
  expectedUpdatedAt: string;
}

export interface CreateClosureInput {
  electionId: string;
  electoralZoneId?: string;
  notes?: string;
}

export interface UpdateClosureInput extends ConcurrencyInput {
  notes?: string;
  closureReason?: string;
}

export interface ExceptionInput extends ConcurrencyInput {
  itemId?: string;
  category?: ClosureCategory;
  risk: ClosureRisk;
  justification: string;
  mitigation?: string;
  validUntil?: string;
}

export interface SignoffInput extends ConcurrencyInput {
  role: ClosureSignoffRole;
  statement: string;
}
