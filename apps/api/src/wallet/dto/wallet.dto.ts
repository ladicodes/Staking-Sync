import { ApiProperty } from '@nestjs/swagger';
import { Wallet } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';

export class WalletDto {
  @ApiProperty() userId: string;
  @ApiProperty() currency: string;
  @ApiProperty() availableBalance: number;
  @ApiProperty() lockedBalance: number;
  @ApiProperty() updatedAt: Date;
}

export function toWalletDto(wallet: Wallet): WalletDto {
  return {
    userId: wallet.userId,
    currency: wallet.currency,
    availableBalance: toNumber(wallet.availableBalance),
    lockedBalance: toNumber(wallet.lockedBalance),
    updatedAt: wallet.updatedAt
  };
}
