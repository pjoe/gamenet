/* eslint-disable @typescript-eslint/no-explicit-any */
import mitt from "mitt";
import { createHostChannelId } from "./channel";
import { PeerConn } from "./peer_conn";
import { getSignalServer } from "./signal_server";
import { createRouter, Router } from "./routing/router";
import {
  createWebRTCAdapter,
  handleIncomingWebRTCMessage,
  WebRTCAdapter,
} from "./routing/adapter_webrtc";

type EmitOptions = Parameters<PeerConn["sendJSON"]>[1];

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
  peerConns: Map<string, PeerConn>;
  dcMap: Map<RTCDataChannel, PeerConn>;
  router: Router;
  adapters: Map<string, WebRTCAdapter>;
  onConnection: (handler: (channel: Channel) => void) => void;
  dispose: () => void;
}

type signalMsg = {
  from: string;
  t: string;
  data: any;
};

export async function hostGame(): Promise<GameServer> {
  const serverId = await createHostChannelId();
  let onConnectionHandler: (channel: Channel) => void;
  const signalServer = getSignalServer();
  const router = createRouter(serverId);
  const server: GameServer = {
    serverId,
    peerConns: new Map<string, PeerConn>(),
    dcMap: new Map<RTCDataChannel, PeerConn>(),
    router,
    adapters: new Map<string, WebRTCAdapter>(),
    onConnection(handler) {
      onConnectionHandler = handler;
    },
    dispose() {
      signalServer.unsubscribe();
    },
  };
  const send = signalServer.send.bind(null, serverId);
  console.debug("Subscribing to channel:", serverId);
  signalServer.subscribe(serverId, (message) => {
    console.debug("Received message:", serverId, message);
    const msg = JSON.parse(message) as signalMsg;
    switch (msg.t) {
      case "join":
        console.info("Peer request joining:", msg.from);
        send(msg.from, "joined");
        break;
      case "offer":
        {
          const peer = new PeerConn({ send }, serverId, msg.from);
          peer.onConnected = (peer) => {
            console.log("Peer connected");

            server.dcMap.set(peer.dc!, peer);

            server.dcMap.set(peer.dcReliable!, peer);

            // Create WebRTC adapter for routing integration
            const adapter = createWebRTCAdapter(serverId, msg.from, peer);
            server.adapters.set(msg.from, adapter);
            server.router.registerAdapter(adapter);

            const emitter = mitt<Events>();
            const onMsg = (ev: MessageEvent<any>) => {
              const dc = ev.target as RTCDataChannel;
              const peer = server.dcMap.get(dc);
              if (!peer) return;
              console.debug("dcMsg", peer.remoteId, dc.label, ev.data);
              const json = JSON.parse(ev.data);

              // Check if this is a routing message and handle it via adapter
              const isReliable = dc === peer.dcReliable;
              const clientAdapter = server.adapters.get(peer.remoteId);
              if (clientAdapter) {
                handleIncomingWebRTCMessage(clientAdapter, json, isReliable);
              }

              // Also emit via mitt for existing non-routing behavior
              emitter.emit(json.t, json.data);
            };

            peer.dc!.onmessage = onMsg;

            peer.dcReliable!.onmessage = onMsg;
            let onDisconnectHandler: (clientId: string) => void;
            const channel: Channel = {
              clientId: msg.from,
              latency: -1,
              on(
                type: string,
                handler:
                  | ((from: string, type: string, data: any) => void)
                  | ((from: string, data: any) => void)
              ) {
                if (type === "*") {
                  emitter.on(type, (type, data) => {
                    // filter out pongs
                    if (type !== "pong") handler(msg.from, type, data);
                  });
                } else {
                  emitter.on(type, (data) =>
                    (handler as (from: string, data: any) => void)(
                      msg.from,
                      data
                    )
                  );
                }
              },
              emit: (ev, e, options) =>
                peer.sendJSON({ t: ev, data: e }, options),
              emitRaw: (e, options) => peer.sendRaw(e, options),
              onDisconnect(handler) {
                onDisconnectHandler = handler;
              },
            };

            // pings
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
            setInterval(ping, 500);

            onConnectionHandler(channel);

            peer.dc!.onclose = () => {
              console.debug("DataChannel closed", peer.remoteId);
              // Clean up routing adapter
              const adapter = server.adapters.get(peer.remoteId);
              if (adapter) {
                // Remove all routes for this adapter's clients
                if (adapter.onClientRemove) {
                  adapter.onClientRemove(peer.remoteId);
                }
                // Remove adapter from router
                server.router.adapters.delete(adapter.id);
              }
              server.adapters.delete(peer.remoteId);
              onDisconnectHandler?.(peer.remoteId);
            };
          };
          server.peerConns.set(msg.from, peer);
          peer.incomingOffer(msg);
        }
        break;
      case "candidate":
        server.peerConns.get(msg.from)?.incomingCandidate(msg);
        break;
    }
  });
  console.debug("Subscribed to channel:", serverId);

  return server;
}
