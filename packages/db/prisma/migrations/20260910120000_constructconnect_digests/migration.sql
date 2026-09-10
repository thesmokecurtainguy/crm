-- CreateTable
CREATE TABLE "constructConnectDigest" (
    "id" TEXT NOT NULL,
    "gmailMessageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT,
    "searchName" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "projectsFound" INTEGER NOT NULL DEFAULT 0,
    "projectsCreated" INTEGER NOT NULL DEFAULT 0,
    "projectsUpdated" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "constructConnectDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "constructConnectDigest_gmailMessageId_key" ON "constructConnectDigest"("gmailMessageId");

-- CreateIndex
CREATE INDEX "constructConnectDigest_userId_receivedAt_idx" ON "constructConnectDigest"("userId", "receivedAt");
