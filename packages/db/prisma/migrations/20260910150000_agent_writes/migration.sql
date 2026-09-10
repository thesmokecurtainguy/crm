-- CreateEnum
CREATE TYPE "AgentWriteKind" AS ENUM ('DRAFT_EMAIL', 'CREATE_EVENT', 'MOVE_EVENT', 'TODO');

-- CreateEnum
CREATE TYPE "AgentWriteStatus" AS ENUM ('DONE', 'FAILED', 'COMPLETED_BY_USER');

-- AlterTable
ALTER TABLE "appSetting" ADD COLUMN     "agentCalendarId" TEXT;

-- CreateTable
CREATE TABLE "agentWrite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AgentWriteKind" NOT NULL,
    "status" "AgentWriteStatus" NOT NULL DEFAULT 'DONE',
    "reason" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB,
    "externalId" TEXT,
    "externalUrl" TEXT,
    "contactId" TEXT,
    "companyId" TEXT,
    "projectId" TEXT,
    "dealId" TEXT,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agentWrite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "agentWrite_userId_createdAt_idx" ON "agentWrite"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "agentWrite_kind_createdAt_idx" ON "agentWrite"("kind", "createdAt");

-- CreateIndex
CREATE INDEX "agentWrite_externalId_idx" ON "agentWrite"("externalId");

-- AddForeignKey
ALTER TABLE "agentWrite" ADD CONSTRAINT "agentWrite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentWrite" ADD CONSTRAINT "agentWrite_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentWrite" ADD CONSTRAINT "agentWrite_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentWrite" ADD CONSTRAINT "agentWrite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agentWrite" ADD CONSTRAINT "agentWrite_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "deal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
