import { ApiProperty } from '@nestjs/swagger';
import { Challenge, ChallengeCategory, ChallengeStatus, ChallengeVisibility, ProofType } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';

export class ChallengeDto {
  @ApiProperty() id: string;
  @ApiProperty() creatorId: string;
  @ApiProperty() title: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ enum: ChallengeCategory }) category: ChallengeCategory;
  @ApiProperty({ enum: ProofType }) proofType: ProofType;
  @ApiProperty({ enum: ChallengeVisibility }) visibility: ChallengeVisibility;
  @ApiProperty({ enum: ChallengeStatus }) status: ChallengeStatus;
  @ApiProperty() durationDays: number;
  @ApiProperty() graceDays: number;
  @ApiProperty() dailyPenaltyPercentage: number;
  @ApiProperty() stakeAmount: number;
  @ApiProperty() currency: string;
  @ApiProperty({ nullable: true }) startDate: Date | null;
  @ApiProperty({ nullable: true }) endDate: Date | null;
  @ApiProperty({ nullable: true }) maximumParticipants: number | null;
  @ApiProperty() participantCount: number;
  @ApiProperty() poolTotal: number;
  @ApiProperty() createdAt: Date;
}

type ChallengeWithCount = Challenge & {
  _count?: { participants: number };
  poolTotal?: number;
};

export function toChallengeDto(challenge: ChallengeWithCount): ChallengeDto {
  return {
    id: challenge.id,
    creatorId: challenge.creatorId,
    title: challenge.title,
    description: challenge.description,
    category: challenge.category,
    proofType: challenge.proofType,
    visibility: challenge.visibility,
    status: challenge.status,
    durationDays: challenge.durationDays,
    graceDays: challenge.graceDays,
    dailyPenaltyPercentage: toNumber(challenge.dailyPenaltyPercentage),
    stakeAmount: toNumber(challenge.stakeAmount),
    currency: challenge.currency,
    startDate: challenge.startDate,
    endDate: challenge.endDate,
    maximumParticipants: challenge.maximumParticipants,
    participantCount: challenge._count?.participants ?? 0,
    poolTotal: challenge.poolTotal ?? 0,
    createdAt: challenge.createdAt
  };
}
