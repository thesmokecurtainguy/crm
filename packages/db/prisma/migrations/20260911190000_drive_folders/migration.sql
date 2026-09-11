-- AlterTable
ALTER TABLE "project" ADD COLUMN     "driveFolderId" TEXT,
ADD COLUMN     "driveFolderUrl" TEXT;

-- AlterTable
ALTER TABLE "company" ADD COLUMN     "driveFolderId" TEXT,
ADD COLUMN     "driveFolderUrl" TEXT;
