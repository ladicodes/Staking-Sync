import { ApiProperty } from '@nestjs/swagger';
import { CheckIn, VerificationStatus } from '@prisma/client';

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
