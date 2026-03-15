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
import { createRouter, Router } from "./routing/router";
import { defaultPayloadSerde, PayloadSerde } from "./serde";

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
  setExtraLatency: (latency: number) => void;
  onConnected: (handler: () => void) => void;
  onDisconnected: (handler: () => void) => void;
  dispose: () => void;
}

export interface JoinGameArgs {
  serverId: string;
  nickname?: string;
  extraLatency?: number;
  payloadSerde?: PayloadSerde;
  createAdapterSession?: (args: {
    clientId: string;
    serverId: string;
    nickname?: string;
  }) => ClientAdapterSession;
}

export async function joinGame(args: JoinGameArgs): Promise<GameClient> {
  const extraLatency = args.extraLatency ?? 0;
  const nickname = args.nickname?.trim() || undefined;
  const payloadSerde = args.payloadSerde ?? defaultPayloadSerde;
  const clientId = createClientChannelId();
  const router = createRouter(clientId);
  router.registerClient(createClient(clientId));
  const session =
    args.createAdapterSession?.({
      clientId,
      serverId: args.serverId,
      nickname,
    }) ??
    createClientWebRTCAdapterSession({
      clientId,
      serverId: args.serverId,
      nickname,
    });
  const emitter = mitt<Events>();
  const wildcardHandlers = new Set<(type: string, data: any) => void>();
  let onConnectedHandler: () => void;
  let onDisconnectedHandler: () => void;
  const dispatchIncomingMessage = (eventType: string, eventData: any) => {
    emitter.emit(eventType, eventData);
    if (eventType !== "ping") {
      wildcardHandlers.forEach((handler) => {
        handler(eventType, eventData);
      });
    }
  };
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
        wildcardHandlers.add(handler as (type: string, data: any) => void);
      } else {
        emitter.on(type, (data) => (handler as (data: any) => void)(data));
      }
    },
    emit(t, data, options?) {
      const envelope: MessageEnvelope = {
        t,
        data: payloadSerde.encode(data),
      };
      if (this.extraLatency > 0) {
        setTimeout(
          () => session.sendMessage(envelope, options),
          this.extraLatency * 0.5
        );
      } else {
        session.sendMessage(envelope, options);
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
    setExtraLatency(latency) {
      this.extraLatency = latency;
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
      gameClient.emit("pong", { ...data, clientTime: Date.now() });
    });
    onConnectedHandler?.();
  };

  session.onMessage = (json: MessageEnvelope) => {
    const eventData = payloadSerde.decode(json.data);

    if (gameClient.extraLatency > 0) {
      setTimeout(
        () => dispatchIncomingMessage(json.t, eventData),
        gameClient.extraLatency * 0.5
      );
    } else {
      dispatchIncomingMessage(json.t, eventData);
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
