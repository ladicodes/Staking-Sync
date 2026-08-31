import { randomUUID } from 'crypto';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';

interface RequestWithId extends Request {
  requestId?: string;
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const configService = app.get(ConfigService);
  const corsOrigin = configService.getOrThrow<string>('app.corsOrigin');

  app.use(helmet());
  app.enableCors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((origin) => origin.trim()),
    credentials: true
  });
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

  const swaggerConfig = new DocumentBuilder()
    .setTitle('StakeSync API')
    .setDescription('Authentication and database foundation for StakeSync')
    .setVersion(configService.getOrThrow<string>('app.version'))
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  await app.listen(configService.getOrThrow<number>('app.port'));
}

void bootstrap();


