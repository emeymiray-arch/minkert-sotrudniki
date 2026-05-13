import { createHash, randomBytes } from 'crypto';

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export function randomRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}
