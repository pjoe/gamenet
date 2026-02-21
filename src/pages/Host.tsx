import { createHostChannelId } from "@gamenet/channel";
import { joinGame } from "@gamenet/game_client";
import {
  Adapter,
  ClientAdapterSession,
  createWorkerAdapter,
  MessageEnvelope,
} from "@gamenet/routing/adapter";
import { createServerWebRTCAdapterManager } from "@gamenet/routing/adapter_webrtc";
import { Message } from "@gamenet/routing/message";
import { createRouter, Router } from "@gamenet/routing/router";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useGame } from "../contexts/GameContext";

const WORKER_SERVER_ID = "host-worker";

function createEmptyBuffer(): ArrayBuffer {
  return new ArrayBuffer(0);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
}

function encodeClientConnectPayload(payload: {
  nickname?: string;
}): ArrayBuffer {
  const nickname = payload.nickname?.trim();
  if (!nickname) {
    return createEmptyBuffer();
  }

  return toArrayBuffer(new TextEncoder().encode(JSON.stringify({ nickname })));
}

function createWorkerServerWorker() {
  return new Worker(
    new URL("../gamenet/routing/host_server_worker.ts", import.meta.url),
    { type: "module" }
  );
}

/**
 * Creates a simple adapter for a WebRTC client that:
 * - receiveMessage: forwards routing Message data as binary envelope via session.sendMessage
 * - emitMessage: no-op (inbound messages are handled by session.onMessage in the caller)
 */
