export default () => ({
  auth: {
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtAccessExpiration: process.env.JWT_ACCESS_EXPIRATION ?? '15m',
    jwtRefreshExpiration: process.env.JWT_REFRESH_EXPIRATION ?? '7d',
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS ?? 12)
  }
});
