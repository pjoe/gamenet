import { jest } from "@jest/globals";
import { Channel, hostGame } from "./game_server";
import {
  Adapter,
  ServerAdapterManager,
  ServerAdapterSession,
} from "./routing/adapter";
import { Message } from "./routing/message";

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
    const sendJSON = jest.fn();
    const sendRaw = jest.fn();
    const session: ServerAdapterSession = {
      remoteId,
      adapter,
      sendJSON,
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
    expect(sendJSON).toHaveBeenCalledWith(
      { t: "worker_event", data: { source: "worker" } },
      { reliable: true }
    );

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
    const sendJSON = jest.fn();
    const sendRaw = jest.fn();
    const session: ServerAdapterSession = {
      remoteId,
      adapter,
      sendJSON,
      sendRaw,
      dispose: jest.fn(),
    };

    sessions.set(remoteId, session);
    manager.onConnection?.(session);

    jest.advanceTimersByTime(500);

    expect(sendJSON).toHaveBeenCalledWith(
      {
        t: "clients_ping_list",
        data: {
          ts: expect.any(Number),
          clients: [{ clientId: remoteId, pingMs: null }],
        },
      },
      { reliable: true }
    );

    server.dispose();
  });
});
