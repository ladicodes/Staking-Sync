import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Partnership } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { toNumber } from '../common/utils/decimal.util';
import { toPartnershipDto } from './dto/partnership.dto';
import { PartnerDirectoryEntryDto } from './dto/directory-entry.dto';
import { MyPartnershipDto } from './dto/my-partnership.dto';

const DAILY_PENALTY = 5;

function startOfDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

@Injectable()
export class PartnersService {
  constructor(private readonly prisma: PrismaService) {}

  async listDirectory(userId: string): Promise<PartnerDirectoryEntryDto[]> {
    const involved = await this.prisma.partnership.findMany({
      where: { status: { not: 'ENDED' }, OR: [{ userAId: userId }, { userBId: userId }] },
      select: { userAId: true, userBId: true }
    });
    const involvedIds = new Set<string>([userId, ...involved.flatMap((p) => [p.userAId, p.userBId])]);

    const users = await this.prisma.user.findMany({
      where: { id: { notIn: Array.from(involvedIds) } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        participations: { where: { status: 'ACTIVE' }, select: { currentStreak: true } }
      }
    });

    return users.map((user) => ({
      userId: user.id,
      userName: `${user.firstName} ${user.lastName}`.trim(),
      userAvatarUrl: user.avatarUrl,
      currentStreak: user.participations.reduce((max, p) => Math.max(max, p.currentStreak), 0)
    }));
  }

  async getMyPartnership(userId: string): Promise<MyPartnershipDto | null> {
    const partnership = await this.prisma.partnership.findFirst({
      where: { status: { not: 'ENDED' }, OR: [{ userAId: userId }, { userBId: userId }] }
    });
    if (!partnership) return null;

    const settled = partnership.status === 'ACTIVE' ? await this.settle(partnership) : partnership;

    const side: 'A' | 'B' = settled.userAId === userId ? 'A' : 'B';
    const otherId = side === 'A' ? settled.userBId : settled.userAId;
    const otherUser = await this.prisma.user.findUnique({
      where: { id: otherId },
      select: { firstName: true, lastName: true, avatarUrl: true }
    });
    if (!otherUser) return null;

    const today = startOfDay(new Date());
    const [myCheckIn, otherCheckIn] = await Promise.all([
      this.prisma.partnerCheckIn.findUnique({
        where: { partnershipId_userId_checkInDate: { partnershipId: settled.id, userId, checkInDate: today } }
      }),
      this.prisma.partnerCheckIn.findUnique({
        where: { partnershipId_userId_checkInDate: { partnershipId: settled.id, userId: otherId, checkInDate: today } }
      })
    ]);

    return {
      partnership: toPartnershipDto(settled),
      otherUserId: otherId,
      otherUserName: `${otherUser.firstName} ${otherUser.lastName}`.trim(),
      otherUserAvatarUrl: otherUser.avatarUrl,
      mySide: side,
      myStakeRemaining: toNumber(side === 'A' ? settled.stakeRemainingA : settled.stakeRemainingB),
      otherStakeRemaining: toNumber(side === 'A' ? settled.stakeRemainingB : settled.stakeRemainingA),
      isRequester: settled.requestedById === userId,
      myCheckedInToday: myCheckIn?.status === 'COMPLETED',
      otherCheckedInToday: otherCheckIn?.status === 'COMPLETED'
    };
  }

  async sendRequest(fromUserId: string, toUserId: string, stakeAmount: number) {
    if (fromUserId === toUserId) throw new BadRequestException("You can't partner with yourself");

    const existing = await this.prisma.partnership.findFirst({
      where: { status: { not: 'ENDED' }, OR: [{ userAId: fromUserId }, { userBId: fromUserId }] }
    });
    if (existing) throw new ConflictException('You already have a partner request in progress');

    const wallet = await this.prisma.wallet.findUnique({ where: { userId_currency: { userId: fromUserId, currency: 'USD' } } });
    if (!wallet || toNumber(wallet.availableBalance) < stakeAmount) {
      throw new ForbiddenException('Not enough available balance to offer this stake');
    }

    const today = startOfDay(new Date());
    const partnership = await this.prisma.partnership.create({
      data: {
        userAId: fromUserId,
        userBId: toUserId,
        requestedById: fromUserId,
        status: 'PENDING',
        stakeAmount,
        stakeRemainingA: stakeAmount,
        stakeRemainingB: stakeAmount,
        settledThroughDate: today
      }
    });

    return toPartnershipDto(partnership);
  }

