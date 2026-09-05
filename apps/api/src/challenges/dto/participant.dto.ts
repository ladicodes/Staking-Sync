import { ApiProperty } from '@nestjs/swagger';
import { ChallengeParticipant, ParticipantStatus, User } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';

export class ParticipantDto {
  @ApiProperty() id: string;
  @ApiProperty() challengeId: string;
  @ApiProperty() userId: string;
  @ApiProperty() userName: string;
  @ApiProperty({ nullable: true }) userAvatarUrl: string | null;
  @ApiProperty() joinedAt: Date;
  @ApiProperty() currentStreak: number;
  @ApiProperty() longestStreak: number;
  @ApiProperty() missedDays: number;
  @ApiProperty() graceDaysUsed: number;
  @ApiProperty() stakeRemaining: number;
  @ApiProperty({ enum: ParticipantStatus }) status: ParticipantStatus;
}

type ParticipantWithUser = ChallengeParticipant & {
  user: Pick<User, 'firstName' | 'lastName' | 'avatarUrl'>;
  longestStreak?: number;
};

export function toParticipantDto(participant: ParticipantWithUser): ParticipantDto {
  return {
    id: participant.id,
    challengeId: participant.challengeId,
    userId: participant.userId,
    userName: `${participant.user.firstName} ${participant.user.lastName}`.trim(),
    userAvatarUrl: participant.user.avatarUrl,
    joinedAt: participant.joinedAt,
    currentStreak: participant.currentStreak,
    longestStreak: participant.longestStreak ?? participant.currentStreak,
    missedDays: participant.missedDays,
    graceDaysUsed: participant.graceDaysUsed,
    stakeRemaining: toNumber(participant.remainingStake),
    status: participant.status
  };
}
