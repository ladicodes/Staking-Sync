const durationPattern = /^(\d+)([smhd])$/;

export function expirationToDate(value: string): Date {
  const match = durationPattern.exec(value.trim());
  if (!match) {
    throw new Error(`Unsupported expiration value: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return new Date(Date.now() + amount * multipliers[unit]);
}
