-- CreateTable
CREATE TABLE "projectParticipant" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "companyId" TEXT,
    "contactId" TEXT,
    "role" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projectParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projectParticipant_companyId_idx" ON "projectParticipant"("companyId");

-- CreateIndex
CREATE INDEX "projectParticipant_contactId_idx" ON "projectParticipant"("contactId");

-- CreateIndex
CREATE UNIQUE INDEX "projectParticipant_projectId_companyId_role_key" ON "projectParticipant"("projectId", "companyId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "projectParticipant_projectId_contactId_key" ON "projectParticipant"("projectId", "contactId");

-- AddForeignKey
ALTER TABLE "projectParticipant" ADD CONSTRAINT "projectParticipant_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectParticipant" ADD CONSTRAINT "projectParticipant_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projectParticipant" ADD CONSTRAINT "projectParticipant_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
