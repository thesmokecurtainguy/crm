-- CreateEnum
CREATE TYPE "ProjectStage" AS ENUM ('UNKNOWN', 'PRE_DESIGN', 'SCHEMATIC_DESIGN', 'DESIGN_DEVELOPMENT', 'CONSTRUCTION_DOCUMENTS', 'BIDDING', 'UNDER_CONSTRUCTION', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('LEAD', 'WATCH', 'QUALIFIED');

-- CreateEnum
CREATE TYPE "CompetitorConfidence" AS ENUM ('RUMOR', 'SECONDHAND', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('PRICED_TOO_HIGH', 'COMPETITOR_SPECIFIED', 'DISTRIBUTOR_WENT_ELSEWHERE', 'PROJECT_DIED', 'NO_DECISION');

-- AlterTable
ALTER TABLE "deal" ADD COLUMN     "projectId" TEXT;

-- CreateTable
CREATE TABLE "project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "source" "RecordSource" NOT NULL DEFAULT 'MANUAL',
    "address" TEXT,
    "city" TEXT,
    "stateCode" TEXT,
    "county" TEXT,
    "category" TEXT,
    "stage" "ProjectStage" NOT NULL DEFAULT 'UNKNOWN',
    "leadStatus" "LeadStatus" NOT NULL DEFAULT 'LEAD',
    "watchUntil" TIMESTAMP(3),
    "value" DECIMAL(14,2),
    "floors" INTEGER,
    "units" INTEGER,
    "floorArea" INTEGER,
    "startDate" TIMESTAMP(3),
    "bidDate" TIMESTAMP(3),
    "architectId" TEXT,
    "gcId" TEXT,
    "developerId" TEXT,
    "ownerId" TEXT,
    "description" TEXT,
    "lastUpdateReason" TEXT,
    "lastUpdateAt" TIMESTAMP(3),
    "competitor" TEXT,
    "competitorPricing" TEXT,
    "competitorConfidence" "CompetitorConfidence",
    "lostReason" "LostReason",
    "closedAt" TIMESTAMP(3),
    "lastActivityAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_externalId_key" ON "project"("externalId");

-- CreateIndex
CREATE INDEX "project_architectId_idx" ON "project"("architectId");

-- CreateIndex
CREATE INDEX "project_gcId_idx" ON "project"("gcId");

-- CreateIndex
CREATE INDEX "project_developerId_idx" ON "project"("developerId");

-- CreateIndex
CREATE INDEX "project_ownerId_idx" ON "project"("ownerId");

-- CreateIndex
CREATE INDEX "project_stage_idx" ON "project"("stage");

-- CreateIndex
CREATE INDEX "project_leadStatus_idx" ON "project"("leadStatus");

-- CreateIndex
CREATE INDEX "project_stateCode_idx" ON "project"("stateCode");

-- CreateIndex
CREATE INDEX "project_bidDate_idx" ON "project"("bidDate");

-- CreateIndex
CREATE INDEX "project_archivedAt_idx" ON "project"("archivedAt");

-- CreateIndex
CREATE INDEX "deal_projectId_idx" ON "deal"("projectId");

-- AddForeignKey
ALTER TABLE "deal" ADD CONSTRAINT "deal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_architectId_fkey" FOREIGN KEY ("architectId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_gcId_fkey" FOREIGN KEY ("gcId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
