import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { toNumber } from '../common/utils/decimal.util';
import { LeaderboardEntryDto } from './dto/leaderboard-entry.dto';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getLeaderboard(): Promise<LeaderboardEntryDto[]> {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        transactions: { where: { type: 'REWARD', status: 'COMPLETED' }, select: { amount: true } },
        participations: { select: { status: true, currentStreak: true } }
      }
    });

    const rows = users.map((user) => {
      const totalEarned = user.transactions.reduce((sum, t) => sum + toNumber(t.amount), 0);
      const currentStreak = user.participations.reduce(
        (max, p) => (p.status === 'ACTIVE' ? Math.max(max, p.currentStreak) : max),
        0
      );
      const challengesCompleted = user.participations.filter((p) => p.status === 'COMPLETED').length;
      return {
        userId: user.id,
        userName: `${user.firstName} ${user.lastName}`.trim(),
        userAvatarUrl: user.avatarUrl,
        totalEarned,
        currentStreak,
        challengesCompleted
      };
    });

    return rows
      .sort((a, b) => b.totalEarned - a.totalEarned || b.currentStreak - a.currentStreak)
      .map((row, index) => ({ rank: index + 1, ...row }));
  }
}
