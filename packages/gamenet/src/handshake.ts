import type { GameClient } from "./game_client";
import type { Channel } from "./game_server";

const HANDSHAKE_MAX_RETRIES = 10;
const HANDSHAKE_RETRY_INTERVAL_MS = 50;

/**
 * Perform the initial client-side handshake with the server.
 * Resolves once the server has acknowledged readiness.
 * Rejects if the server does not respond after max retries.
 */
export async function clientReady(gameClient: GameClient): Promise<void> {
  let serverReadyReceived = 0;
  gameClient.on("ready", (ack: number) => {
    serverReadyReceived = ack + 1;
  });
  for (let i = 0; i < HANDSHAKE_MAX_RETRIES; ++i) {
    gameClient.emit("ready", serverReadyReceived, { reliable: true });
    if (serverReadyReceived > 1) {
      break;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, HANDSHAKE_RETRY_INTERVAL_MS)
    );
  }
  if (serverReadyReceived < 1) {
    throw new Error("Failed to handshake with server");
  }
}

/**
 * Perform the initial server-side handshake with a connecting client.
 * Resolves once the client has acknowledged readiness.
 * Rejects if the client does not respond after max retries.
 */
export async function channelReady(channel: Channel): Promise<void> {
  let clientReadyReceived = 0;
  channel.on("ready", (_from: string, ack: number) => {
    clientReadyReceived = ack + 1;
  });
  for (let i = 0; i < HANDSHAKE_MAX_RETRIES; ++i) {
    channel.emit("ready", clientReadyReceived, { reliable: true });
    if (clientReadyReceived > 1) {
      break;
    }
    await new Promise((resolve) =>
      setTimeout(resolve, HANDSHAKE_RETRY_INTERVAL_MS)
    );
  }
  if (clientReadyReceived < 1) {
    throw new Error("Failed to handshake with client");
  }
}
