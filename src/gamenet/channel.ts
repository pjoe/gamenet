import { customAlphabet, nanoid } from "nanoid";

export const hostNanoId = customAlphabet("1234567890", 4);
export const salt = "f00Bar!";

export async function createHostChannelId(): Promise<string> {
  //TODO: replace this with hostId look up from db
  const channel = hostNanoId();
  const buf = new TextEncoder().encode(salt + channel);
  const hashBuf = await crypto.subtle.digest("SHA-256", buf);
  const hash = new Uint8Array(hashBuf)
    .at(0)
    ?.toString(10)
    .padStart(2, "0")
    .slice(0, 2);
  return `${channel}${hash}`;
}

export function createClientChannelId(): string {
  return nanoid(21);
}
