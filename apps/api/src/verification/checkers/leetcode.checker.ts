import { Injectable, Logger } from '@nestjs/common';
import { ProofType } from '@prisma/client';
import { ProofChecker, VerificationInput, VerificationResult } from '../verification.types';

const LEETCODE_GRAPHQL_URL = 'https://leetcode.com/graphql';

const CALENDAR_QUERY = `
  query userProfileCalendar($username: String!, $year: Int) {
    matchedUser(username: $username) {
      userCalendar(year: $year) {
        submissionCalendar
      }
    }
  }
`;

interface LeetCodeCalendarResponse {
  data?: {
    matchedUser: {
      userCalendar: {
        submissionCalendar: string;
      };
    } | null;
  };
  errors?: { message: string }[];
}

/**
 * Verifies a check-in against LeetCode's public (unauthenticated) GraphQL
 * API by checking whether the linked username has any accepted submission
 * recorded for the given day's UTC midnight timestamp.
 */
@Injectable()
export class LeetCodeChecker implements ProofChecker {
  readonly proofType = ProofType.LEETCODE;
  private readonly logger = new Logger(LeetCodeChecker.name);

  async check(input: VerificationInput): Promise<VerificationResult> {
    const username = input.user.leetcodeUsername;
    if (!username) {
      return {
        verified: false,
        reason: 'No LeetCode username is linked to your profile. Add one in your profile settings.'
      };
    }

    const dayTimestamp = Math.floor(input.challengeDate.getTime() / 1000);
    const year = input.challengeDate.getUTCFullYear();

    let payload: LeetCodeCalendarResponse;
    try {
      const response = await fetch(LEETCODE_GRAPHQL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: CALENDAR_QUERY, variables: { username, year } }),
        signal: AbortSignal.timeout(8000)
      });
      if (!response.ok) {
        throw new Error(`LeetCode API responded with ${response.status}`);
      }
      payload = (await response.json()) as LeetCodeCalendarResponse;
    } catch (error) {
      this.logger.warn(`LeetCode verification lookup failed for ${username}: ${(error as Error).message}`);
      return { verified: null, reason: 'Could not reach LeetCode to verify this check-in; sent for manual review.' };
    }

    const matchedUser = payload.data?.matchedUser;
    if (!matchedUser) {
      return { verified: false, reason: `No LeetCode user found for username "${username}".` };
    }

    const calendar = this.parseCalendar(matchedUser.userCalendar.submissionCalendar);
    const submissionsToday = this.submissionsOnDay(calendar, dayTimestamp);

    if (submissionsToday > 0) {
      return {
        verified: true,
        reason: `Verified via LeetCode: ${submissionsToday} submission(s) recorded today.`,
        confidence: 1
      };
    }

    return { verified: false, reason: 'No LeetCode submissions found for today yet.' };
  }

  private parseCalendar(raw: string): Record<string, number> {
    try {
      return JSON.parse(raw) as Record<string, number>;
    } catch {
      return {};
    }
  }

  // LeetCode buckets submissions by the UTC-midnight timestamp of each day,
  // so an exact key match is normally enough; scan neighboring keys to
  // absorb any off-by-one-day skew between our clock and theirs.
  private submissionsOnDay(calendar: Record<string, number>, dayTimestamp: number): number {
    const daySeconds = 86400;
    for (const offset of [0, -daySeconds, daySeconds]) {
      const count = calendar[String(dayTimestamp + offset)];
      if (count) return count;
    }
    return 0;
  }
}
