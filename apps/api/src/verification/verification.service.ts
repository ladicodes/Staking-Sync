import { Injectable } from '@nestjs/common';
import { ProofType } from '@prisma/client';
import { LeetCodeChecker } from './checkers/leetcode.checker';
import { ProofChecker, VerificationInput, VerificationResult } from './verification.types';

/**
 * Dispatches check-in verification to the checker registered for a
 * challenge's proof type. Proof types with no automated checker (PHOTO,
 * TEXT, LINK, MANUAL) fall through to manual review — that's where a
 * future fitness-tracker checker (Strava/Google Fit) would register once
 * its OAuth flow exists, without any change to callers of this service.
 */
@Injectable()
export class VerificationService {
  private readonly checkers: Map<ProofType, ProofChecker>;

  constructor(leetCodeChecker: LeetCodeChecker) {
    this.checkers = new Map<ProofType, ProofChecker>([[leetCodeChecker.proofType, leetCodeChecker]]);
  }

  async verify(proofType: ProofType, input: VerificationInput): Promise<VerificationResult> {
    const checker = this.checkers.get(proofType);
    if (!checker) {
      return { verified: null, reason: 'This challenge requires manual proof review.' };
    }
    return checker.check(input);
  }
}
