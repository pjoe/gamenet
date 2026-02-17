import { createHostChannelId } from "@gamenet/channel";
import type {
  ClientsPingListEntry,
  ClientsPingListPayload,
} from "@gamenet/clients_ping_list";
import { joinGame } from "@gamenet/game_client";
import {
  Adapter,
  ClientAdapterSession,
  createWorkerAdapter,
} from "@gamenet/routing/adapter";
import { createServerWebRTCAdapterManager } from "@gamenet/routing/adapter_webrtc";
import { Message } from "@gamenet/routing/message";
import { createRouter, Router } from "@gamenet/routing/router";
import { useEffect, useState } from "react";

interface HostRuntime {
  serverId: string;
  dispose: () => void;
}

const WORKER_SERVER_ID = "host-worker";

function encodePayload(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer;
}

function decodePayload<T = unknown>(data: ArrayBuffer): T | undefined {
  try {
    const text = new TextDecoder().decode(new Uint8Array(data));
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function createWorkerServerWorker() {
  return new Worker(
    new URL("../gamenet/routing/host_server_worker.ts", import.meta.url),
    { type: "module" }
  );
}

/**
 * Creates a simple adapter for a WebRTC client that:
 * - receiveMessage: converts routing Message to plain JSON and sends via session.sendJSON
 * - emitMessage: no-op (inbound messages are handled by session.onMessage in the caller)
 */
function createClientBridgeAdapter(
  adapterId: string,
  clientId: string,
  sendJSON: (msg: unknown, options?: { reliable: boolean }) => void,
  sendRaw: (msg: ArrayBuffer, options?: { reliable: boolean }) => void
) {
  return {
    id: adapterId,
    clientIds: new Set<string>([clientId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
      const decoded = decodePayload(message.data);
      if (message.type === "raw" && message.data) {
        sendRaw(message.data, { reliable: message.reliable });
      } else {
        sendJSON(
          { t: message.type, data: decoded },
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
}): ClientAdapterSession {
  const { clientId, targetId, hostRouter } = args;

  // Adapter registered with the host router to receive messages for this client
  const hostSideAdapter: Adapter = {
    id: `local:${clientId}`,
    clientIds: new Set([clientId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
      const decoded = decodePayload(message.data);
      session.onMessage?.({ t: message.type, data: decoded });
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
    sendJSON(msg: unknown, options?: { reliable: boolean }) {
      const envelope = msg as { t: string; data?: unknown };
      const message: Message = {
        from: clientId,
        to: targetId,
        type: envelope.t,
        data: encodePayload(envelope.data),
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
        data: encodePayload({ clientId }),
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
    data: encodePayload({ clientId }),
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
  const [isHosting, setIsHosting] = useState(false);
  const [clientPingList, setClientPingList] = useState<ClientsPingListEntry[]>(
    []
  );
  const [gameServer, setGameServer] = useState<HostRuntime>();

  useEffect(() => {
    return () => {
      gameServer?.dispose();
    };
  }, [gameServer]);

  const handleHostGame = async () => {
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
      data: encodePayload({ serverId }),
      reliable: true,
    };
    router.sendMessage(initMessage);

    // Connect host as a regular game client through the router
    const hostClient = await joinGame({
      serverId,
      createAdapterSession: ({ clientId }) =>
        createLocalClientAdapterSession({
          clientId,
          targetId: WORKER_SERVER_ID,
          hostRouter: router,
        }),
    });

    hostClient.on("clients_ping_list", (data: ClientsPingListPayload) => {
      setClientPingList(data.clients);
    });

    const manager = createServerWebRTCAdapterManager({ serverId });

    manager.onConnection = (session) => {
      const remoteId = session.remoteId;

      // Create a bridge adapter for this client
      const bridgeAdapter = createClientBridgeAdapter(
        `bridge:${remoteId}`,
        remoteId,
        (msg, opts) => session.sendJSON(msg, opts),
        (msg, opts) => session.sendRaw(msg, opts)
      );
      router.registerAdapter(bridgeAdapter);

      // Forward incoming WebRTC messages from this client to the worker
      session.onMessage = (json) => {
        const routedMessage: Message = {
          from: remoteId,
          to: WORKER_SERVER_ID,
          type: json.t,
          data: encodePayload(json.data),
          reliable: true,
        };
        router.sendMessage(routedMessage);
      };

      session.onDisconnected = () => {
        router.adapters.delete(bridgeAdapter.id);
        router.routes.delete(remoteId);
        // Notify worker about disconnection
        const disconnectMsg: Message = {
          from: remoteId,
          to: WORKER_SERVER_ID,
          type: "__client_disconnected",
          data: encodePayload({ clientId: remoteId }),
          reliable: true,
        };
        router.sendMessage(disconnectMsg);
      };

      // Notify worker about new connection
      const connectMsg: Message = {
        from: remoteId,
        to: WORKER_SERVER_ID,
        type: "__client_connected",
        data: encodePayload({ clientId: remoteId }),
        reliable: true,
      };
      router.sendMessage(connectMsg);
    };

    const hostRuntime: HostRuntime = {
      serverId,
      dispose() {
        hostClient.dispose();
        manager.dispose();
        worker.terminate();
      },
    };

    setGameServer(hostRuntime);
    setIsHosting(true);
  };

  return (
    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3 transition-colors duration-200">
          Host a Game
        </h1>

        {!isHosting ? (
          <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-8 transition-colors duration-200">
            <p className="text-[var(--color-text-secondary)] mb-6 transition-colors duration-200">
              Create a new game session and share the code with your friends.
            </p>
            <button
              onClick={handleHostGame}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition"
            >
              Start Hosting
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-4 transition-colors duration-200">
              <div className="text-center">
                <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2 transition-colors duration-200">
                  Your Game Code
                </h2>
                <div className="bg-[var(--color-bg-tertiary)] rounded-lg p-4 mb-3 transition-colors duration-200">
                  <p className="text-3xl font-mono font-bold text-[var(--color-accent-blue)] transition-colors duration-200">
                    {gameServer?.serverId}
                  </p>
                </div>
                <p className="text-[var(--color-text-secondary)] text-sm mb-2 transition-colors duration-200">
                  Share this code with players to let them join your game.
                </p>
                <div className="bg-[var(--color-success-bg)] border border-[var(--color-success-border)] rounded-lg p-2 transition-colors duration-200">
                  <p className="text-[var(--color-success-text)] text-sm transition-colors duration-200">
                    ✓ Game session is active
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[var(--color-bg-primary)] rounded-lg shadow p-4 transition-colors duration-200">
              <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-3 transition-colors duration-200">
                Connected Clients ({clientPingList.length})
              </h2>
              {clientPingList.length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm text-center py-4 transition-colors duration-200">
                  No clients connected yet. Share your game code to get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {clientPingList.map((client) => (
                    <div
                      key={client.clientId}
                      className="bg-[var(--color-bg-tertiary)] rounded-lg p-3 flex items-center justify-between transition-colors duration-200"
                    >
                      <div>
                        <p className="font-mono text-[var(--color-text-primary)] transition-colors duration-200">
                          {client.clientId}
                        </p>
                      </div>
                      <div className="text-sm text-[var(--color-text-secondary)] transition-colors duration-200">
                        Ping:{" "}
                        {client.pingMs === null
                          ? "N/A"
                          : `${client.pingMs.toFixed(2)}ms`}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Host;
