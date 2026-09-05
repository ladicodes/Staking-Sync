import { ApiProperty } from '@nestjs/swagger';
import { Partnership, PartnershipStatus } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';

export class PartnershipDto {
  @ApiProperty() id: string;
  @ApiProperty() userAId: string;
  @ApiProperty() userBId: string;
  @ApiProperty() requestedById: string;
  @ApiProperty({ enum: PartnershipStatus }) status: PartnershipStatus;
  @ApiProperty() stakeAmount: number;
  @ApiProperty() stakeRemainingA: number;
  @ApiProperty() stakeRemainingB: number;
  @ApiProperty() settledThroughDate: Date;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ nullable: true }) respondedAt: Date | null;
  @ApiProperty({ nullable: true }) endedAt: Date | null;
}

export function toPartnershipDto(partnership: Partnership): PartnershipDto {
  return {
    id: partnership.id,
    userAId: partnership.userAId,
    userBId: partnership.userBId,
    requestedById: partnership.requestedById,
    status: partnership.status,
    stakeAmount: toNumber(partnership.stakeAmount),
    stakeRemainingA: toNumber(partnership.stakeRemainingA),
    stakeRemainingB: toNumber(partnership.stakeRemainingB),
    settledThroughDate: partnership.settledThroughDate,
    createdAt: partnership.createdAt,
    respondedAt: partnership.respondedAt,
    endedAt: partnership.endedAt
  };
}
