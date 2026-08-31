import { Test } from '@nestjs/testing';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';
import appConfig from '../config/app.config';
import authConfig from '../config/auth.config';
import databaseConfig from '../config/database.config';
import { AuthService } from './auth.service';
import { PrismaService } from '../database/prisma.service';

describe('AuthService', () => {
  beforeAll(() => {
    process.env.JWT_ACCESS_SECRET = 'unit-test-access-secret-at-least-32-chars';
    process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret-at-least-32-chars';
    process.env.JWT_ACCESS_EXPIRATION = '15m';
    process.env.JWT_REFRESH_EXPIRATION = '7d';
    process.env.BCRYPT_ROUNDS = '12';
  });

  it('is defined with dependency injection', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        JwtModule.register({}),
        ConfigModule.forRoot({
          isGlobal: true,
          load: [appConfig, authConfig, databaseConfig],
          ignoreEnvFile: true
        })
      ],
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: {}
        }
      ]
    }).compile();

    expect(moduleRef.get(AuthService)).toBeDefined();
  });
});

