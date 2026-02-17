import { Channel } from "@gamenet";
import { createHostChannelId } from "@gamenet/channel";
import { createWorkerAdapter } from "@gamenet/routing/adapter";
import { createServerWebRTCAdapterManager } from "@gamenet/routing/adapter_webrtc";
import { decodeRoutingEnvelopePayload } from "@gamenet/routing/envelope_payload";
import { Message } from "@gamenet/routing/message";
import { createRouter } from "@gamenet/routing/router";
import mitt from "mitt";
import { useCallback, useEffect, useState } from "react";

interface ClientsPingListEntry {
  clientId: string;
  pingMs: number | null;
}

interface ClientsPingListPayload {
  ts: number;
  clients: ClientsPingListEntry[];
}

interface HostRuntime {
  serverId: string;
  emitToWorkerClientsPingList: (channels: Channel[]) => void;
  dispose: () => void;
}

const WORKER_SERVER_ID = "host-worker";

function isRoutingEnvelope(data: unknown): boolean {
  return !!(
    data &&
    typeof data === "object" &&
    "from" in data &&
    "to" in data &&
    "payload" in data
  );
}

function encodePayload(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer;
}

function createWorkerServerWorker() {
  return new Worker(
    new URL("../gamenet/routing/host_server_worker.ts", import.meta.url),
    { type: "module" }
  );
}

