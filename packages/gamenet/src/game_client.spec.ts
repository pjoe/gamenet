import { jest } from "@jest/globals";
import { GameClient, joinGame } from "./game_client";
import {
  Adapter,
  ClientAdapterSession,
  MessageEnvelope,
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

describe("joinGame", () => {
  it("supports injected transport session with non-WebRTC adapter", async () => {
    const sendMessage = jest.fn();
    const sendRaw = jest.fn();

    const session: ClientAdapterSession = {
      sendMessage,
      sendRaw,
      dispose: jest.fn(),
    };

    let createSessionArgs:
      | { clientId: string; serverId: string; nickname?: string }
      | undefined;
    const gameClient: GameClient = await joinGame({
      serverId: "worker-server-1",
      nickname: "Player One",
      createAdapterSession: (args) => {
        createSessionArgs = args;
        return session;
      },
    });

    expect(createSessionArgs).toMatchObject({
      serverId: "worker-server-1",
      nickname: "Player One",
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
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        t: "from_client",
        data: expect.any(ArrayBuffer),
      }),
      { reliable: true }
    );
    const sentEnvelope = sendMessage.mock.calls.at(-1)?.[0] as MessageEnvelope;
    expect(defaultPayloadSerde.decode(sentEnvelope.data)).toEqual({
      source: "client",
    });

    gameClient.emitRaw(new ArrayBuffer(0), { reliable: false });
    expect(sendRaw).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
      reliable: false,
    });

    session.onMessage?.({
      t: "ping",
      data: defaultPayloadSerde.encode({ time: 123 }),
    });
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({ t: "pong", data: expect.any(ArrayBuffer) }),
      undefined
    );
    const pongEnvelope = sendMessage.mock.calls.at(-1)?.[0] as MessageEnvelope;
    expect(defaultPayloadSerde.decode(pongEnvelope.data)).toEqual({
      time: 123,
      clientTime: expect.any(Number),
    });

    session.onDisconnected?.();
    expect(gameClient.adapter).toBeUndefined();
    expect(gameClient.router.adapters.has(adapter.id)).toBe(false);
    expect(onDisconnected).toHaveBeenCalled();

    gameClient.dispose();
    expect(session.dispose).toHaveBeenCalled();
  });
});
