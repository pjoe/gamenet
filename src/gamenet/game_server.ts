/* eslint-disable @typescript-eslint/no-explicit-any */
import mitt from "mitt";
import { createHostChannelId } from "./channel";
import { PeerConn } from "./peer_conn";
import { getSignalServer } from "./signal_server";

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
  const server: GameServer = {
    serverId,
    peerConns: new Map<string, PeerConn>(),
    dcMap: new Map<RTCDataChannel, PeerConn>(),
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            server.dcMap.set(peer.dc!, peer);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            server.dcMap.set(peer.dcReliable!, peer);
            const emitter = mitt<Events>();
            const onMsg = (ev: MessageEvent<any>) => {
              const dc = ev.target as RTCDataChannel;
              const peer = server.dcMap.get(dc);
              if (!peer) return;
              console.debug("dcMsg", peer.remoteId, dc.label, ev.data);
              const json = JSON.parse(ev.data);
              emitter.emit(json.t, json.data);
            };
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            peer.dc!.onmessage = onMsg;
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
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
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            peer.dc!.onclose = () => {
              console.debug("DataChannel closed", msg.from);
              onDisconnectHandler?.(msg.from);
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
