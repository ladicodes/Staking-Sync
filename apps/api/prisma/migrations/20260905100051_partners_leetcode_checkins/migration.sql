-- CreateEnum
CREATE TYPE "PartnershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'ENDED');

-- CreateEnum
CREATE TYPE "PartnerCheckInStatus" AS ENUM ('COMPLETED', 'MISSED');

-- AlterEnum
ALTER TYPE "ProofType" ADD VALUE 'LEETCODE';

-- AlterTable
ALTER TABLE "Challenge" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChallengeParticipant" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CheckIn" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "LedgerTransaction" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Notification" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefreshToken" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "leetcodeUsername" VARCHAR(50),
ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Wallet" ALTER COLUMN "id" DROP DEFAULT;

-- CreateTable
CREATE TABLE "Partnership" (
    "id" UUID NOT NULL,
    "userAId" UUID NOT NULL,
    "userBId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "status" "PartnershipStatus" NOT NULL DEFAULT 'PENDING',
    "stakeAmount" DECIMAL(18,2) NOT NULL,
    "stakeRemainingA" DECIMAL(18,2) NOT NULL,
    "stakeRemainingB" DECIMAL(18,2) NOT NULL,
    "settledThroughDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Partnership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerCheckIn" (
    "id" UUID NOT NULL,
    "partnershipId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "status" "PartnerCheckInStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PartnerCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Partnership_userAId_idx" ON "Partnership"("userAId");

-- CreateIndex
CREATE INDEX "Partnership_userBId_idx" ON "Partnership"("userBId");

-- CreateIndex
CREATE INDEX "Partnership_status_idx" ON "Partnership"("status");

-- CreateIndex
CREATE INDEX "PartnerCheckIn_partnershipId_idx" ON "PartnerCheckIn"("partnershipId");

-- CreateIndex
CREATE INDEX "PartnerCheckIn_userId_idx" ON "PartnerCheckIn"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerCheckIn_partnershipId_userId_checkInDate_key" ON "PartnerCheckIn"("partnershipId", "userId", "checkInDate");

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Partnership" ADD CONSTRAINT "Partnership_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCheckIn" ADD CONSTRAINT "PartnerCheckIn_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "Partnership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerCheckIn" ADD CONSTRAINT "PartnerCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
