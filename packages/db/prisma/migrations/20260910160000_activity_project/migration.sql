-- AlterTable
ALTER TABLE "activity" ADD COLUMN     "projectId" TEXT;

-- CreateIndex
CREATE INDEX "activity_projectId_createdAt_idx" ON "activity"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "activity" ADD CONSTRAINT "activity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
