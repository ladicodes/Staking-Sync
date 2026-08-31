import { PrismaClient, ChallengeCategory, ChallengeStatus, ChallengeVisibility, ProofType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const passwordHash = await bcrypt.hash('DemoPassword123!', 12);

  const samuel = await prisma.user.upsert({
    where: { email: 'samuel@example.com' },
    update: {},
    create: {
      firstName: 'Samuel',
      lastName: 'Ladipo',
      email: 'samuel@example.com',
      passwordHash,
      wallets: {
        create: {
          currency: 'USD'
        }
      }
    }
  });

  await prisma.user.upsert({
    where: { email: 'amina@example.com' },
    update: {},
    create: {
      firstName: 'Amina',
      lastName: 'Okafor',
      email: 'amina@example.com',
      passwordHash,
      wallets: {
        create: {
          currency: 'USD'
        }
      }
    }
  });

  await prisma.challenge.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      creatorId: samuel.id,
      title: '30 Day Morning Run',
      description: 'Demo challenge for early StakeSync testing.',
      category: ChallengeCategory.FITNESS,
      proofType: ProofType.PHOTO,
      durationDays: 30,
      graceDays: 2,
      dailyPenaltyPercentage: '5.00',
      stakeAmount: '100.00',
      currency: 'USD',
      visibility: ChallengeVisibility.PUBLIC,
      status: ChallengeStatus.DRAFT,
      maximumParticipants: 20
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
