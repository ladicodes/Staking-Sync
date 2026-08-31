import { randomUUID } from 'crypto';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

interface RequestWithId extends Request {
  requestId?: string;
}

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule]
  }).compile();

  const app = moduleRef.createNestApplication();
  app.use(helmet());
  app.enableCors({ origin: true, credentials: true });
  app.use((req: RequestWithId, res: Response, next: NextFunction) => {
    const incoming = req.headers['x-request-id'];
    const requestId = Array.isArray(incoming) ? incoming[0] : incoming;
    req.requestId = requestId || randomUUID();
    res.setHeader('x-request-id', req.requestId);
    next();
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true
    })
  );

  await app.init();
  return app;
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.ledgerTransaction.deleteMany(),
    prisma.checkIn.deleteMany(),
    prisma.challengeParticipant.deleteMany(),
    prisma.challenge.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.wallet.deleteMany(),
    prisma.user.deleteMany()
  ]);
}


