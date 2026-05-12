import * as Crypto from 'expo-crypto';

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

export async function generateInviteToken(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(12);
  let token = '';
  for (let i = 0; i < 12; i++) {
    token += CHARS[bytes[i] % 36];
    if (i === 3 || i === 7) token += '-';
  }
  return token; // Format: XXXX-XXXX-XXXX
}

export function validateInviteToken(token: string): boolean {
  return /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(token);
}

export function formatToken(token: string): string {
  const clean = token.replace(/-/g, '').toUpperCase();
  if (clean.length !== 12) return token;
  return `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
}
