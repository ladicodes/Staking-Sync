import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from '../src/database/prisma.service';
import { createTestApp, resetDatabase } from './test-app';

interface AuthBody {
  success: boolean;
  data: {
    user: {
      id: string;
      email: string;
      passwordHash?: string;
    };
    tokens: {
      accessToken: string;
      refreshToken: string;
    };
  };
}

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jwtService: JwtService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  afterAll(async () => {
    await app.close();
  });

  async function register(email = 'samuel@example.com'): Promise<AuthBody> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Samuel',
        lastName: 'Ladipo',
        email,
        password: 'StrongPassword123!'
      })
      .expect(201);

    return response.body as AuthBody;
  }

  it('registers a user and creates a wallet', async () => {
    const body = await register('SAMUEL@example.com');

    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe('samuel@example.com');
    expect(body.data.user.passwordHash).toBeUndefined();
    expect(body.data.tokens.accessToken).toEqual(expect.any(String));
    expect(body.data.tokens.refreshToken).toEqual(expect.any(String));

    const wallet = await prisma.wallet.findFirst({ where: { userId: body.data.user.id, currency: 'USD' } });
    expect(wallet).not.toBeNull();
  });

  it('rejects duplicate registration', async () => {
    await register();

    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Samuel',
        lastName: 'Ladipo',
        email: 'samuel@example.com',
        password: 'StrongPassword123!'
      })
      .expect(409);
  });

  it('logs in with valid credentials and updates lastLoginAt', async () => {
    await register();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'samuel@example.com', password: 'StrongPassword123!' })
      .expect(200);

    const body = response.body as AuthBody;
    expect(body.data.tokens.accessToken).toEqual(expect.any(String));

    const user = await prisma.user.findUniqueOrThrow({ where: { email: 'samuel@example.com' } });
    expect(user.lastLoginAt).toBeInstanceOf(Date);
  });

  it('returns a generic error for invalid login', async () => {
    await register();

    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'samuel@example.com', password: 'WrongPassword123!' })
      .expect(401)
      .expect((response) => {
        expect(response.body.message).toBe('Invalid email or password');
      });
  });

  it('protects the current user endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
  });

  it('returns the current user with an access token', async () => {
    const registered = await register();

    await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${registered.data.tokens.accessToken}`)
      .expect(200)
      .expect((response) => {
        expect(response.body.data.email).toBe('samuel@example.com');
        expect(response.body.data.passwordHash).toBeUndefined();
      });
  });

  it('rotates refresh tokens and revokes the previous token', async () => {
    const registered = await register();

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: registered.data.tokens.refreshToken })
      .expect(200);

    const body = response.body as AuthBody;
    expect(body.data.tokens.refreshToken).not.toBe(registered.data.tokens.refreshToken);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: registered.data.tokens.refreshToken })
      .expect(401);
  });

  it('rejects expired refresh tokens', async () => {
    const registered = await register();
    const decoded = jwtService.decode(registered.data.tokens.refreshToken);
    expect(decoded && typeof decoded === 'object' && 'jti' in decoded).toBe(true);
    const jti = (decoded as { jti: string }).jti;

    await prisma.refreshToken.update({
      where: { id: jti },
      data: { expiresAt: new Date(Date.now() - 1000) }
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: registered.data.tokens.refreshToken })
      .expect(401);
  });

  it('rejects revoked refresh tokens', async () => {
    const registered = await register();
    const decoded = jwtService.decode(registered.data.tokens.refreshToken);
    const jti = (decoded as { jti: string }).jti;

    await prisma.refreshToken.update({
      where: { id: jti },
      data: { revokedAt: new Date() }
    });

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: registered.data.tokens.refreshToken })
      .expect(401);
  });

  it('logs out by revoking the active refresh token', async () => {
    const registered = await register();

    await request(app.getHttpServer())
      .post('/api/v1/auth/logout')
      .send({ refreshToken: registered.data.tokens.refreshToken })
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: registered.data.tokens.refreshToken })
      .expect(401);
  });
});
