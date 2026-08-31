# StakeSync API

Production-ready backend foundation for StakeSync, focused on authentication and the initial PostgreSQL schema.

## Stack

- Node.js, TypeScript, NestJS
- PostgreSQL with Prisma ORM
- JWT access and refresh tokens with Passport.js
- bcrypt password and refresh-token hashing
- class-validator/class-transformer validation
- Swagger at `/api/docs`
- Jest and Supertest
- Docker and Docker Compose

## Local Setup

```bash
cd apps/api
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev
```

The API listens on `PORT` and uses the global prefix `/api/v1`.

## Environment Variables

See `.env.example` for the full list. Required secrets must be supplied locally and must not be committed.

- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_ACCESS_SECRET`: secret for short-lived access tokens.
- `JWT_REFRESH_SECRET`: separate secret for refresh tokens.
- `JWT_ACCESS_EXPIRATION`: example `15m`.
- `JWT_REFRESH_EXPIRATION`: example `7d`.
- `BCRYPT_ROUNDS`: recommended `12`.
- `CORS_ORIGIN`: comma-separated allowed origins, or `*` for development.

## Database

Prisma schema: `prisma/schema.prisma`

Initial migration: `prisma/migrations/20260726000000_initial_schema/migration.sql`

Useful commands:

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run prisma:studio
```

The seed creates two demo users, a USD wallet for each, and one sample challenge.

## Authentication Flow

Endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

Registration normalizes email addresses, hashes passwords, rejects duplicates, creates a default USD wallet in the same transaction, and returns public user data plus tokens.

Access tokens are short-lived JWTs with minimal claims. Refresh tokens are JWTs too, but the raw token is never stored. The database stores a bcrypt hash keyed by the token `jti`. Refresh rotates tokens by revoking the previous database record before issuing a new pair.

## Responses

Successful responses follow:

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {},
  "requestId": "uuid"
}
```

Errors follow:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "email must be an email" }
  ],
  "requestId": "uuid"
}
```

## Tests

Unit tests:

```bash
npm run test
```

End-to-end tests require a separate test database. Example:

```bash
DATABASE_URL=postgresql://stakesync:stakesync@localhost:5432/stakesync_test?schema=public npm run prisma:migrate
DATABASE_URL=postgresql://stakesync:stakesync@localhost:5432/stakesync_test?schema=public npm run test:e2e
```

Covered flows include registration, duplicate registration, login, invalid login, protected route access, refresh token rotation, expired/revoked refresh tokens, logout, current user, and wallet creation.

## Docker

```bash
cd apps/api
cp .env.example .env
docker compose up --build
```

The compose file starts PostgreSQL and the API. The API container runs deployed migrations before starting.

## Swagger

After starting the server, open:

```text
http://localhost:3001/api/docs
```

Swagger includes bearer authentication support and request DTO documentation.

## Architectural Decisions

- Feature modules keep auth, users, health, and database concerns separate.
- Controllers return consistent envelopes and delegate business logic to services.
- Refresh tokens are rotated and revocable through database state.
- Wallet creation is part of the registration transaction to avoid users without ledgers.
- Money fields use Prisma `Decimal` backed by PostgreSQL `DECIMAL`, never floating-point values.
- Unknown request fields are rejected globally to reduce mass-assignment risk.
- Request IDs are added to headers and response envelopes for traceability.

## Current Scope Boundaries

This phase intentionally does not implement frontend code, payments, AI verification, background jobs, or challenge workflows. Challenge and ledger tables exist now so future work can build on a stable schema.
