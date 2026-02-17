import { jest } from "@jest/globals";
import { GameClient, joinGame } from "./game_client";
import { Adapter, ClientAdapterSession } from "./routing/adapter";
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

describe("joinGame", () => {
  it("supports injected transport session with non-WebRTC adapter", async () => {
    const sendJSON = jest.fn();
    const sendRaw = jest.fn();

    const session: ClientAdapterSession = {
      sendJSON,
      sendRaw,
      dispose: jest.fn(),
    };

    const gameClient: GameClient = await joinGame({
      serverId: "worker-server-1",
      createAdapterSession: () => session,
    });

    expect(gameClient.adapter).toBeUndefined();

    const adapter = createMockAdapter(
      "worker-client-adapter",
      "worker-server-1"
    );

    const onConnected = jest.fn();
    const onDisconnected = jest.fn();
    gameClient.onConnected(onConnected);
    gameClient.onDisconnected(onDisconnected);

    session.onConnected?.(adapter);

    expect(gameClient.adapter).toBe(adapter);
    expect(gameClient.router.adapters.get(adapter.id)).toBe(adapter);
    expect(onConnected).toHaveBeenCalled();

    gameClient.emit("from_client", { source: "client" }, { reliable: true });
    expect(sendJSON).toHaveBeenCalledWith(
      { t: "from_client", data: { source: "client" } },
      { reliable: true }
    );

    gameClient.emitRaw(new ArrayBuffer(0), { reliable: false });
    expect(sendRaw).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      reliable: false,
    });

    session.onMessage?.({ t: "ping", data: { time: 123 } });
    expect(sendJSON).toHaveBeenCalledWith(
      { t: "pong", data: { time: 123 } },
      undefined
    );

    session.onDisconnected?.();
    expect(gameClient.adapter).toBeUndefined();
    expect(gameClient.router.adapters.has(adapter.id)).toBe(false);
    expect(onDisconnected).toHaveBeenCalled();

    gameClient.dispose();
    expect(session.dispose).toHaveBeenCalled();
  });
});
