/* eslint-disable @typescript-eslint/no-explicit-any */
import mitt, { Emitter } from "mitt";
import { createClientChannelId } from "./channel";
import {
  Adapter,
  ClientAdapterSession,
  MessageEnvelope,
  SendOptions,
} from "./routing/adapter";
import { createClientWebRTCAdapterSession } from "./routing/adapter_webrtc";
import { createClient } from "./routing/client";
import { decodeRoutingEnvelopePayload } from "./routing/envelope_payload";
import { createRouter, Router } from "./routing/router";

type EmitOptions = SendOptions;
type Events = Record<string, any>;
export interface GameClient {
  serverId: string;
  clientId: string;
  extraLatency: number;
  router: Router;
  adapter?: Adapter;
  on: Emitter<Events>["on"];
  emit: (ev: string, e: any, options?: EmitOptions) => void;
  emitRaw: (e: ArrayBuffer, options?: EmitOptions) => void;
  onConnected: (handler: () => void) => void;
  onDisconnected: (handler: () => void) => void;
  dispose: () => void;
}

export interface JoinGameArgs {
  serverId: string;
  extraLatency?: number;
  createAdapterSession?: (args: {
    clientId: string;
    serverId: string;
  }) => ClientAdapterSession;
}

export async function joinGame(args: JoinGameArgs): Promise<GameClient> {
  const extraLatency = args.extraLatency ?? 0;
  const clientId = createClientChannelId();
  const router = createRouter(clientId);
  router.registerClient(createClient(clientId));
  const session =
    args.createAdapterSession?.({
      clientId,
      serverId: args.serverId,
    }) ??
    createClientWebRTCAdapterSession({
      clientId,
      serverId: args.serverId,
    });
  const emitter = mitt<Events>();
  let onConnectedHandler: () => void;
  let onDisconnectedHandler: () => void;
  const gameClient: GameClient = {
    serverId: args.serverId,
    clientId,
    extraLatency,
    router,
    on(
      type: string,
      handler: ((type: string, data: any) => void) | ((data: any) => void)
    ) {
      if (type === "*") {
        emitter.on(type, (type, data) => {
          // filter out pings
          if (type !== "ping") handler(type, data);
        });
      } else {
        emitter.on(type, (data) => (handler as (data: any) => void)(data));
      }
    },
    emit(t, data, options?) {
      if (this.extraLatency > 0) {
        setTimeout(
          () => session.sendJSON({ t, data }, options),
          this.extraLatency * 0.5
        );
      } else {
        session.sendJSON({ t, data }, options);
      }
    },
    emitRaw(data, options?) {
      if (this.extraLatency > 0) {
        setTimeout(
          () => session.sendRaw(data, options),
          this.extraLatency * 0.5
        );
      } else {
        session.sendRaw(data, options);
      }
    },
    onConnected: (handler) => {
      onConnectedHandler = handler;
    },
    onDisconnected: (handler) => {
      onDisconnectedHandler = handler;
    },
    dispose() {
      session.dispose();
    },
  };

  session.onConnected = (adapter: Adapter) => {
    gameClient.adapter = adapter;
    gameClient.router.registerAdapter(adapter);
    emitter.on("ping", (data: { time: number }) => {
      gameClient.emit("pong", data);
    });
    onConnectedHandler?.();
  };

  session.onMessage = (json: MessageEnvelope) => {
    const decodedPayload = decodeRoutingEnvelopePayload(json.data);
    const eventData = decodedPayload ?? json.data;

    if (gameClient.extraLatency > 0) {
      setTimeout(
        () => emitter.emit(json.t, eventData),
        gameClient.extraLatency * 0.5
      );
    } else {
      emitter.emit(json.t, eventData);
    }
  };

  session.onDisconnected = () => {
    if (gameClient.adapter) {
      gameClient.router.adapters.delete(gameClient.adapter.id);
      gameClient.adapter = undefined;
    }
    onDisconnectedHandler?.();
  };

  return gameClient;
}
