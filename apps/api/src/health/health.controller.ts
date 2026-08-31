import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';

interface HealthResponse {
  status: 'ok' | 'degraded';
  database: 'connected' | 'disconnected';
  timestamp: string;
  version: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {}

  @Get()
  @ApiOkResponse({ description: 'Application and database health status' })
  async check(): Promise<HealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
        version: this.configService.getOrThrow<string>('app.version')
      };
    } catch {
      return {
        status: 'degraded',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
        version: this.configService.getOrThrow<string>('app.version')
      };
    }
  }
}
