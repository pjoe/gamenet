import { jest } from "@jest/globals";
import { joinGame } from "./game_client";
import { hostGame } from "./game_server";
import { selectSignalServer, SignalServer } from "./signal_server";

const customIceServers: RTCIceServer[] = [
  { urls: ["stun:stun.example.com:3478"] },
  {
    urls: "turn:turn.example.com:3478",
    username: "player",
    credential: "test-credential",
  },
];

describe("ICE server configuration", () => {
  let handlers: Map<string, (message: string) => void>;
  let signalServer: SignalServer;
  let createPeer: jest.SpiedClass<typeof RTCPeerConnection>;

  beforeEach(() => {
    handlers = new Map();
    signalServer = {
      send: jest.fn<SignalServer["send"]>().mockResolvedValue(undefined),
      subscribe: (id, handler) => {
        handlers.set(id, handler);
      },
      unsubscribe: jest.fn(),
    };
    selectSignalServer(signalServer);
    createPeer = jest.spyOn(globalThis, "RTCPeerConnection").mockImplementation(
      () =>
        ({
          createDataChannel: () => ({}),
          createOffer: async () => ({ type: "offer", sdp: "" }),
          createAnswer: async () => ({ type: "answer", sdp: "" }),
          setLocalDescription: async () => {},
          setRemoteDescription: async () => {},
          close: jest.fn(),
        }) as unknown as RTCPeerConnection
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    ["custom STUN and TURN servers", customIceServers, customIceServers],
    ["an empty list", [], []],
    [
      "the default when omitted",
      undefined,
      [{ urls: "stun:stun.l.google.com:19302" }],
    ],
  ])(
    "uses %s for host and joining peers",
    async (_name, iceServers, expected) => {
      const server = await hostGame({ serverId: "host", iceServers });
      const client = await joinGame({ serverId: "host", iceServers });
      try {
        handlers.get(client.clientId)?.(
          JSON.stringify({ from: "host", t: "joined" })
        );
        handlers.get("host")?.(
          JSON.stringify({
            from: client.clientId,
            t: "offer",
            data: { type: "offer", sdp: "" },
          })
        );
        await Promise.resolve();
        expect(createPeer).toHaveBeenCalledTimes(2);
        expect(createPeer).toHaveBeenNthCalledWith(1, { iceServers: expected });
        expect(createPeer).toHaveBeenNthCalledWith(2, { iceServers: expected });
        expect(signalServer.send).toHaveBeenCalledWith(
          client.clientId,
          "host",
          "join",
          { nickname: undefined }
        );
      } finally {
        client.dispose();
        server.dispose();
      }
    }
  );

  it("forwards configuration to injected transport factories", async () => {
    const createAdapterManager = jest.fn(() => ({
      sessions: new Map(),
      dispose: jest.fn(),
    }));
    const createAdapterSession = jest.fn(() => ({
      sendMessage: jest.fn(),
      sendRaw: jest.fn(),
      dispose: jest.fn(),
    }));
    const server = await hostGame({
      serverId: "host",
      iceServers: customIceServers,
      createAdapterManager,
    });
    const client = await joinGame({
      serverId: "host",
      iceServers: customIceServers,
      createAdapterSession,
    });
    try {
      expect(createAdapterManager).toHaveBeenCalledWith({
        serverId: "host",
        iceServers: customIceServers,
      });
      expect(createAdapterSession).toHaveBeenCalledWith({
        clientId: client.clientId,
        serverId: "host",
        nickname: undefined,
        iceServers: customIceServers,
      });
      expect(createPeer).not.toHaveBeenCalled();
    } finally {
      client.dispose();
      server.dispose();
    }
  });
});
