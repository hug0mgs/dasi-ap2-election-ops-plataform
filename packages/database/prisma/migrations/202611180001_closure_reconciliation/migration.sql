-- CreateEnum
CREATE TYPE "ClosureReconciliationStatus" AS ENUM ('DRAFT', 'COLLECTING', 'IN_REVIEW', 'PENDING_EXCEPTIONS', 'READY', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClosureItemCategory" AS ENUM ('ASSET_RETURN', 'DELIVERY', 'DISPATCH', 'EVIDENCE');

-- CreateEnum
CREATE TYPE "ClosureItemStatus" AS ENUM ('PENDING', 'EXCEPTION', 'RESOLVED', 'ACCEPTED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ClosureSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ClosureExceptionStatus" AS ENUM ('REGISTERED', 'ACCEPTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "ClosureExceptionRisk" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- CreateEnum
CREATE TYPE "ClosureSignoffRole" AS ENUM ('OPERATIONS_LEAD', 'LOGISTICS', 'FIELD', 'AUDIT');

-- CreateEnum
CREATE TYPE "ClosureHistoryAction" AS ENUM ('CREATED', 'UPDATED', 'REFRESHED', 'ITEM_RESOLVED', 'ITEM_DISMISSED', 'ITEM_REOPENED', 'EXCEPTION_REGISTERED', 'EXCEPTION_ACCEPTED', 'EXCEPTION_REVOKED', 'SIGNOFF_ADDED', 'SIGNOFF_REMOVED', 'SUBMITTED', 'APPROVED', 'REOPENED', 'CLOSED', 'CANCELLED');

-- CreateTable
CREATE TABLE "ClosureReconciliation" (
    "id" TEXT NOT NULL,
    "electionId" TEXT NOT NULL,
    "electoralZoneId" TEXT,
    "code" TEXT NOT NULL,
    "status" "ClosureReconciliationStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "closureReason" TEXT,
    "assetsUnreturned" INTEGER NOT NULL DEFAULT 0,
    "deliveriesPending" INTEGER NOT NULL DEFAULT 0,
    "dispatchesOpen" INTEGER NOT NULL DEFAULT 0,
    "evidenceMissing" INTEGER NOT NULL DEFAULT 0,
    "exceptionsOpen" INTEGER NOT NULL DEFAULT 0,
    "exceptionsAccepted" INTEGER NOT NULL DEFAULT 0,
    "exceptionsExpired" INTEGER NOT NULL DEFAULT 0,
    "blockingItems" INTEGER NOT NULL DEFAULT 0,
    "readinessScore" INTEGER NOT NULL DEFAULT 0,
    "lastRefreshedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" TEXT,
    "submittedById" TEXT,
    "approvedById" TEXT,
    "closedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosureReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosureReconciliationItem" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "category" "ClosureItemCategory" NOT NULL,
    "sourceType" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "referenceLabel" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "severity" "ClosureSeverity" NOT NULL DEFAULT 'MEDIUM',
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "status" "ClosureItemStatus" NOT NULL DEFAULT 'PENDING',
    "dueAt" TIMESTAMP(3),
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolutionNote" TEXT,
    "payload" JSONB,

    CONSTRAINT "ClosureReconciliationItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosureReconciliationException" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "itemId" TEXT,
    "category" "ClosureItemCategory" NOT NULL,
    "risk" "ClosureExceptionRisk" NOT NULL DEFAULT 'MEDIUM',
    "justification" TEXT NOT NULL,
    "mitigation" TEXT,
    "status" "ClosureExceptionStatus" NOT NULL DEFAULT 'REGISTERED',
    "validUntil" TIMESTAMP(3),
    "registeredById" TEXT NOT NULL,
    "registeredByName" TEXT,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedById" TEXT,
    "revokeReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClosureReconciliationException_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosureReconciliationSignoff" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "role" "ClosureSignoffRole" NOT NULL,
    "userId" TEXT NOT NULL,
    "userNameSnapshot" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "signedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosureReconciliationSignoff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClosureReconciliationHistory" (
    "id" TEXT NOT NULL,
    "reconciliationId" TEXT NOT NULL,
    "action" "ClosureHistoryAction" NOT NULL,
    "actorId" TEXT,
    "summary" TEXT NOT NULL,
    "fromStatus" "ClosureReconciliationStatus",
    "toStatus" "ClosureReconciliationStatus",
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClosureReconciliationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClosureReconciliation_code_key" ON "ClosureReconciliation"("code");

-- CreateIndex
CREATE INDEX "ClosureReconciliation_electionId_status_idx" ON "ClosureReconciliation"("electionId", "status");

-- CreateIndex
CREATE INDEX "ClosureReconciliation_electoralZoneId_status_idx" ON "ClosureReconciliation"("electoralZoneId", "status");

-- CreateIndex
CREATE INDEX "ClosureReconciliation_status_updatedAt_idx" ON "ClosureReconciliation"("status", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ClosureReconciliationItem_reconciliationId_category_sourceT_key" ON "ClosureReconciliationItem"("reconciliationId", "category", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "ClosureReconciliationItem_reconciliationId_status_blocking_idx" ON "ClosureReconciliationItem"("reconciliationId", "status", "blocking");

-- CreateIndex
CREATE INDEX "ClosureReconciliationItem_category_severity_idx" ON "ClosureReconciliationItem"("category", "severity");

-- CreateIndex
CREATE INDEX "ClosureReconciliationItem_status_lastSeenAt_idx" ON "ClosureReconciliationItem"("status", "lastSeenAt");

-- CreateIndex
CREATE INDEX "ClosureReconciliationException_reconciliationId_status_idx" ON "ClosureReconciliationException"("reconciliationId", "status");

-- CreateIndex
CREATE INDEX "ClosureReconciliationException_status_validUntil_idx" ON "ClosureReconciliationException"("status", "validUntil");

-- CreateIndex
CREATE INDEX "ClosureReconciliationException_itemId_idx" ON "ClosureReconciliationException"("itemId");

-- CreateIndex
CREATE UNIQUE INDEX "ClosureReconciliationSignoff_reconciliationId_role_userId_key" ON "ClosureReconciliationSignoff"("reconciliationId", "role", "userId");

-- CreateIndex
CREATE INDEX "ClosureReconciliationSignoff_reconciliationId_role_idx" ON "ClosureReconciliationSignoff"("reconciliationId", "role");

-- CreateIndex
CREATE INDEX "ClosureReconciliationHistory_reconciliationId_createdAt_idx" ON "ClosureReconciliationHistory"("reconciliationId", "createdAt");

-- CreateIndex
CREATE INDEX "ClosureReconciliationHistory_action_createdAt_idx" ON "ClosureReconciliationHistory"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "ClosureReconciliation" ADD CONSTRAINT "ClosureReconciliation_electionId_fkey" FOREIGN KEY ("electionId") REFERENCES "Election"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureReconciliation" ADD CONSTRAINT "ClosureReconciliation_electoralZoneId_fkey" FOREIGN KEY ("electoralZoneId") REFERENCES "ElectoralZone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureReconciliationItem" ADD CONSTRAINT "ClosureReconciliationItem_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ClosureReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureReconciliationException" ADD CONSTRAINT "ClosureReconciliationException_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ClosureReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureReconciliationException" ADD CONSTRAINT "ClosureReconciliationException_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ClosureReconciliationItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureReconciliationSignoff" ADD CONSTRAINT "ClosureReconciliationSignoff_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ClosureReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClosureReconciliationHistory" ADD CONSTRAINT "ClosureReconciliationHistory_reconciliationId_fkey" FOREIGN KEY ("reconciliationId") REFERENCES "ClosureReconciliation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
