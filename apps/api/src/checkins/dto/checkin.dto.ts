import { ApiProperty } from '@nestjs/swagger';
import { CheckIn, User, VerificationStatus } from '@prisma/client';

export class CheckInDto {
  @ApiProperty() id: string;
  @ApiProperty() participantId: string;
  @ApiProperty() challengeDate: Date;
  @ApiProperty({ enum: VerificationStatus }) verificationStatus: VerificationStatus;
  @ApiProperty({ nullable: true }) verificationReason: string | null;
  @ApiProperty({ nullable: true }) proofUrl: string | null;
  @ApiProperty({ nullable: true }) proofText: string | null;
  @ApiProperty({ nullable: true }) submittedAt: Date | null;
}

export class PendingCheckInDto extends CheckInDto {
  @ApiProperty() userName: string;
}

export function toCheckInDto(checkIn: CheckIn): CheckInDto {
  return {
    id: checkIn.id,
    participantId: checkIn.participantId,
    challengeDate: checkIn.challengeDate,
    verificationStatus: checkIn.verificationStatus,
    verificationReason: checkIn.verificationReason,
    proofUrl: checkIn.proofUrl,
    proofText: checkIn.proofText,
    submittedAt: checkIn.submittedAt
  };
}

type CheckInWithParticipantUser = CheckIn & { participant: { user: Pick<User, 'firstName' | 'lastName'> } };

export function toPendingCheckInDto(checkIn: CheckInWithParticipantUser): PendingCheckInDto {
  return {
    ...toCheckInDto(checkIn),
    userName: `${checkIn.participant.user.firstName} ${checkIn.participant.user.lastName}`.trim()
  };
}
