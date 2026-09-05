import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { VerificationStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { ParticipantDto, toParticipantDto } from '../challenges/dto/participant.dto';
import { VerificationService } from '../verification/verification.service';
import { CheckInDto, toCheckInDto } from './dto/checkin.dto';
import { SubmitCheckInDto } from './dto/submit-checkin.dto';

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

const participantInclude = {
  user: { select: { firstName: true, lastName: true, avatarUrl: true } }
} as const;

@Injectable()
export class CheckInsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly verificationService: VerificationService
  ) {}

  async listForParticipant(participantId: string): Promise<CheckInDto[]> {
    const checkIns = await this.prisma.checkIn.findMany({
      where: { participantId },
      orderBy: { challengeDate: 'desc' }
    });
    return checkIns.map(toCheckInDto);
  }

  async getToday(participantId: string): Promise<CheckInDto | null> {
    const checkIn = await this.prisma.checkIn.findUnique({
      where: { participantId_challengeDate: { participantId, challengeDate: startOfToday() } }
    });
    return checkIn ? toCheckInDto(checkIn) : null;
  }

  async submit(dto: SubmitCheckInDto, userId: string): Promise<{ checkIn: CheckInDto; participation: ParticipantDto }> {
    const participation = await this.prisma.challengeParticipant.findUnique({
      where: { id: dto.participantId },
      include: { ...participantInclude, challenge: { select: { proofType: true } } }
    });
    if (!participation) throw new NotFoundException('Participation not found');
    if (participation.userId !== userId) {
      throw new ForbiddenException("This isn't your participation to check in for");
    }

    const today = startOfToday();
    const existing = await this.prisma.checkIn.findUnique({
      where: { participantId_challengeDate: { participantId: dto.participantId, challengeDate: today } }
    });
    if (existing && existing.verificationStatus === 'APPROVED') {
      throw new BadRequestException('Already checked in today');
    }

    const fullUser = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const result = await this.verificationService.verify(participation.challenge.proofType, {
      user: fullUser,
      proofText: dto.proofText,
      proofUrl: dto.proofUrl,
      challengeDate: today
    });

    if (result.verified === false) {
      throw new BadRequestException(result.reason);
    }

    const verificationStatus: VerificationStatus = result.verified === true ? 'APPROVED' : 'NEEDS_REVIEW';

    const [checkIn, updatedParticipation] = await this.prisma.$transaction(async (tx) => {
      const savedCheckIn = await tx.checkIn.upsert({
        where: { participantId_challengeDate: { participantId: dto.participantId, challengeDate: today } },
        create: {
          participantId: dto.participantId,
          challengeDate: today,
          proofText: dto.proofText,
          proofUrl: dto.proofUrl,
          verificationStatus,
          verificationReason: result.reason,
          verificationConfidence: result.confidence,
          submittedAt: new Date(),
          verifiedAt: verificationStatus === 'APPROVED' ? new Date() : null
        },
        update: {
          proofText: dto.proofText,
          proofUrl: dto.proofUrl,
          verificationStatus,
          verificationReason: result.reason,
          verificationConfidence: result.confidence,
          submittedAt: new Date(),
          verifiedAt: verificationStatus === 'APPROVED' ? new Date() : null
        }
      });

      const savedParticipation = await tx.challengeParticipant.update({
        where: { id: dto.participantId },
        data: verificationStatus === 'APPROVED' ? { currentStreak: { increment: 1 } } : {},
        include: participantInclude
      });

      return [savedCheckIn, savedParticipation] as const;
    });

    return {
      checkIn: toCheckInDto(checkIn),
      participation: toParticipantDto(updatedParticipation)
    };
  }
}
