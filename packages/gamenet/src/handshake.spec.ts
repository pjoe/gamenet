/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GameClient } from "./game_client";
import type { Channel } from "./game_server";
import { channelReady, clientReady } from "./handshake";

function createMockGameClient() {
  const handlers = new Map<string, (data: any) => void>();
  const emitted: Array<{ ev: string; data: any }> = [];
  const client: Pick<GameClient, "on" | "emit"> = {
    on(type: string, handler: any) {
      handlers.set(type, handler);
    },
    emit(ev: string, data: any, _options?: any) {
      emitted.push({ ev, data });
    },
  };
  return { client: client as GameClient, handlers, emitted };
}

function createMockChannel() {
  const handlers = new Map<string, (from: string, data: any) => void>();
  const emitted: Array<{ ev: string; data: any }> = [];
  const channel: Pick<Channel, "on" | "emit"> = {
    on(type: string, handler: any) {
      handlers.set(type, handler);
    },
    emit(ev: string, data: any, _options?: any) {
      emitted.push({ ev, data });
    },
  };
  return { channel: channel as Channel, handlers, emitted };
}

describe("clientReady", () => {
  it("resolves when server responds to handshake", async () => {
    const { client, handlers } = createMockGameClient();

    // Simulate server responding after a short delay
    const promise = clientReady(client);

    // Wait for the first emit to happen, then trigger the "ready" handler
    await new Promise((resolve) => setTimeout(resolve, 10));
    const readyHandler = handlers.get("ready")!;
    // Simulate server sending ack=1 (meaning server already received our first message)
    readyHandler(1);

    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when server does not respond", async () => {
    const { client } = createMockGameClient();

    await expect(clientReady(client)).rejects.toThrow(
      "Failed to handshake with server"
    );
  });
});

describe("channelReady", () => {
  it("resolves when client responds to handshake", async () => {
    const { channel, handlers } = createMockChannel();

    const promise = channelReady(channel);

    await new Promise((resolve) => setTimeout(resolve, 10));
    const readyHandler = handlers.get("ready")!;
    // Simulate client sending ack=1
    readyHandler("client-1", 1);

    await expect(promise).resolves.toBeUndefined();
  });

  it("rejects when client does not respond", async () => {
    const { channel } = createMockChannel();

    await expect(channelReady(channel)).rejects.toThrow(
      "Failed to handshake with client"
    );
  });
});
