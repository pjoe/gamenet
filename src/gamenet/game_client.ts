/* eslint-disable @typescript-eslint/no-explicit-any */
import mitt, { Emitter } from "mitt";
import { createClientChannelId } from "./channel";
import { PeerConn } from "./peer_conn";
import { getSignalServer } from "./signal_server";

type EmitOptions = Parameters<PeerConn["sendJSON"]>[1];
type Events = Record<string, any>;
export interface GameClient {
  serverId: string;
  clientId: string;
  peerConn?: PeerConn;
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
}

export async function joinGame(args: joinGameArgs): Promise<GameClient> {
  const clientId = createClientChannelId();
  const signalServer = getSignalServer();
  const emitter = mitt<Events>();
  let onConnectedHandler: () => void;
  let onDisconnectedHandler: () => void;
  const gameClient: GameClient = {
    serverId: args.serverId,
    clientId,
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
    emit: (t, data, options?) =>
      gameClient.peerConn?.sendJSON({ t, data }, options),
    emitRaw: (data, options?) => gameClient.peerConn?.sendRaw(data, options),
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
  const onMsg = (ev: MessageEvent<any>) => {
    const dc = ev.target as RTCDataChannel;
    const peer = gameClient.peerConn;
    if (!peer) return;
    console.debug("dcMsg", peer.remoteId, dc.label, ev.data);
    const json = JSON.parse(ev.data);
    emitter.emit(json.t, json.data);
  };
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
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          peer.dc!.onmessage = onMsg;
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          peer.dcReliable!.onmessage = onMsg;
          peer.sendJSON({ t: "join" }, { reliable: true });
          // pings
          emitter.on("ping", (data: { time: number }) => {
            gameClient.emit("pong", data);
          });
          onConnectedHandler?.();
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          peer.dc!.onclose = () => {
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
