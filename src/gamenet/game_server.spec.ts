import { jest } from "@jest/globals";
import { Channel, hostGame } from "./game_server";
import {
  Adapter,
  MessageEnvelope,
  ServerAdapterManager,
  ServerAdapterSession,
} from "./routing/adapter";
import { Message } from "./routing/message";
import { defaultPayloadSerde } from "./serde";

function createMockAdapter(id: string, remoteId: string): Adapter {
  return {
    id,
    clientIds: new Set<string>([remoteId]),
    receiveMessage(_message: Message) {},
    emitMessage(message: Message) {
      this.onEmitMessage?.(message);
    },
  };
}

describe("hostGame", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it("supports injected transport manager with non-WebRTC adapter", async () => {
    const sessions = new Map<string, ServerAdapterSession>();
    const manager: ServerAdapterManager = {
      sessions,
      dispose: jest.fn(),
    };

    const server = await hostGame({
      createAdapterManager: () => manager,
    });

    const channelPromise = new Promise<Channel>((resolve) => {
      server.onConnection((channel) => resolve(channel));
    });

    const remoteId = "worker-client-1";
    const adapter = createMockAdapter("worker-adapter-1", remoteId);
    const sendMessage = jest.fn();
    const sendRaw = jest.fn();
    const session: ServerAdapterSession = {
      remoteId,
      adapter,
      sendMessage,
      sendRaw,
      dispose: jest.fn(),
    };

    sessions.set(remoteId, session);
    manager.onConnection?.(session);

    const channel = await channelPromise;
    expect(channel.clientId).toBe(remoteId);
    expect(server.adapters.get(remoteId)).toBe(adapter);
    expect(server.router.adapters.get(adapter.id)).toBe(adapter);

    channel.emit("worker_event", { source: "worker" }, { reliable: true });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        t: "worker_event",
        data: expect.any(ArrayBuffer),
      }),
      { reliable: true }
    );
    const sentEnvelope = sendMessage.mock.calls.at(-1)?.[0] as MessageEnvelope;
    expect(defaultPayloadSerde.decode(sentEnvelope.data)).toEqual({
      source: "worker",
    });

    const onDisconnect = jest.fn();
    channel.onDisconnect(onDisconnect);
    session.onDisconnected?.();

    expect(server.adapters.has(remoteId)).toBe(false);
    expect(server.router.adapters.has(adapter.id)).toBe(false);
    expect(onDisconnect).toHaveBeenCalledWith(remoteId);

    server.dispose();
    expect(manager.dispose).toHaveBeenCalled();
  });

  it("broadcasts clients_ping_list to connected channels", async () => {
    jest.useFakeTimers();

    const sessions = new Map<string, ServerAdapterSession>();
    const manager: ServerAdapterManager = {
      sessions,
      dispose: jest.fn(),
    };

    const server = await hostGame({
      createAdapterManager: () => manager,
    });

    server.onConnection(() => {});

    const remoteId = "worker-client-2";
    const adapter = createMockAdapter("worker-adapter-2", remoteId);
    const sendMessage = jest.fn();
    const sendRaw = jest.fn();
    const session: ServerAdapterSession = {
      remoteId,
      adapter,
      sendMessage,
      sendRaw,
      dispose: jest.fn(),
    };

    sessions.set(remoteId, session);
    manager.onConnection?.(session);

    jest.advanceTimersByTime(500);

    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        t: "clients_ping_list",
        data: expect.any(ArrayBuffer),
      }),
      { reliable: true }
    );
    const pingListCall = sendMessage.mock.calls
      .map((args) => args[0] as MessageEnvelope)
      .reverse()
      .find((envelope) => envelope.t === "clients_ping_list");
    expect(pingListCall).toBeDefined();
    const pingListEnvelope = pingListCall as MessageEnvelope;
    expect(defaultPayloadSerde.decode(pingListEnvelope.data)).toEqual({
      ts: expect.any(Number),
      clients: [{ clientId: remoteId, pingMs: null }],
    });

    server.dispose();
  });

  it("times out clients that do not send pong within 10 seconds", async () => {
    jest.useFakeTimers();

    const sessions = new Map<string, ServerAdapterSession>();
    const manager: ServerAdapterManager = {
      sessions,
      dispose: jest.fn(),
    };

    const server = await hostGame({
      createAdapterManager: () => manager,
    });
    server.onConnection(() => {});

    const remoteId = "stale-client";
    const adapter = createMockAdapter("worker-adapter-stale", remoteId);
    const sendMessage = jest.fn();
    const sendRaw = jest.fn();
    const dispose = jest.fn();
    const session: ServerAdapterSession = {
      remoteId,
      adapter,
      sendMessage,
      sendRaw,
      dispose,
    };

    sessions.set(remoteId, session);
    manager.onConnection?.(session);

    expect(server.adapters.has(remoteId)).toBe(true);

    jest.advanceTimersByTime(10_500);

    expect(dispose).toHaveBeenCalledTimes(1);
    expect(server.adapters.has(remoteId)).toBe(false);
    expect(server.router.adapters.has(adapter.id)).toBe(false);

    server.dispose();
  });
});
