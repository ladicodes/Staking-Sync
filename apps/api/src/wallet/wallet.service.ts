import { randomUUID } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { toNumber } from '../common/utils/decimal.util';
import { toWalletDto, WalletDto } from './dto/wallet.dto';
import { toTransactionDto, TransactionDto } from './dto/transaction.dto';

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService) {}

  async getWallet(userId: string): Promise<WalletDto> {
    const wallet = await this.getOrThrow(userId);
    return toWalletDto(wallet);
  }

  async listTransactions(userId: string): Promise<TransactionDto[]> {
    const transactions = await this.prisma.ledgerTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return transactions.map(toTransactionDto);
  }

  async deposit(userId: string, amount: number): Promise<WalletDto> {
    const wallet = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } });
      if (!existing) throw new NotFoundException('Wallet not found');

      const updated = await tx.wallet.update({
        where: { id: existing.id },
        data: { availableBalance: { increment: amount } }
      });

      await tx.ledgerTransaction.create({
        data: {
          walletId: existing.id,
          userId,
          type: 'DEPOSIT',
          amount,
          currency: existing.currency,
          status: 'COMPLETED',
          description: 'Wallet top-up',
          idempotencyKey: `deposit:${randomUUID()}`
        }
      });

      return updated;
    });

    return toWalletDto(wallet);
  }

  async withdraw(userId: string, amount: number): Promise<WalletDto> {
    const wallet = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } });
      if (!existing) throw new NotFoundException('Wallet not found');
      if (amount > toNumber(existing.availableBalance)) {
        throw new BadRequestException('Withdrawal exceeds your available balance');
      }

      const updated = await tx.wallet.update({
        where: { id: existing.id },
        data: { availableBalance: { decrement: amount } }
      });

      await tx.ledgerTransaction.create({
        data: {
          walletId: existing.id,
          userId,
          type: 'WITHDRAWAL',
          amount,
          currency: existing.currency,
          status: 'COMPLETED',
          description: 'Withdrawal to bank',
          idempotencyKey: `withdrawal:${randomUUID()}`
        }
      });

      return updated;
    });

    return toWalletDto(wallet);
  }

  private async getOrThrow(userId: string) {
    const wallet = await this.prisma.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    return wallet;
  }
}
