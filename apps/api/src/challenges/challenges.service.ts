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
    const challenge = await this.prisma.challenge.findUnique({
      where: { id },
      include: { _count: { select: { participants: true } } }
    });
    if (!challenge) throw new NotFoundException('Challenge not found');

    const pools = await this.poolTotals([id]);
    return toChallengeDto({ ...challenge, poolTotal: pools.get(id) ?? 0 });
  }

  async getParticipants(challengeId: string): Promise<ParticipantDto[]> {
    await this.assertChallengeExists(challengeId);
    const participants = await this.prisma.challengeParticipant.findMany({
      where: { challengeId },
      include: participantInclude,
      orderBy: { currentStreak: 'desc' }
    });
    return participants.map(toParticipantDto);
  }

  async getMyParticipation(challengeId: string, userId: string): Promise<ParticipantDto | null> {
    const participant = await this.prisma.challengeParticipant.findUnique({
      where: { challengeId_userId: { challengeId, userId } },
      include: participantInclude
    });
    return participant ? toParticipantDto(participant) : null;
  }

  async getMyChallenges(userId: string): Promise<{ challenge: ChallengeDto; participation: ParticipantDto }[]> {
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

  private async assertChallengeExists(challengeId: string): Promise<void> {
    const exists = await this.prisma.challenge.findUnique({ where: { id: challengeId }, select: { id: true } });
    if (!exists) throw new NotFoundException('Challenge not found');
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
