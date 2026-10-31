import { sha256 } from "js-sha256";
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
  const hasher = sha256.create();
  hasher.update(buf);
  const hash = hasher.digest()[0] & 0x3f;
  return ((upper << 6) | hash).toString().padStart(7, "0");
}

/**
 * Checks the 7-digit format, 23-bit range, and hash of a host channel ID.
 * Does not check whether the host exists or whether the ID has expired.
 */
export async function validateHostChannelId(id: string): Promise<boolean> {
  if (id.length !== 7 || !/^\d{7}$/.test(id)) return false;

  const value = Number(id);
  if (value > 0x7fffff) return false;

  const upper = value >>> 6;
  const buf = new TextEncoder().encode(salt + upper.toString());
  const hasher = sha256.create();
  hasher.update(buf);
  const hash = hasher.digest()[0] & 0x3f;

  return (value & 0x3f) === hash;
}

export function createClientChannelId(): string {
  return nanoid(21);
}
