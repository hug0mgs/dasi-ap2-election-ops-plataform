-- CreateEnum
CREATE TYPE "PollingPlaceInspectionStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'CHANGES_REQUESTED', 'CANCELLED', 'REOPENED');

-- CreateEnum
CREATE TYPE "PollingPlaceInspectionFitness" AS ENUM ('NOT_ASSESSED', 'FIT', 'FIT_WITH_RESTRICTIONS', 'UNFIT');

-- CreateEnum
CREATE TYPE "PollingPlaceInspectionDimension" AS ENUM ('ACCESS', 'ENERGY', 'CONNECTIVITY', 'SIGNAGE', 'INFRASTRUCTURE');

-- CreateEnum
CREATE TYPE "PollingPlaceInspectionAnswer" AS ENUM ('COMPLIANT', 'PARTIALLY_COMPLIANT', 'NON_COMPLIANT', 'NOT_APPLICABLE', 'NOT_VERIFIED');

-- CreateEnum
CREATE TYPE "PollingPlaceInspectionAssigneeRole" AS ENUM ('LEAD', 'INSPECTOR', 'TECHNICAL_SUPPORT', 'REVIEWER');

-- CreateEnum
CREATE TYPE "PollingPlaceInspectionFindingStatus" AS ENUM ('OPEN', 'IN_TREATMENT', 'RESOLVED', 'ACCEPTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PollingPlaceInspectionSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PollingPlaceInspectionEvidenceTarget" AS ENUM ('INSPECTION', 'RESPONSE', 'FINDING', 'RESOLUTION');

-- CreateTable
CREATE TABLE "PollingPlaceInspectionTemplate" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollingPlaceInspectionTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingPlaceInspectionTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dimension" "PollingPlaceInspectionDimension" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "critical" BOOLEAN NOT NULL DEFAULT false,
    "evidenceRequired" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL,

    CONSTRAINT "PollingPlaceInspectionTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingPlaceInspection" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "electoralZoneId" TEXT NOT NULL,
    "pollingPlaceId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "inspectionType" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL DEFAULT 1,
    "previousInspectionId" TEXT,
    "status" "PollingPlaceInspectionStatus" NOT NULL DEFAULT 'DRAFT',
    "fitness" "PollingPlaceInspectionFitness" NOT NULL DEFAULT 'NOT_ASSESSED',
    "plannedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "accessNotes" TEXT,
    "localContact" TEXT,
    "lastExecutorId" TEXT,
    "createdById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollingPlaceInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingPlaceInspectionResponse" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "dimension" "PollingPlaceInspectionDimension" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "required" BOOLEAN NOT NULL,
    "critical" BOOLEAN NOT NULL,
    "evidenceRequired" BOOLEAN NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "answer" "PollingPlaceInspectionAnswer" NOT NULL DEFAULT 'NOT_VERIFIED',
    "observation" TEXT,
    "justification" TEXT,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PollingPlaceInspectionResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingPlaceInspectionAssignee" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userNameSnapshot" TEXT NOT NULL,
    "role" "PollingPlaceInspectionAssigneeRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "PollingPlaceInspectionAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingPlaceInspectionFinding" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "responseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "dimension" "PollingPlaceInspectionDimension" NOT NULL,
    "severity" "PollingPlaceInspectionSeverity" NOT NULL,
    "location" TEXT,
    "recommendation" TEXT,
    "responsibleId" TEXT,
    "responsibleName" TEXT,
    "dueAt" TIMESTAMP(3),
    "status" "PollingPlaceInspectionFindingStatus" NOT NULL DEFAULT 'OPEN',
    "blocking" BOOLEAN NOT NULL DEFAULT false,
    "blockingReason" TEXT,
    "resolution" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "riskAcceptanceReason" TEXT,
    "riskAcceptedById" TEXT,
    "riskAcceptanceValidUntil" TIMESTAMP(3),

    CONSTRAINT "PollingPlaceInspectionFinding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingPlaceInspectionEvidenceLink" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "targetType" "PollingPlaceInspectionEvidenceTarget" NOT NULL,
    "targetId" TEXT NOT NULL,
    "linkedById" TEXT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "PollingPlaceInspectionEvidenceLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingPlaceInspectionReview" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "fitness" "PollingPlaceInspectionFitness",
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollingPlaceInspectionReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PollingPlaceInspectionHistory" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT,
    "fromStatus" "PollingPlaceInspectionStatus",
    "toStatus" "PollingPlaceInspectionStatus",
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PollingPlaceInspectionHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PollingPlaceInspectionTemplate_code_version_key" ON "PollingPlaceInspectionTemplate"("code", "version");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionTemplateItem_templateId_dimension_sor_idx" ON "PollingPlaceInspectionTemplateItem"("templateId", "dimension", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "PollingPlaceInspectionTemplateItem_templateId_code_key" ON "PollingPlaceInspectionTemplateItem"("templateId", "code");

-- CreateIndex
CREATE INDEX "PollingPlaceInspection_electionId_electoralZoneId_status_idx" ON "PollingPlaceInspection"("electionId", "electoralZoneId", "status");

-- CreateIndex
CREATE INDEX "PollingPlaceInspection_pollingPlaceId_fitness_idx" ON "PollingPlaceInspection"("pollingPlaceId", "fitness");

-- CreateIndex
CREATE INDEX "PollingPlaceInspection_plannedAt_idx" ON "PollingPlaceInspection"("plannedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PollingPlaceInspection_pollingPlaceId_electionId_inspection_key" ON "PollingPlaceInspection"("pollingPlaceId", "electionId", "inspectionType", "roundNumber");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionResponse_inspectionId_dimension_answe_idx" ON "PollingPlaceInspectionResponse"("inspectionId", "dimension", "answer");

-- CreateIndex
CREATE UNIQUE INDEX "PollingPlaceInspectionResponse_inspectionId_templateItemId_key" ON "PollingPlaceInspectionResponse"("inspectionId", "templateItemId");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionAssignee_userId_active_idx" ON "PollingPlaceInspectionAssignee"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "PollingPlaceInspectionAssignee_inspectionId_userId_role_key" ON "PollingPlaceInspectionAssignee"("inspectionId", "userId", "role");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionFinding_inspectionId_status_blocking_idx" ON "PollingPlaceInspectionFinding"("inspectionId", "status", "blocking");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionFinding_responsibleId_dueAt_idx" ON "PollingPlaceInspectionFinding"("responsibleId", "dueAt");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionFinding_dimension_severity_idx" ON "PollingPlaceInspectionFinding"("dimension", "severity");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionEvidenceLink_targetType_targetId_idx" ON "PollingPlaceInspectionEvidenceLink"("targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "PollingPlaceInspectionEvidenceLink_inspectionId_evidenceId__key" ON "PollingPlaceInspectionEvidenceLink"("inspectionId", "evidenceId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionReview_inspectionId_createdAt_idx" ON "PollingPlaceInspectionReview"("inspectionId", "createdAt");

-- CreateIndex
CREATE INDEX "PollingPlaceInspectionHistory_inspectionId_createdAt_idx" ON "PollingPlaceInspectionHistory"("inspectionId", "createdAt");

-- AddForeignKey
ALTER TABLE "PollingPlaceInspectionTemplateItem" ADD CONSTRAINT "PollingPlaceInspectionTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PollingPlaceInspectionTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspection" ADD CONSTRAINT "PollingPlaceInspection_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspection" ADD CONSTRAINT "PollingPlaceInspection_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspection" ADD CONSTRAINT "PollingPlaceInspection_pollingPlaceId_fkey" FOREIGN KEY ("pollingPlaceId") REFERENCES "PollingPlace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspection" ADD CONSTRAINT "PollingPlaceInspection_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "PollingPlaceInspectionTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspection" ADD CONSTRAINT "PollingPlaceInspection_previousInspectionId_fkey" FOREIGN KEY ("previousInspectionId") REFERENCES "PollingPlaceInspection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspectionResponse" ADD CONSTRAINT "PollingPlaceInspectionResponse_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PollingPlaceInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspectionAssignee" ADD CONSTRAINT "PollingPlaceInspectionAssignee_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PollingPlaceInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspectionFinding" ADD CONSTRAINT "PollingPlaceInspectionFinding_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PollingPlaceInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspectionFinding" ADD CONSTRAINT "PollingPlaceInspectionFinding_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "PollingPlaceInspectionResponse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspectionEvidenceLink" ADD CONSTRAINT "PollingPlaceInspectionEvidenceLink_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PollingPlaceInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspectionReview" ADD CONSTRAINT "PollingPlaceInspectionReview_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PollingPlaceInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PollingPlaceInspectionHistory" ADD CONSTRAINT "PollingPlaceInspectionHistory_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "PollingPlaceInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
