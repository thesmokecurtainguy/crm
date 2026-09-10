-- AlterTable
ALTER TABLE "agentConversation" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "agentConversation_projectId_lastMessageAt_idx" ON "agentConversation"("projectId", "lastMessageAt");

-- AddForeignKey
ALTER TABLE "agentConversation" ADD CONSTRAINT "agentConversation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
