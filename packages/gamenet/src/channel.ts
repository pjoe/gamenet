import { nanoid } from "nanoid";

export const salt = "f00Bar!";

/**
 * Creates a 23-bit host channel ID encoded as a 7-digit numeric string.
 *
 * Bit layout (MSB → LSB):
 *   [22:15]  8 bit — random
 *   [14:12]  3 bit — hour (epoch hours mod 8)
 *   [11:6]   6 bit — milliseconds (epoch ms mod 64)
 *   [5:0]    6 bit — hash (SHA-256 of salt + upper 17 bits)
 */
export async function createHostChannelId(): Promise<string> {
  const now = Date.now();
  const random = crypto.getRandomValues(new Uint8Array(1))[0];
  const hour = Math.floor(now / 3_600_000) & 0x7;
  const ms = now & 0x3f;
  const upper = (random << 9) | (hour << 6) | ms;
  const buf = new TextEncoder().encode(salt + upper.toString());
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hash = new Uint8Array(hashBuf)[0] & 0x3f;
  return ((upper << 6) | hash).toString().padStart(7, "0");
}

export function createClientChannelId(): string {
  return nanoid(21);
}
