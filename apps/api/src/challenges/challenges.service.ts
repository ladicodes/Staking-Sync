import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ChallengeStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { toNumber } from '../common/utils/decimal.util';
import { CreateChallengeDto } from './dto/create-challenge.dto';
import { ListChallengesQuery } from './dto/list-challenges.query';
import { ChallengeDto, toChallengeDto } from './dto/challenge.dto';
import { ParticipantDto, toParticipantDto } from './dto/participant.dto';

const participantInclude = {
  user: { select: { firstName: true, lastName: true, avatarUrl: true } }
} satisfies Prisma.ChallengeParticipantInclude;

@Injectable()
export class ChallengesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListChallengesQuery): Promise<ChallengeDto[]> {
    const where: Prisma.ChallengeWhereInput = {};
    if (query.visibility) where.visibility = query.visibility;
    if (query.status) where.status = query.status;
    if (query.search) where.title = { contains: query.search, mode: 'insensitive' };

    const challenges = await this.prisma.challenge.findMany({
      where,
      include: { _count: { select: { participants: true } } },
      orderBy: { createdAt: 'desc' }
    });

    const pools = await this.poolTotals(challenges.map((c) => c.id));
    return challenges.map((c) => toChallengeDto({ ...c, poolTotal: pools.get(c.id) ?? 0 }));
  }

  async getById(id: string): Promise<ChallengeDto> {
    let challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: { _count: { select: { participants: true } } }
    });
    if (!challenge) throw new NotFoundException('Challenge not found');

    if (this.isPastDue(challenge)) {
      await this.settleChallenge(id);
      challenge = await this.prisma.challenge.findUnique({
        where: { id },
        include: { _count: { select: { participants: true } } }
      });
      if (!challenge) throw new NotFoundException('Challenge not found');
    }

    const pools = await this.poolTotals([id]);
    return toChallengeDto({ ...challenge, poolTotal: pools.get(id) ?? 0 });
  }

  async getParticipants(challengeId: string): Promise<ParticipantDto[]> {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (this.isPastDue(challenge)) await this.settleChallenge(challengeId);

    const participants = await this.prisma.challengeParticipant.findMany({
      where: { challengeId },
      include: participantInclude,
      orderBy: { currentStreak: 'desc' }
    });
    return participants.map(toParticipantDto);
  }

  async getMyParticipation(challengeId: string, userId: string): Promise<ParticipantDto | null> {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (challenge && this.isPastDue(challenge)) await this.settleChallenge(challengeId);

    const participant = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
      include: participantInclude
    });
    return participant ? toParticipantDto(participant) : null;
  }

  async getMyChallenges(userId: string): Promise<{ challenge: ChallengeDto; participation: ParticipantDto }[]> {
    const mine = await this.prisma.challengeParticipant.findMany({
      where: { userId },
      select: { challengeId: true, challenge: { select: { status: true, endDate: true } } }
    });
    await Promise.all(
      mine.filter((p) => this.isPastDue(p.challenge)).map((p) => this.settleChallenge(p.challengeId))
    );

    const participations = await this.prisma.challengeParticipant.findMany({
      where: { userId },
      include: {
        ...participantInclude,
        challenge: { include: { _count: { select: { participants: true } } } }
      },
      orderBy: { joinedAt: 'desc' }
    });

    const pools = await this.poolTotals(participations.map((p) => p.challengeId));
    return participations.map((p) => ({
      participation: toParticipantDto(p),
      challenge: toChallengeDto({ ...p.challenge, poolTotal: pools.get(p.challengeId) ?? 0 })
    }));
  }

  async create(dto: CreateChallengeDto, ownerId: string): Promise<ChallengeDto> {
    const startDate = new Date(dto.startDate);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + dto.durationDays);
    const status = startDate.getTime() > Date.now() ? ChallengeStatus.SCHEDULED : ChallengeStatus.ACTIVE;

    const challenge = await this.prisma.$transaction(async (tx) => {
      const created = await tx.challenge.create({
        data: {
          creatorId: ownerId,
          title: dto.title.trim(),
          description: dto.description?.trim(),
          category: dto.category,
          proofType: dto.proofType,
          visibility: dto.visibility,
          status,
          durationDays: dto.durationDays,
          graceDays: dto.graceDays ?? 0,
          dailyPenaltyPercentage: dto.dailyPenaltyPercentage ?? 0,
          stakeAmount: dto.stakeAmount,
          startDate,
          endDate,
          maximumParticipants: dto.maximumParticipants
        }
      });

      await this.stakeIntoChallenge(tx, created.id, ownerId, toNumber(created.stakeAmount), created.title);
      await tx.challengeParticipant.create({
        data: {
          challengeId: created.id,
          userId: ownerId,
          initialStake: created.stakeAmount,
          remainingStake: created.stakeAmount
        }
      });
      return created;
    });

    return this.getById(challenge.id);
  }

  async join(challengeId: string, userId: string): Promise<ParticipantDto> {
    const challenge = await this.prisma.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) throw new NotFoundException('Challenge not found');
    if (challenge.status === ChallengeStatus.COMPLETED || challenge.status === ChallengeStatus.CANCELLED) {
      throw new BadRequestException('This challenge is no longer open to join');
    }

    const existing = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId } }
    });
    if (existing) throw new ConflictException("You've already joined this challenge");

    if (challenge.maximumParticipants) {
      const count = await this.prisma.challengeParticipant.count({ where: { challengeId } });
      if (count >= challenge.maximumParticipants) {
        throw new BadRequestException('This challenge is full');
      }
    }

    const participant = await this.prisma.$transaction(async (tx) => {
      await this.stakeIntoChallenge(tx, challengeId, userId, toNumber(challenge.stakeAmount), challenge.title);
      return tx.challengeParticipant.create({
        data: {
          challengeId,
          userId,
          initialStake: challenge.stakeAmount,
          remainingStake: challenge.stakeAmount
        },
        include: participantInclude
      });
    });

    return toParticipantDto(participant);
  }

  private async poolTotals(challengeIds: string[]): Promise<Map<string, number>> {
    if (challengeIds.length === 0) return new Map();
    const sums = await this.prisma.challengeParticipant.groupBy({
      by: ['challengeId'],
      where: { challengeId: { in: challengeIds } },
      _sum: { remainingStake: true }
    });
    return new Map(sums.map((s) => [s.challengeId, toNumber(s._sum.remainingStake)]));
  }

  private isPastDue(challenge: { status: ChallengeStatus; endDate: Date | null }): boolean {
    return challenge.status === ChallengeStatus.ACTIVE && challenge.endDate !== null && challenge.endDate <= new Date();
  }

  // Settles a challenge once its end date has passed: for each participant,
  // counts calendar days between their join date and the challenge's end
  // (capped at "today" is moot here since isPastDue already means end <=
  // now) with no APPROVED check-in as missed days. Missing more than
  // graceDays fails the participant and forfeits their remaining stake to
  // the pool; everyone else completes and splits that pool evenly on top
  // of getting their own remaining stake back. Runs on-demand on read,
  // the same pattern PartnersService.settle already uses for penalties.
  private async settleChallenge(challengeId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const challenge = await tx.challenge.findUnique({ where: { id: challengeId } });
      if (!challenge || challenge.status !== ChallengeStatus.ACTIVE) return;
      if (!challenge.endDate || challenge.endDate > new Date()) return;

      const participants = await tx.challengeParticipant.findMany({
        where: { challengeId, status: 'ACTIVE' },
        include: { checkIns: { where: { verificationStatus: 'APPROVED' }, select: { challengeDate: true } } }
      });

      const endDay = this.startOfDay(challenge.endDate);
      const outcomes: { participantId: string; userId: string; passed: boolean; missedDays: number }[] = [];

      for (const participant of participants) {
        const approvedDays = new Set(participant.checkIns.map((c) => this.startOfDay(c.challengeDate).getTime()));
        const joinDay = this.startOfDay(participant.joinedAt);
        let missedDays = 0;
        for (let day = joinDay; day <= endDay; day = this.addDays(day, 1)) {
          if (!approvedDays.has(day.getTime())) missedDays += 1;
        }
        outcomes.push({
          participantId: participant.id,
          userId: participant.userId,
          passed: missedDays <= challenge.graceDays,
          missedDays
        });
      }

      let forfeitedPool = 0;
      for (const outcome of outcomes) {
        const participant = participants.find((p) => p.id === outcome.participantId)!;
        const remaining = toNumber(participant.remainingStake);
        const graceDaysUsed = Math.min(outcome.missedDays, challenge.graceDays);

        if (!outcome.passed) {
          forfeitedPool += remaining;
          const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: outcome.userId, currency: 'USD' } } });
          if (wallet) {
            await tx.wallet.update({
              where: { id: wallet.id },
              data: { lockedBalance: { decrement: Math.min(remaining, toNumber(wallet.lockedBalance)) } }
            });
          }
        }

        await tx.challengeParticipant.update({
          where: { id: outcome.participantId },
          data: {
            status: outcome.passed ? 'COMPLETED' : 'FAILED',
            missedDays: outcome.missedDays,
            graceDaysUsed,
            completedAt: outcome.passed ? new Date() : null
          }
        });
      }

      const winners = outcomes.filter((o) => o.passed);
      const poolShare = winners.length > 0 ? forfeitedPool / winners.length : 0;

      for (const winner of winners) {
        const participant = participants.find((p) => p.id === winner.participantId)!;
        const remaining = toNumber(participant.remainingStake);
        const payout = remaining + poolShare;
        if (payout <= 0) continue;

        const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId: winner.userId, currency: 'USD' } } });
        if (!wallet) continue;

        await tx.wallet.update({
          where: { id: wallet.id },
          data: {
            availableBalance: { increment: payout },
            lockedBalance: { decrement: Math.min(remaining, toNumber(wallet.lockedBalance)) }
          }
        });

        await tx.ledgerTransaction.create({
          data: {
            walletId: wallet.id,
            userId: winner.userId,
            challengeId,
            type: 'REFUND',
            amount: remaining,
            currency: wallet.currency,
            status: 'COMPLETED',
            description: `Stake returned · ${challenge.title}`,
            idempotencyKey: `challenge-refund:${challengeId}:${winner.userId}`
          }
        });

        if (poolShare > 0) {
          await tx.ledgerTransaction.create({
            data: {
              walletId: wallet.id,
              userId: winner.userId,
              challengeId,
              type: 'REWARD',
              amount: poolShare,
              currency: wallet.currency,
              status: 'COMPLETED',
              description: `Reward share · ${challenge.title}`,
              idempotencyKey: `challenge-reward:${challengeId}:${winner.userId}`
            }
          });
        }
      }

      await tx.challenge.update({ where: { id: challengeId }, data: { status: ChallengeStatus.COMPLETED } });
    });
  }

  private startOfDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private async stakeIntoChallenge(
    tx: Prisma.TransactionClient,
    challengeId: string,
    userId: string,
    amount: number,
    challengeTitle: string
  ): Promise<void> {
    const wallet = await tx.wallet.findUnique({ where: { userId_currency: { userId, currency: 'USD' } } });
    if (!wallet) throw new NotFoundException('Wallet not found');
    if (toNumber(wallet.availableBalance) < amount) {
      throw new ForbiddenException('Not enough available balance to stake this challenge');
    }

    await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        availableBalance: { decrement: amount },
        lockedBalance: { increment: amount }
      }
    });

    await tx.ledgerTransaction.create({
      data: {
        walletId: wallet.id,
        userId,
        challengeId,
        type: 'STAKE_LOCK',
        amount,
        currency: wallet.currency,
        status: 'COMPLETED',
        description: `Staked · ${challengeTitle}`,
        idempotencyKey: `stake:${challengeId}:${userId}`
      }
    });
  }
}
