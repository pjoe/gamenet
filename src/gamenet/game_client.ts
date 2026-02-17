/* eslint-disable @typescript-eslint/no-explicit-any */
import mitt, { Emitter } from "mitt";
import { createClientChannelId } from "./channel";
import { PeerConn } from "./peer_conn";
import { getSignalServer } from "./signal_server";
import { createRouter, Router } from "./routing/router";
import {
  createWebRTCAdapter,
  handleIncomingWebRTCMessage,
  WebRTCAdapter,
} from "./routing/adapter_webrtc";

type EmitOptions = Parameters<PeerConn["sendJSON"]>[1];
type Events = Record<string, any>;
export interface GameClient {
  serverId: string;
  clientId: string;
  extraLatency: number;
  peerConn?: PeerConn;
  router: Router;
  adapter?: WebRTCAdapter;
  on: Emitter<Events>["on"];
  emit: (ev: string, e: any, options?: EmitOptions) => void;
  emitRaw: (e: ArrayBuffer, options?: EmitOptions) => void;
  onConnected: (handler: () => void) => void;
  onDisconnected: (handler: () => void) => void;
  dispose: () => void;
}

type signalMsg = {
  from: string;
  t: string;
  data: any;
};

interface joinGameArgs {
  serverId: string;
  extraLatency?: number;
}

export async function joinGame(args: joinGameArgs): Promise<GameClient> {
  const extraLatency = args.extraLatency ?? 0;
  const clientId = createClientChannelId();
  const signalServer = getSignalServer();
  const router = createRouter(clientId);
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
          () => gameClient.peerConn?.sendJSON({ t, data }, options),
          this.extraLatency * 0.5
        );
      } else {
        gameClient.peerConn?.sendJSON({ t, data }, options);
      }
    },
    emitRaw(data, options?) {
      if (this.extraLatency > 0) {
        setTimeout(
          () => gameClient.peerConn?.sendRaw(data, options),
          this.extraLatency * 0.5
        );
      } else {
        gameClient.peerConn?.sendRaw(data, options);
      }
    },
    onConnected: (handler) => {
      onConnectedHandler = handler;
    },
    onDisconnected: (handler) => {
      onDisconnectedHandler = handler;
    },
    dispose() {
      signalServer.unsubscribe();
      gameClient.peerConn?.close();
    },
  };
  const send = signalServer.send.bind(null, clientId);
  console.debug("Subscribing to channel:", clientId);
  signalServer.subscribe(clientId, (message) => {
    console.debug("Received message:", clientId, message);
    const msg = JSON.parse(message) as signalMsg;
    switch (msg.t) {
      case "joined":
        gameClient.peerConn = new PeerConn({ send }, clientId, args.serverId);
        gameClient.peerConn.onConnected = (peer) => {
          console.log("Peer connected");
          signalServer.unsubscribe();

          // Create WebRTC adapter for routing integration
          const adapter = createWebRTCAdapter(clientId, args.serverId, peer);
          gameClient.adapter = adapter;
          gameClient.router.registerAdapter(adapter);

          // Modified message handler to support routing
          const handleMessage = (ev: MessageEvent<any>) => {
            const dc = ev.target as RTCDataChannel;
            if (!gameClient.peerConn) return;
            console.debug(
              "dcMsg",
              gameClient.peerConn.remoteId,
              dc.label,
              ev.data
            );
            const json = JSON.parse(ev.data);

            // Check if this is a routing message and handle it via adapter
            const isReliable = dc === gameClient.peerConn.dcReliable;
            if (gameClient.adapter) {
              handleIncomingWebRTCMessage(gameClient.adapter, json, isReliable);
            }

            // Also emit via mitt for existing non-routing behavior
            if (gameClient.extraLatency > 0) {
              setTimeout(
                () => emitter.emit(json.t, json.data),
                gameClient.extraLatency * 0.5
              );
            } else {
              emitter.emit(json.t, json.data);
            }
          };

          peer.dc!.onmessage = handleMessage;

          peer.dcReliable!.onmessage = handleMessage;
          peer.sendJSON({ t: "join" }, { reliable: true });
          // pings
          emitter.on("ping", (data: { time: number }) => {
            gameClient.emit("pong", data);
          });
          onConnectedHandler?.();

          peer.dc!.onclose = () => {
            // Clean up routing adapter
            if (gameClient.adapter) {
              if (gameClient.adapter.onClientRemove) {
                gameClient.adapter.onClientRemove(args.serverId);
              }
              // Remove adapter from router
              gameClient.router.adapters.delete(gameClient.adapter.id);
              gameClient.adapter = undefined;
            }
            onDisconnectedHandler?.();
          };
        };
        gameClient.peerConn.offer();
        break;
      case "candidate":
        gameClient.peerConn?.incomingCandidate(msg);
        break;
      case "answer":
        gameClient.peerConn?.incomingAnswer(msg);
        break;
    }
  });
  console.debug("Subscribed to channel:", clientId);
  console.debug("Joining channel:", args.serverId);
  send(args.serverId, "join");
  return gameClient;
}
