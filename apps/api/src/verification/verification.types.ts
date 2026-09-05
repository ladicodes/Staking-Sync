import { ProofType, User } from '@prisma/client';

export interface VerificationInput {
  user: User;
  proofText?: string;
  proofUrl?: string;
  /** UTC midnight for the day being checked in. */
  challengeDate: Date;
}

export interface VerificationResult {
  /** true = approved, false = rejected, null = defer to manual review. */
  verified: boolean | null;
  reason: string;
  confidence?: number;
}

export interface ProofChecker {
  readonly proofType: ProofType;
  check(input: VerificationInput): Promise<VerificationResult>;
}
