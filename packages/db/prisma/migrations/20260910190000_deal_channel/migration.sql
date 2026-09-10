-- CreateEnum
CREATE TYPE "QuoteChannel" AS ENUM ('DIRECT', 'DISTRIBUTOR');

-- AlterTable
ALTER TABLE "deal" ADD COLUMN     "channel" "QuoteChannel";
