/* eslint-disable @typescript-eslint/no-explicit-any */
import mitt from "mitt";
import { createHostChannelId } from "./channel";
import {
  Adapter,
  SendOptions,
  ServerAdapterManager,
  ServerAdapterSession,
} from "./routing/adapter";
import { createServerWebRTCAdapterManager } from "./routing/adapter_webrtc";
import { createRouter, Router } from "./routing/router";

type EmitOptions = SendOptions;

type Events = Record<string, unknown>;

export interface Channel {
  clientId: string;
  latency: number;
  on<Key extends keyof Events>(
    type: Key,
    handler: (from: string, data: any) => void
  ): void;
  on(type: "*", handler: (from: string, type: string, data: any) => void): void;
  emit: (ev: string, e: any, options?: EmitOptions) => void;
  emitRaw: (e: ArrayBuffer, options?: EmitOptions) => void;
  onDisconnect: (handler: (clientId: string) => void) => void;
}

export interface GameServer {
  serverId: string;
  sessions: Map<string, ServerAdapterSession>;
  router: Router;
  adapters: Map<string, Adapter>;
  onConnection: (handler: (channel: Channel) => void) => void;
  dispose: () => void;
}

export interface HostGameArgs {
  createAdapterManager?: (args: { serverId: string }) => ServerAdapterManager;
}

export async function hostGame(args: HostGameArgs = {}): Promise<GameServer> {
  const serverId = await createHostChannelId();
  let onConnectionHandler: (channel: Channel) => void;
  const manager =
    args.createAdapterManager?.({ serverId }) ??
    createServerWebRTCAdapterManager({ serverId });
  const router = createRouter(serverId);
  const server: GameServer = {
    serverId,
    sessions: manager.sessions,
    router,
    adapters: new Map<string, Adapter>(),
    onConnection(handler) {
      onConnectionHandler = handler;
    },
    dispose() {
      manager.dispose();
    },
  };

  manager.onConnection = (session: ServerAdapterSession) => {
    const remoteId = session.remoteId;
    server.adapters.set(remoteId, session.adapter);
    server.router.registerAdapter(session.adapter);

    const emitter = mitt<Events>();
    let onDisconnectHandler: (clientId: string) => void;

    session.onMessage = (json: { t: string; data?: unknown }) => {
      emitter.emit(json.t, json.data);
    };

    const channel: Channel = {
      clientId: remoteId,
      latency: -1,
      on(
        type: string,
        handler:
          | ((from: string, type: string, data: any) => void)
          | ((from: string, data: any) => void)
      ) {
        if (type === "*") {
          emitter.on(type, (eventType, data) => {
            if (eventType !== "pong") handler(remoteId, eventType, data);
          });
        } else {
          emitter.on(type, (data) =>
            (handler as (from: string, data: any) => void)(remoteId, data)
          );
        }
      },
      emit: (ev, e, options) => session.sendJSON({ t: ev, data: e }, options),
      emitRaw: (e, options) => session.sendRaw(e, options),
      onDisconnect(handler) {
        onDisconnectHandler = handler;
      },
    };

    function ping() {
      const now = Date.now();
      channel.emit("ping", { time: now });
    }

    channel.on("pong", (_, data: { time: number }) => {
      const now = Date.now();
      const latency = now - data.time;
      if (channel.latency < 0) {
        channel.latency = latency;
      } else {
        channel.latency = 0.6 * channel.latency + 0.4 * latency;
      }
    });

    const pingInterval = setInterval(ping, 500);

    session.onDisconnected = () => {
      clearInterval(pingInterval);
      const adapter = server.adapters.get(remoteId);
      if (adapter) {
        server.router.adapters.delete(adapter.id);
      }
      server.adapters.delete(remoteId);
      onDisconnectHandler?.(remoteId);
    };

    onConnectionHandler(channel);
  };

  return server;
}
