import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../database/prisma.service';
import { expirationToDate } from '../common/utils/expiration.util';
import { PublicUser, toPublicUser } from '../users/dto/public-user.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuthResponse, AuthTokens } from './types/auth-response.type';
import { JwtUser } from './types/jwt-user.type';

interface RefreshTokenPayload {
  sub: string;
  email: string;
  jti: string;
}

@Injectable()
export class AuthService {
  private readonly bcryptRounds: number;
  private readonly accessSecret: string;
  private readonly refreshSecret: string;
  private readonly accessExpiration: string;
  private readonly refreshExpiration: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    configService: ConfigService
  ) {
    this.bcryptRounds = configService.getOrThrow<number>('auth.bcryptRounds');
    this.accessSecret = configService.getOrThrow<string>('auth.jwtAccessSecret');
    this.refreshSecret = configService.getOrThrow<string>('auth.jwtRefreshSecret');
    this.accessExpiration = configService.getOrThrow<string>('auth.jwtAccessExpiration');
    this.refreshExpiration = configService.getOrThrow<string>('auth.jwtRefreshExpiration');
  }

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, this.bcryptRounds);

    try {
      const user = await this.prisma.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            email,
            passwordHash
          }
        });

        await tx.wallet.create({
          data: {
            userId: createdUser.id,
            currency: 'USD'
          }
        });

        return createdUser;
      });

      return {
        user: toPublicUser(user),
        tokens: await this.issueTokens(user)
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('Email is already registered');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({ where: { email } });
    const validPassword = user ? await bcrypt.compare(dto.password, user.passwordHash) : false;
    if (!user || !validPassword) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    return {
      user: toPublicUser(updatedUser),
      tokens: await this.issueTokens(updatedUser)
    };
  }

  async refresh(refreshToken: string): Promise<AuthResponse> {
    const payload = await this.verifyRefreshToken(refreshToken);
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true }
    });

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt <= new Date()) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const tokenMatches = await bcrypt.compare(refreshToken, storedToken.tokenHash);
    if (!tokenMatches || storedToken.userId !== payload.sub) {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }

    const tokens = await this.prisma.$transaction(async (tx) => {
      await tx.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() }
      });
      return this.issueTokens(storedToken.user, tx);
    });

    return {
      user: toPublicUser(storedToken.user),
      tokens
    };
  }

  async logout(refreshToken: string): Promise<{ loggedOut: boolean }> {
    const payload = await this.verifyRefreshToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: {
        id: payload.jti,
        userId: payload.sub,
        revokedAt: null
      },
      data: { revokedAt: new Date() }
    });

    return { loggedOut: true };
  }

  async getMe(user: JwtUser): Promise<PublicUser> {
    const currentUser = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    return toPublicUser(currentUser);
  }

  private async issueTokens(user: User, tx: Prisma.TransactionClient | PrismaService = this.prisma): Promise<AuthTokens> {
    const refreshRecord = await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: 'pending',
        expiresAt: expirationToDate(this.refreshExpiration)
      }
    });

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        { secret: this.accessSecret, expiresIn: this.accessExpiration }
      ),
      this.jwtService.signAsync(
        { sub: user.id, email: user.email },
        {
          secret: this.refreshSecret,
          expiresIn: this.refreshExpiration,
          jwtid: refreshRecord.id
        }
      )
    ]);

    await tx.refreshToken.update({
      where: { id: refreshRecord.id },
      data: { tokenHash: await bcrypt.hash(refreshToken, this.bcryptRounds) }
    });

    return { accessToken, refreshToken };
  }

  private async verifyRefreshToken(refreshToken: string): Promise<RefreshTokenPayload> {
    try {
      return await this.jwtService.verifyAsync<RefreshTokenPayload>(refreshToken, {
        secret: this.refreshSecret
      });
    } catch {
      throw new UnauthorizedException('Refresh token is invalid or expired');
    }
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
  }
}