function Host() {
  const [isHosting, setIsHosting] = useState(false);
  const [_messages, setMessages] = useState<string[]>([]);
  const [clients, setClients] = useState<Channel[]>([]);
  const [gameServer, setGameServer] = useState<HostRuntime>();

  const createClientsPingListPayload = useCallback(
    (channels: Channel[]): ClientsPingListPayload => ({
      ts: Date.now(),
      clients: channels.map((channel) => ({
        clientId: channel.clientId,
        pingMs: channel.latency < 0 ? null : Number(channel.latency.toFixed(2)),
      })),
    }),
    []
  );

  const broadcastClientsPingList = useCallback(
    (channels: Channel[], emitToWorker: (msg: Message) => void) => {
      const payload = createClientsPingListPayload(channels);
      if (channels.length === 0) {
        return;
      }

      channels.forEach((channel) => {
        channel.emit("clients_ping_list", payload, { reliable: true });
      });

      emitToWorker({
        from: WORKER_SERVER_ID,
        to: WORKER_SERVER_ID,
        type: "__clients_ping_list",
        data: encodePayload(payload),
        reliable: true,
      });
    },
    [createClientsPingListPayload]
  );

  useEffect(() => {
    return () => {
      gameServer?.dispose();
    };
  }, [gameServer]);

  useEffect(() => {
    if (!isHosting || !gameServer) {
      return;
    }

    const interval = setInterval(() => {
      setClients((currentClients) => {
        if (currentClients.length === 0) {
          return currentClients;
        }
        const refreshedClients = [...currentClients];
        gameServer.emitToWorkerClientsPingList(refreshedClients);
        return refreshedClients;
      });
    }, 500);

    return () => {
      clearInterval(interval);
    };
  }, [gameServer, isHosting]);

  const handleHostGame = async () => {
    const serverId = await createHostChannelId();
    const router = createRouter(serverId);
    const worker = createWorkerServerWorker();
    const workerAdapter = createWorkerAdapter(WORKER_SERVER_ID, worker);
    workerAdapter.clientIds.add(WORKER_SERVER_ID);
    router.registerAdapter(workerAdapter);

    const emitToWorker = (message: Message) => {
      router.sendMessage(message);
    };

    const manager = createServerWebRTCAdapterManager({ serverId });

    manager.onConnection = (session) => {
      const remoteId = session.remoteId;
      router.registerAdapter(session.adapter);

      const emitter = mitt<Record<string, unknown>>();
      let onDisconnectHandler: ((clientId: string) => void) | undefined;

      const channel: Channel = {
        clientId: remoteId,
        latency: -1,
        on(
          type: string,
          handler:
            | ((from: string, type: string, data: unknown) => void)
            | ((from: string, data: unknown) => void)
        ) {
          if (type === "*") {
            emitter.on(type, (eventType, data) => {
              if (eventType !== "pong") {
                handler(remoteId, eventType, data);
              }
            });
          } else {
            emitter.on(type, (data) =>
              (handler as (from: string, data: unknown) => void)(remoteId, data)
            );
          }
        },
        emit(ev, data, options) {
          const routingMessage: Message = {
            from: WORKER_SERVER_ID,
            to: remoteId,
            type: ev,
            data: encodePayload(data),
            reliable: options?.reliable ?? true,
          };
          router.sendMessage(routingMessage);
        },
        emitRaw(data, options) {
          const routingMessage: Message = {
            from: WORKER_SERVER_ID,
            to: remoteId,
            type: "raw",
            data,
            reliable: options?.reliable ?? true,
          };
          router.sendMessage(routingMessage);
        },
        onDisconnect(handler) {
          onDisconnectHandler = handler;
        },
      };

      const ping = () => {
        channel.emit("ping", { time: Date.now() }, { reliable: true });
      };

      channel.on("pong", (_, data: { time: number }) => {
        const latency = Date.now() - data.time;
        if (channel.latency < 0) {
          channel.latency = latency;
        } else {
          channel.latency = 0.6 * channel.latency + 0.4 * latency;
        }
      });

      const pingInterval = setInterval(ping, 500);

      session.onMessage = (json) => {
        if (isRoutingEnvelope(json.data)) {
          const payload = decodeRoutingEnvelopePayload(json.data);
          if (payload !== undefined) {
            emitter.emit(json.t, payload);
          }
          return;
        }

        emitter.emit(json.t, json.data);

        const routedMessage: Message = {
          from: remoteId,
          to: WORKER_SERVER_ID,
          type: json.t,
          data: encodePayload(json.data),
          reliable: true,
        };
        emitToWorker(routedMessage);
      };

      session.onDisconnected = () => {
        clearInterval(pingInterval);
        router.adapters.delete(session.adapter.id);
        emitToWorker({
          from: remoteId,
          to: WORKER_SERVER_ID,
          type: "__client_disconnected",
          data: encodePayload({ clientId: remoteId }),
          reliable: true,
        });
        onDisconnectHandler?.(remoteId);
      };

      emitToWorker({
        from: remoteId,
        to: WORKER_SERVER_ID,
        type: "__client_connected",
        data: encodePayload({ clientId: remoteId }),
        reliable: true,
      });

      setClients((currentClients) => {
        const nextClients = [channel, ...currentClients];
        broadcastClientsPingList(nextClients, emitToWorker);
        return nextClients;
      });

      channel.onDisconnect((clientId) => {
        setClients((currentClients) => {
          const nextClients = currentClients.filter(
            (client) => client.clientId !== clientId
          );
          broadcastClientsPingList(nextClients, emitToWorker);
          return nextClients;
        });
      });
      channel.on("*", (from, type, data) =>
        setMessages((msgs) => [
          ...msgs,
          `${from}: ${type}: ${JSON.stringify(data)}`,
        ])
      );
    };

    const hostRuntime = {
      serverId,
      emitToWorkerClientsPingList(channels: Channel[]) {
        broadcastClientsPingList(channels, emitToWorker);
      },
      dispose() {
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
                Connected Clients ({clients.length})
              </h2>
              {clients.length === 0 ? (
                <p className="text-[var(--color-text-secondary)] text-sm text-center py-4 transition-colors duration-200">
                  No clients connected yet. Share your game code to get started!
                </p>
              ) : (
                <div className="space-y-2">
                  {clients.map((client) => (
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
                        {client.latency < 0
                          ? "N/A"
                          : `${client.latency.toFixed(2)}ms`}
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
