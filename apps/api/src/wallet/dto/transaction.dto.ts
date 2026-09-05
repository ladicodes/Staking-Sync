import { ApiProperty } from '@nestjs/swagger';
import { LedgerTransaction, TransactionStatus, TransactionType } from '@prisma/client';
import { toNumber } from '../../common/utils/decimal.util';

export class TransactionDto {
  @ApiProperty() id: string;
  @ApiProperty() userId: string;
  @ApiProperty({ enum: TransactionType }) type: TransactionType;
  @ApiProperty() amount: number;
  @ApiProperty({ enum: TransactionStatus }) status: TransactionStatus;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty({ nullable: true }) challengeId: string | null;
  @ApiProperty() createdAt: Date;
}

// Ledger amounts are stored as unsigned magnitudes; debits are surfaced as
// negative numbers here so the frontend can render one signed feed.
const DEBIT_TYPES: TransactionType[] = ['STAKE_LOCK', 'PENALTY', 'WITHDRAWAL'];

export function toTransactionDto(tx: LedgerTransaction): TransactionDto {
  const magnitude = toNumber(tx.amount);
  const signed = DEBIT_TYPES.includes(tx.type) ? -Math.abs(magnitude) : Math.abs(magnitude);
  return {
    id: tx.id,
    userId: tx.userId,
    type: tx.type,
    amount: signed,
    status: tx.status,
    description: tx.description,
    challengeId: tx.challengeId,
    createdAt: tx.createdAt
  };
}