function createClientBridgeAdapter(
  adapterId: string,
  clientId: string,
  sendMessage: (msg: MessageEnvelope, options?: { reliable: boolean }) => void,
  sendRaw: (msg: ArrayBuffer, options?: { reliable: boolean }) => void
) {
  return {
    id: adapterId,
    clientIds: new Set<string>([clientId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
      if (message.type === "raw" && message.data) {
        sendRaw(message.data, { reliable: message.reliable });
      } else {
        sendMessage(
          { t: message.type, data: message.data },
          { reliable: message.reliable }
        );
      }
    },
    emitMessage(message: Message) {
      this.onEmitMessage?.(message);
    },
  } satisfies import("@gamenet/routing/adapter").Adapter;
}

/**
 * Creates a ClientAdapterSession that connects a GameClient to the host's
 * router locally (no WebRTC). Messages are routed through the host router
 * to the worker, and responses are delivered back via onMessage.
 */
function createLocalClientAdapterSession(args: {
  clientId: string;
  targetId: string;
  hostRouter: Router;
  nickname?: string;
}): ClientAdapterSession {
  const { clientId, targetId, hostRouter, nickname } = args;

  // Adapter registered with the host router to receive messages for this client
  const hostSideAdapter: Adapter = {
    id: `local:${clientId}`,
    clientIds: new Set([clientId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
      session.onMessage?.({ t: message.type, data: message.data });
    },
    emitMessage(message: Message) {
      this.onEmitMessage?.(message);
    },
  };

  // Adapter returned to joinGame for its internal router registration
  const clientSideAdapter: Adapter = {
    id: `local-gw:${clientId}`,
    clientIds: new Set([targetId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
    },
    emitMessage(message: Message) {
      this.onEmitMessage?.(message);
    },
  };

  const session: ClientAdapterSession = {
    adapter: undefined,
    sendMessage(msg: MessageEnvelope, options?: { reliable: boolean }) {
      const message: Message = {
        from: clientId,
        to: targetId,
        type: msg.t,
        data: msg.data,
        reliable: options?.reliable ?? true,
      };
      hostRouter.sendMessage(message);
    },
    sendRaw(data: ArrayBuffer, options?: { reliable: boolean }) {
      const message: Message = {
        from: clientId,
        to: targetId,
        type: "raw",
        data,
        reliable: options?.reliable ?? true,
      };
      hostRouter.sendMessage(message);
    },
    dispose() {
      hostRouter.adapters.delete(hostSideAdapter.id);
      hostRouter.routes.delete(clientId);
      const disconnectMsg: Message = {
        from: clientId,
        to: targetId,
        type: "__client_disconnected",
        data: createEmptyBuffer(),
        reliable: true,
      };
      hostRouter.sendMessage(disconnectMsg);
    },
  };

  hostRouter.registerAdapter(hostSideAdapter);

  // Notify worker that this client connected
  const connectMsg: Message = {
    from: clientId,
    to: targetId,
    type: "__client_connected",
    data: encodeClientConnectPayload({ nickname }),
    reliable: true,
  };
  hostRouter.sendMessage(connectMsg);

  // Connect immediately on next microtask
  session.adapter = clientSideAdapter;
  queueMicrotask(() => {
    session.onConnected?.(clientSideAdapter);
  });

  return session;
}

function Host() {
  const [isStarting, setIsStarting] = useState(false);
  const [nickname, setNickname] = useState("Host");
  const { session, startSession } = useGame();
  const navigate = useNavigate();

  if (session) {
    return <Navigate to="/game" replace />;
  }

  const handleHostGame = async () => {
    const normalizedNickname = nickname.trim();
    if (!normalizedNickname) {
      return;
    }

    setIsStarting(true);
    const serverId = await createHostChannelId();
    const router = createRouter(serverId);
    const worker = createWorkerServerWorker();
    const workerAdapter = createWorkerAdapter(WORKER_SERVER_ID, worker);
    workerAdapter.clientIds.add(WORKER_SERVER_ID);
    router.registerAdapter(workerAdapter);

    // Send __init to worker with serverId (must happen before joinGame
    // so the worker is ready to handle __client_connected)
    const initMessage: Message = {
      from: serverId,
      to: WORKER_SERVER_ID,
      type: "__init",
      data: createEmptyBuffer(),
      reliable: true,
    };
    router.sendMessage(initMessage);

    // Connect host as a regular game client through the router
    const hostClient = await joinGame({
      serverId,
      nickname: normalizedNickname,
      createAdapterSession: ({ clientId, nickname: localNickname }) =>
        createLocalClientAdapterSession({
          clientId,
          targetId: WORKER_SERVER_ID,
          hostRouter: router,
          nickname: localNickname,
        }),
    });

    const manager = createServerWebRTCAdapterManager({ serverId });

    manager.onConnection = (webrtcSession) => {
      const remoteId = webrtcSession.remoteId;

      // Create a bridge adapter for this client
      const bridgeAdapter = createClientBridgeAdapter(
        `bridge:${remoteId}`,
        remoteId,
        (msg, opts) => webrtcSession.sendMessage(msg, opts),
        (msg, opts) => webrtcSession.sendRaw(msg, opts)
      );
      router.registerAdapter(bridgeAdapter);

      // Forward incoming WebRTC messages from this client to the worker
      webrtcSession.onMessage = (json) => {
        const routedMessage: Message = {
          from: remoteId,
          to: WORKER_SERVER_ID,
          type: json.t,
          data: json.data,
          reliable: true,
        };
        router.sendMessage(routedMessage);
      };

      webrtcSession.onDisconnected = () => {
        router.adapters.delete(bridgeAdapter.id);
        router.routes.delete(remoteId);
        // Notify worker about disconnection
        const disconnectMsg: Message = {
          from: remoteId,
          to: WORKER_SERVER_ID,
          type: "__client_disconnected",
          data: createEmptyBuffer(),
          reliable: true,
        };
        router.sendMessage(disconnectMsg);
      };

      // Notify worker about new connection
      const connectMsg: Message = {
        from: remoteId,
        to: WORKER_SERVER_ID,
        type: "__client_connected",
        data: encodeClientConnectPayload({
          nickname: webrtcSession.nickname ?? remoteId,
        }),
        reliable: true,
      };
      router.sendMessage(connectMsg);
    };

    startSession({
      gameClient: hostClient,
      serverId,
      isHost: true,
      dispose() {
        hostClient.dispose();
        manager.dispose();
        worker.terminate();
      },
    });
    navigate("/game");
  };

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 transition-colors duration-200">
          Host a Game
        </h1>

        <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-8 transition-colors duration-200">
          <p className="text-[var(--color-text-secondary)] mb-6 transition-colors duration-200">
            Create a new game session and share the code with your friends.
          </p>
          <div className="mb-6">
            <label
              htmlFor="hostNickname"
              className="block text-sm font-medium text-[var(--color-text-secondary)] mb-2 transition-colors duration-200"
            >
              Nickname
            </label>
            <input
              type="text"
              id="hostNickname"
              disabled={isStarting}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              maxLength={32}
              className="w-full px-4 py-3 border border-[var(--color-border)] rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-[var(--color-bg-primary)] text-[var(--color-text-primary)] transition-colors duration-200"
              required
            />
          </div>
          <button
            onClick={handleHostGame}
            disabled={isStarting || !nickname.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium py-3 px-4 rounded-lg transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isStarting ? "Starting..." : "Start Hosting"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Host;