  async respondToRequest(partnershipId: string, userId: string, accept: boolean) {
    const partnership = await this.prisma.partnership.findUnique({ where: { id: partnershipId } });
    if (!partnership) throw new NotFoundException('Request not found');
    if (partnership.requestedById === userId) {
      throw new ForbiddenException("You can't respond to your own request");
    }
    if (partnership.status !== 'PENDING') {
      throw new BadRequestException('This request is no longer pending');
    }

    if (!accept) {
      const ended = await this.prisma.partnership.update({
        where: { id: partnershipId },
        data: { status: 'ENDED', endedAt: new Date() }
      });
      return toPartnershipDto(ended);
    }

    const stakeAmount = toNumber(partnership.stakeAmount);
    const updated = await this.prisma.$transaction(async (tx) => {
      for (const uid of [partnership.userAId, partnership.userBId]) {
        const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: uid, currency: 'USD' } } });
        if (!wallet || toNumber(wallet.availableBalance) < stakeAmount) {
          throw new ForbiddenException('Both of you need enough available balance to stake');
        }
      }

      for (const uid of [partnership.userAId, partnership.userBId]) {
        const wallet = await tx.wallet.findUniqueOrThrow({ where: { userId_currency: { userId: uid, currency: 'USD' } } });
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { availableBalance: { decrement: stakeAmount }, lockedBalance: { increment: stakeAmount } }
        });
        await tx.ledgerTransaction.create({
          data: {
            walletId: wallet.id,
            userId: uid,
            type: 'STAKE_LOCK',
            amount: stakeAmount,
            currency: wallet.currency,
            status: 'COMPLETED',
            description: 'Accountability partner stake',
            idempotencyKey: `partner-stake:${partnershipId}:${uid}`
          }
        });
      }

      return tx.partnership.update({
        where: { id: partnershipId },
        data: { status: 'ACTIVE', respondedAt: new Date(), settledThroughDate: startOfDay(new Date()) }
      });
    });

    return toPartnershipDto(updated);
  }

  async cancelRequest(partnershipId: string, userId: string): Promise<void> {
    const partnership = await this.prisma.partnership.findUnique({ where: { id: partnershipId } });
    if (!partnership) return;
    if (partnership.requestedById !== userId) throw new ForbiddenException('Only the requester can cancel this');

    await this.prisma.partnership.update({
      where: { id: partnershipId },
      data: { status: 'ENDED', endedAt: new Date() }
    });
  }

  async submitCheckIn(partnershipId: string, userId: string): Promise<void> {
    const partnership = await this.prisma.partnership.findUnique({ where: { id: partnershipId } });
    if (!partnership || partnership.status !== 'ACTIVE') throw new BadRequestException('No active partnership');
    if (partnership.userAId !== userId && partnership.userBId !== userId) {
      throw new ForbiddenException("You're not part of this partnership");
    }

    await this.settle(partnership);

    const today = startOfDay(new Date());
    await this.prisma.partnerCheckIn.upsert({
      where: { partnershipId_userId_checkInDate: { partnershipId, userId, checkInDate: today } },
      create: { partnershipId, userId, checkInDate: today, status: 'COMPLETED' },
      update: { status: 'COMPLETED' }
    });
  }

  async getTodayCheckIn(partnershipId: string, userId: string) {
    const today = startOfDay(new Date());
    return this.prisma.partnerCheckIn.findUnique({
      where: { partnershipId_userId_checkInDate: { partnershipId, userId, checkInDate: today } }
    });
  }

  async endPartnership(partnershipId: string, userId: string): Promise<void> {
    const partnership = await this.prisma.partnership.findUnique({ where: { id: partnershipId } });
    if (!partnership) throw new NotFoundException('Partnership not found');
    if (partnership.userAId !== userId && partnership.userBId !== userId) {
      throw new ForbiddenException("You're not part of this partnership");
    }

    const settled = await this.settle(partnership);

    await this.prisma.$transaction(async (tx) => {
      for (const side of ['A', 'B'] as const) {
        const uid = side === 'A' ? settled.userAId : settled.userBId;
        const remaining = toNumber(side === 'A' ? settled.stakeRemainingA : settled.stakeRemainingB);
        if (remaining <= 0) continue;

        const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: uid, currency: 'USD' } } });
        if (!wallet) continue;

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { increment: remaining },
            lockedBalance: { decrement: Math.min(remaining, toNumber(wallet.lockedBalance)) }
          }
        });
        await tx.ledgerTransaction.create({
          data: {
            walletId: wallet.id,
            userId: uid,
            type: 'REFUND',
            amount: remaining,
            currency: wallet.currency,
            status: 'COMPLETED',
            description: 'Partner stake returned',
            idempotencyKey: `partner-refund:${partnershipId}:${uid}`
          }
        });
      }

      await tx.partnership.update({
        where: { id: partnershipId },
        data: { status: 'ENDED', endedAt: new Date(), stakeRemainingA: 0, stakeRemainingB: 0 }
      });
    });
  }

  // Walks forward from the last-settled day to yesterday, moving a fixed
  // penalty from anyone who didn't check in to their partner's wallet.
  // Runs on read (getMyPartnership, submitCheckIn, endPartnership) rather
  // than on a schedule, mirroring the mock backend's on-demand model.
  private async settle(partnership: Partnership): Promise<Partnership> {
    const today = startOfDay(new Date());
    let cursor = startOfDay(partnership.settledThroughDate);
    if (cursor >= today) return partnership;

    return this.prisma.$transaction(async (tx) => {
      let current = partnership;
      while (cursor < today) {
        cursor = addDays(cursor, 1);
        if (cursor >= today) break;

        for (const side of ['A', 'B'] as const) {
          const userId = side === 'A' ? current.userAId : current.userBId;
          const otherId = side === 'A' ? current.userBId : current.userAId;
          const remaining = toNumber(side === 'A' ? current.stakeRemainingA : current.stakeRemainingB);
          if (remaining <= 0) continue;

          const checkIn = await tx.partnerCheckIn.findUnique({
            where: { partnershipId_userId_checkInDate: { partnershipId: current.id, userId, checkInDate: cursor } }
          });
          if (checkIn?.status === 'COMPLETED') continue;

          const penalty = Math.min(DAILY_PENALTY, remaining);
          current = await tx.partnership.update({
            where: { id: current.id },
            data: side === 'A' ? { stakeRemainingA: { decrement: penalty } } : { stakeRemainingB: { decrement: penalty } }
          });

          const missedWallet = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } });
          if (missedWallet) {
            await tx.wallet.update({
              where: { id: missedWallet.id },
              data: { lockedBalance: { decrement: Math.min(penalty, toNumber(missedWallet.lockedBalance)) } }
            });
            await tx.ledgerTransaction.create({
              data: {
                walletId: missedWallet.id,
                userId,
                type: 'PENALTY',
                amount: penalty,
                currency: missedWallet.currency,
                status: 'COMPLETED',
                description: 'Missed accountability check-in',
                idempotencyKey: `partner-penalty:${current.id}:${userId}:${cursor.toISOString()}`
              }
            });
          }

          const partnerWallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: otherId, currency: 'USD' } } });
          if (partnerWallet) {
            await tx.wallet.update({
              where: { id: partnerWallet.id },
              data: { availableBalance: { increment: penalty } }
            });
            await tx.ledgerTransaction.create({
              data: {
                walletId: partnerWallet.id,
                userId: otherId,
                type: 'REWARD',
                amount: penalty,
                currency: partnerWallet.currency,
                status: 'COMPLETED',
                description: 'Partner penalty · accountability partner missed a day',
                idempotencyKey: `partner-reward:${current.id}:${otherId}:${cursor.toISOString()}`
              }
            });
          }
        }
      }

      return tx.partnership.update({ where: { id: current.id }, data: { settledThroughDate: today } });
    });
  }
}
