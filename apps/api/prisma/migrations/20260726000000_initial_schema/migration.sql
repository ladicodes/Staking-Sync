CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED');
CREATE TYPE "ChallengeStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ChallengeVisibility" AS ENUM ('PRIVATE', 'INVITE_ONLY', 'PUBLIC');
CREATE TYPE "ChallengeCategory" AS ENUM ('FITNESS', 'LEARNING', 'WELLNESS', 'FINANCE', 'PRODUCTIVITY', 'OTHER');
CREATE TYPE "ProofType" AS ENUM ('PHOTO', 'TEXT', 'LINK', 'MANUAL');
CREATE TYPE "ParticipantStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'WITHDRAWN');
CREATE TYPE "VerificationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'NEEDS_REVIEW');
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'STAKE_LOCK', 'PENALTY', 'REWARD', 'REFUND', 'WITHDRAWAL', 'ADJUSTMENT');
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'FAILED', 'REVERSED');
CREATE TYPE "NotificationType" AS ENUM ('AUTH', 'CHALLENGE', 'CHECK_IN', 'PAYMENT', 'SYSTEM');

CREATE TABLE "User" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "firstName" VARCHAR(100) NOT NULL,
  "lastName" VARCHAR(100) NOT NULL,
  "username" VARCHAR(50),
  "email" VARCHAR(255) NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "avatarUrl" TEXT,
  "countryCode" VARCHAR(2),
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'UTC',
  "isAnonymous" BOOLEAN NOT NULL DEFAULT false,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Wallet" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "availableBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "lockedBalance" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Challenge" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "creatorId" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "category" "ChallengeCategory" NOT NULL,
  "proofType" "ProofType" NOT NULL,
  "durationDays" INTEGER NOT NULL,
  "graceDays" INTEGER NOT NULL DEFAULT 0,
  "dailyPenaltyPercentage" DECIMAL(5,2) NOT NULL,
  "stakeAmount" DECIMAL(18,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "visibility" "ChallengeVisibility" NOT NULL DEFAULT 'PRIVATE',
  "status" "ChallengeStatus" NOT NULL DEFAULT 'DRAFT',
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "maximumParticipants" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ChallengeParticipant" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "challengeId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "initialStake" DECIMAL(18,2) NOT NULL,
  "remainingStake" DECIMAL(18,2) NOT NULL,
  "totalPenalty" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "currentStreak" INTEGER NOT NULL DEFAULT 0,
  "missedDays" INTEGER NOT NULL DEFAULT 0,
  "graceDaysUsed" INTEGER NOT NULL DEFAULT 0,
  "status" "ParticipantStatus" NOT NULL DEFAULT 'ACTIVE',
  "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChallengeParticipant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckIn" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "participantId" UUID NOT NULL,
  "challengeDate" TIMESTAMP(3) NOT NULL,
  "proofUrl" TEXT,
  "proofText" TEXT,
  "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
  "verificationConfidence" DECIMAL(5,4),
  "verificationReason" TEXT,
  "submittedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LedgerTransaction" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "walletId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "challengeId" UUID,
  "type" "TransactionType" NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL,
  "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
  "reference" VARCHAR(120),
  "idempotencyKey" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LedgerTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL,
  "type" "NotificationType" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "message" TEXT NOT NULL,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_status_idx" ON "User"("status");
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX "RefreshToken_expiresAt_idx" ON "RefreshToken"("expiresAt");
CREATE INDEX "RefreshToken_revokedAt_idx" ON "RefreshToken"("revokedAt");
CREATE UNIQUE INDEX "Wallet_userId_currency_key" ON "Wallet"("userId", "currency");
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");
CREATE INDEX "Challenge_creatorId_idx" ON "Challenge"("creatorId");
CREATE INDEX "Challenge_status_idx" ON "Challenge"("status");
CREATE INDEX "Challenge_visibility_idx" ON "Challenge"("visibility");
CREATE INDEX "Challenge_startDate_idx" ON "Challenge"("startDate");
CREATE UNIQUE INDEX "ChallengeParticipant_challengeId_userId_key" ON "ChallengeParticipant"("challengeId", "userId");
CREATE INDEX "ChallengeParticipant_userId_idx" ON "ChallengeParticipant"("userId");
CREATE INDEX "ChallengeParticipant_status_idx" ON "ChallengeParticipant"("status");
CREATE UNIQUE INDEX "CheckIn_participantId_challengeDate_key" ON "CheckIn"("participantId", "challengeDate");
CREATE INDEX "CheckIn_verificationStatus_idx" ON "CheckIn"("verificationStatus");
CREATE INDEX "CheckIn_challengeDate_idx" ON "CheckIn"("challengeDate");
CREATE UNIQUE INDEX "LedgerTransaction_idempotencyKey_key" ON "LedgerTransaction"("idempotencyKey");
CREATE INDEX "LedgerTransaction_walletId_idx" ON "LedgerTransaction"("walletId");
CREATE INDEX "LedgerTransaction_userId_idx" ON "LedgerTransaction"("userId");
CREATE INDEX "LedgerTransaction_challengeId_idx" ON "LedgerTransaction"("challengeId");
CREATE INDEX "LedgerTransaction_status_idx" ON "LedgerTransaction"("status");
CREATE INDEX "LedgerTransaction_createdAt_idx" ON "LedgerTransaction"("createdAt");
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeParticipant" ADD CONSTRAINT "ChallengeParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "ChallengeParticipant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "LedgerTransaction" ADD CONSTRAINT "LedgerTransaction_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
