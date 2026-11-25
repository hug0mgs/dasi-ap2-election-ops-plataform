export type InspectionStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "IN_PROGRESS"
  | "SUBMITTED"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "CANCELLED"
  | "REOPENED";
export type InspectionFitness =
  "NOT_ASSESSED" | "FIT" | "FIT_WITH_RESTRICTIONS" | "UNFIT";
export type InspectionDimension =
  "ACCESS" | "ENERGY" | "CONNECTIVITY" | "SIGNAGE" | "INFRASTRUCTURE";
export type InspectionAnswer =
  | "COMPLIANT"
  | "PARTIALLY_COMPLIANT"
  | "NON_COMPLIANT"
  | "NOT_APPLICABLE"
  | "NOT_VERIFIED";
export type InspectionAssigneeRole =
  "LEAD" | "INSPECTOR" | "TECHNICAL_SUPPORT" | "REVIEWER";
export type InspectionFindingStatus =
  "OPEN" | "IN_TREATMENT" | "RESOLVED" | "ACCEPTED" | "CANCELLED";
export type InspectionSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type InspectionEvidenceTarget =
  "INSPECTION" | "RESPONSE" | "FINDING" | "RESOLUTION";

export interface InspectionFilters {
  electionId?: string;
  electoralZoneId?: string;
  pollingPlaceId?: string;
  assigneeId?: string;
  status?: InspectionStatus;
  fitness?: InspectionFitness;
  problemDimension?: InspectionDimension;
  openBlocking?: boolean;
  from?: string;
  to?: string;
}
export interface InspectionReference {
  id: string;
  name: string;
}
export interface InspectionReferences {
  elections: Array<InspectionReference & { year: number }>;
  zones: Array<InspectionReference & { electionId: string; number: number }>;
  places: Array<
    InspectionReference & { electoralZoneId: string; address: string }
  >;
  users: Array<InspectionReference & { email: string }>;
}
export interface InspectionTemplateItem {
  id: string;
  code: string;
  title: string;
  description?: string | null;
  dimension: InspectionDimension;
  required: boolean;
  critical: boolean;
  evidenceRequired: boolean;
  sortOrder: number;
}
export interface InspectionTemplate {
  id: string;
  code: string;
  name: string;
  version: number;
  active: boolean;
  items: InspectionTemplateItem[];
}
export interface InspectionAssignee {
  id: string;
  userId: string;
  userNameSnapshot: string;
  role: InspectionAssigneeRole;
  active: boolean;
}
export interface InspectionResponse {
  id: string;
  itemCode: string;
  title: string;
  description?: string | null;
  dimension: InspectionDimension;
  required: boolean;
  critical: boolean;
  evidenceRequired: boolean;
  sortOrder: number;
  answer: InspectionAnswer;
  observation?: string | null;
  justification?: string | null;
}
export interface InspectionFinding {
  id: string;
  responseId?: string | null;
  title: string;
  description: string;
  dimension: InspectionDimension;
  severity: InspectionSeverity;
  status: InspectionFindingStatus;
  blocking: boolean;
  blockingReason?: string | null;
  location?: string | null;
  recommendation?: string | null;
  responsibleId?: string | null;
  responsibleName?: string | null;
  dueAt?: string | null;
  resolution?: string | null;
  taskId?: string | null;
}
export interface InspectionEvidenceLink {
  id: string;
  evidenceId: string;
  targetType: InspectionEvidenceTarget;
  targetId: string;
}
export interface InspectionReview {
  id: string;
  decision: string;
  reason?: string | null;
  fitness?: InspectionFitness | null;
  reviewerId: string;
  createdAt: string;
}
export interface InspectionHistory {
  id: string;
  action: string;
  details?: unknown;
  actorId: string;
  createdAt: string;
}
export interface PollingPlaceInspection {
  id: string;
  electionId: string;
  electoralZoneId: string;
  pollingPlaceId: string;
  templateId: string;
  inspectionType: string;
  round: number;
  status: InspectionStatus;
  fitness: InspectionFitness;
  plannedAt?: string | null;
  startedAt?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  accessNotes?: string | null;
  localContact?: string | null;
  updatedAt: string;
  election: InspectionReference;
  electoralZone: InspectionReference & { number: number };
  pollingPlace: InspectionReference & { address: string };
  template: InspectionTemplate;
  assignees: InspectionAssignee[];
  responses: InspectionResponse[];
  findings: InspectionFinding[];
  evidenceLinks: InspectionEvidenceLink[];
  reviews: InspectionReview[];
  history: InspectionHistory[];
  progress: number;
  openBlockingFindings: number;
  criticalDimensions: InspectionDimension[];
}
export interface InspectionDashboard {
  total: number;
  scheduled: number;
  inProgress: number;
  submitted: number;
  approved: number;
  unfit: number;
  openBlocking: number;
  averageProgress: number;
  byStatus: Partial<Record<InspectionStatus, number>>;
  criticalDimensions: Partial<Record<InspectionDimension, number>>;
  attention: PollingPlaceInspection[];
}
export interface ConcurrencyInput {
  expectedUpdatedAt: string;
}
export interface CreateInspectionInput {
  electionId: string;
  electoralZoneId: string;
  pollingPlaceId: string;
  templateId: string;
  inspectionType: string;
  previousInspectionId?: string;
}
export interface FindingInput extends ConcurrencyInput {
  title: string;
  description: string;
  dimension: InspectionDimension;
  severity: InspectionSeverity;
  responseId?: string;
  blocking?: boolean;
  blockingReason?: string;
  recommendation?: string;
  responsibleId?: string;
  dueAt?: string;
}
