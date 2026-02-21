import {
  decode as decodeMsgpack,
  encode as encodeMsgpack,
} from "@msgpack/msgpack";
import { PeerConn } from "../peer_conn";
import { getSignalServer, SignalServer } from "../signal_server";
import {
  Adapter,
  ClientAdapterSession,
  MessageEnvelope,
  SendOptions,
  ServerAdapterManager,
  ServerAdapterSession,
} from "./adapter";
import { Message } from "./message";

type SignalMsg = {
  from: string;
  t: string;
  data: unknown;
};

type Envelope = MessageEnvelope;

type RoutingWireMessage = {
  from: string;
  to: string;
  type: string;
  reliable: boolean;
  data: Uint8Array;
};

const EMPTY_BUFFER = new ArrayBuffer(0);

export type WebRTCSendOptions = SendOptions;

export type WebRTCAdapter = Adapter;

export type ClientWebRTCAdapterSession = ClientAdapterSession<
  WebRTCAdapter,
  Envelope
>;

export interface CreateClientWebRTCAdapterSessionArgs {
  clientId: string;
  serverId: string;
  nickname?: string;
  signalServer?: SignalServer;
}

export interface ServerWebRTCAdapterSession extends ServerAdapterSession {
  remoteId: string;
  adapter: WebRTCAdapter;
  onDisconnected?: () => void;
  onMessage?: (envelope: Envelope) => void;
  sendMessage: (msg: Envelope, options?: WebRTCSendOptions) => void;
  sendRaw: (msg: ArrayBuffer, options?: WebRTCSendOptions) => void;
  dispose: () => void;
}

export interface ServerWebRTCAdapterManager extends ServerAdapterManager<ServerWebRTCAdapterSession> {
  sessions: Map<string, ServerWebRTCAdapterSession>;
  onConnection?: (session: ServerWebRTCAdapterSession) => void;
}

export interface CreateServerWebRTCAdapterManagerArgs {
  serverId: string;
  signalServer?: SignalServer;
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
}

function encodeRoutingWireMessage(message: Message): ArrayBuffer {
  const payload: RoutingWireMessage = {
    from: message.from,
    to: message.to,
    type: message.type,
    reliable: message.reliable,
    data: new Uint8Array(message.data),
  };
  return toArrayBuffer(encodeMsgpack(payload));
}

function decodeRoutingWireMessage(
  payload: ArrayBuffer,
  fallbackReliable: boolean
): Message | undefined {
  try {
    const decoded = decodeMsgpack(
      new Uint8Array(payload)
    ) as Partial<RoutingWireMessage>;
    let decodedData: ArrayBuffer | undefined;
    const decodedWireData = decoded.data as unknown;
    if (decodedWireData instanceof Uint8Array) {
      decodedData = toArrayBuffer(decodedWireData);
    } else if (decodedWireData instanceof ArrayBuffer) {
      decodedData = decodedWireData;
    } else if (ArrayBuffer.isView(decodedWireData)) {
      const view = new Uint8Array(
        decodedWireData.buffer,
        decodedWireData.byteOffset,
        decodedWireData.byteLength
      );
      decodedData = toArrayBuffer(view);
    }

    if (
      typeof decoded.from !== "string" ||
      typeof decoded.to !== "string" ||
      typeof decoded.type !== "string" ||
      !decodedData
    ) {
      return undefined;
    }

    return {
      from: decoded.from,
      to: decoded.to,
      type: decoded.type,
      data: decodedData,
      reliable:
        typeof decoded.reliable === "boolean"
          ? decoded.reliable
          : fallbackReliable,
    };
  } catch {
    return undefined;
  }
}

export function createWebRTCAdapter(
  id: string,
  remoteId: string,
  sendRawFrame: (msg: ArrayBuffer, options?: WebRTCSendOptions) => void
): WebRTCAdapter {
  const adapter: WebRTCAdapter = {
    id,
    clientIds: new Set<string>([remoteId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
      sendRawFrame(encodeRoutingWireMessage(message), {
        reliable: message.reliable,
      });
    },
    emitMessage(message: Message) {
      this.onEmitMessage?.(message);
    },
  };

  return adapter;
}

function bindPeerDataChannels(
  peer: PeerConn,
  onPayload: (payload: ArrayBuffer, reliable: boolean) => void,
  onClose: () => void
) {
  let closed = false;
  const onMsg = (ev: MessageEvent<unknown>) => {
    const dc = ev.target as RTCDataChannel;
    const isReliable = dc === peer.dcReliable;

    if (ev.data instanceof ArrayBuffer) {
      onPayload(ev.data, isReliable);
      return;
    }

    if (ArrayBuffer.isView(ev.data)) {
      const view = new Uint8Array(
        ev.data.buffer,
        ev.data.byteOffset,
        ev.data.byteLength
      );
      onPayload(toArrayBuffer(view), isReliable);
      return;
    }

    console.warn("Unsupported RTC payload type", {
      type: typeof ev.data,
      ctor: (ev.data as { constructor?: { name?: string } })?.constructor?.name,
    });
  };
  const handleClose = () => {
    if (closed) {
      return;
    }
    closed = true;
    onClose();
  };

  if (peer.dc) {
    peer.dc.onmessage = onMsg;
    peer.dc.onclose = handleClose;
  }
  if (peer.dcReliable) {
    peer.dcReliable.onmessage = onMsg;
    peer.dcReliable.onclose = handleClose;
  }
}

export function createClientWebRTCAdapterSession(
  args: CreateClientWebRTCAdapterSessionArgs
): ClientWebRTCAdapterSession {
  const signalServer = args.signalServer ?? getSignalServer();
  let peerConn: PeerConn | undefined;
  let disposed = false;

  const sendSignal = signalServer.send.bind(null, args.clientId);

  const cleanupAdapter = () => {
    if (!session.adapter) {
      return;
    }
    if (session.adapter.onClientRemove) {
      session.adapter.onClientRemove(args.serverId);
    }
    session.adapter = undefined;
  };

  const session: ClientWebRTCAdapterSession = {
    adapter: undefined,
    sendMessage(msg, options) {
      const routingMessage: Message = {
        from: args.clientId,
        to: args.serverId,
        type: msg.t,
        data: msg.data,
        reliable: options?.reliable ?? true,
      };
      peerConn?.sendRaw(encodeRoutingWireMessage(routingMessage), {
        reliable: routingMessage.reliable,
      });
    },
    sendRaw(msg, options) {
      const routingMessage: Message = {
        from: args.clientId,
        to: args.serverId,
        type: "raw",
        data: msg,
        reliable: options?.reliable ?? true,
      };
      peerConn?.sendRaw(encodeRoutingWireMessage(routingMessage), {
        reliable: routingMessage.reliable,
      });
    },
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      signalServer.unsubscribe();
      cleanupAdapter();
      peerConn?.close();
      peerConn = undefined;
    },
  };

  signalServer.subscribe(args.clientId, (message) => {
    if (disposed) {
      return;
    }

    const msg = JSON.parse(message) as SignalMsg;
    switch (msg.t) {
      case "joined": {
        peerConn = new PeerConn(
          { send: sendSignal },
          args.clientId,
          args.serverId
        );
        peerConn.onConnected = (peer) => {
          signalServer.unsubscribe();

          const adapter = createWebRTCAdapter(
            args.clientId,
            args.serverId,
            (m, o) => peer.sendRaw(m, o)
          );
          session.adapter = adapter;

          bindPeerDataChannels(
            peer,
            (payload, reliable) => {
              if (!session.adapter) {
                return;
              }
              const routingMessage = decodeRoutingWireMessage(
                payload,
                reliable
              );
              if (!routingMessage) {
                return;
              }
              if (routingMessage.to !== args.clientId) {
                session.adapter.emitMessage(routingMessage);
              }
              session.onMessage?.({
                t: routingMessage.type,
                data: routingMessage.data,
              });
            },
            () => {
              cleanupAdapter();
              session.onDisconnected?.();
            }
          );

          session.sendMessage(
            { t: "join", data: EMPTY_BUFFER },
            { reliable: true }
          );
          session.onConnected?.(adapter);
        };
        peerConn.offer();
        break;
      }
      case "candidate":
        peerConn?.incomingCandidate(msg);
        break;
      case "answer":
        peerConn?.incomingAnswer(msg);
        break;
    }
  });

  sendSignal(args.serverId, "join", {
    nickname: args.nickname?.trim() || undefined,
  });

  return session;
}

export function createServerWebRTCAdapterManager(
  args: CreateServerWebRTCAdapterManagerArgs
): ServerWebRTCAdapterManager {
  const signalServer = args.signalServer ?? getSignalServer();
  const sessions = new Map<string, ServerWebRTCAdapterSession>();
  const peerConns = new Map<string, PeerConn>();
  const pendingNicknames = new Map<string, string>();
  let disposed = false;

  const manager: ServerWebRTCAdapterManager = {
    sessions,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      signalServer.unsubscribe();
      for (const session of sessions.values()) {
        session.dispose();
      }
      sessions.clear();
      peerConns.clear();
      pendingNicknames.clear();
    },
  };

  const sendSignal = signalServer.send.bind(null, args.serverId);

  signalServer.subscribe(args.serverId, (message) => {
    if (disposed) {
      return;
    }

    const msg = JSON.parse(message) as SignalMsg;
    switch (msg.t) {
      case "join": {
        const nickname =
          typeof msg.data === "object" &&
          msg.data !== null &&
          "nickname" in msg.data &&
          typeof (msg.data as { nickname?: unknown }).nickname === "string"
            ? (msg.data as { nickname: string }).nickname.trim()
            : "";
        pendingNicknames.set(msg.from, nickname || msg.from);
        sendSignal(msg.from, "joined");
        break;
      }
      case "offer": {
        const remoteId = msg.from;
        const peer = new PeerConn(
          { send: sendSignal },
          args.serverId,
          remoteId
        );
        peerConns.set(remoteId, peer);

        peer.onConnected = (connectedPeer) => {
          const adapterId = `${args.serverId}:${remoteId}`;
          const adapter = createWebRTCAdapter(adapterId, remoteId, (m, o) =>
            connectedPeer.sendRaw(m, o)
          );

          const session: ServerWebRTCAdapterSession = {
            remoteId,
            nickname: pendingNicknames.get(remoteId) ?? remoteId,
            adapter,
            sendMessage(message, options) {
              const routingMessage: Message = {
                from: args.serverId,
                to: remoteId,
                type: message.t,
                data: message.data,
                reliable: options?.reliable ?? true,
              };
              connectedPeer.sendRaw(encodeRoutingWireMessage(routingMessage), {
                reliable: routingMessage.reliable,
              });
            },
            sendRaw(message, options) {
              const routingMessage: Message = {
                from: args.serverId,
                to: remoteId,
                type: "raw",
                data: message,
                reliable: options?.reliable ?? true,
              };
              connectedPeer.sendRaw(encodeRoutingWireMessage(routingMessage), {
                reliable: routingMessage.reliable,
              });
            },
            dispose() {
              if (session.adapter.onClientRemove) {
                session.adapter.onClientRemove(remoteId);
              }
              sessions.delete(remoteId);
              peerConns.delete(remoteId);
              pendingNicknames.delete(remoteId);
              connectedPeer.close();
            },
          };

          bindPeerDataChannels(
            connectedPeer,
            (payload, reliable) => {
              const routingMessage = decodeRoutingWireMessage(
                payload,
                reliable
              );
              if (!routingMessage) {
                return;
              }
              if (routingMessage.to !== args.serverId) {
                adapter.emitMessage(routingMessage);
              }
              session.onMessage?.({
                t: routingMessage.type,
                data: routingMessage.data,
              });
            },
            () => {
              if (session.adapter.onClientRemove) {
                session.adapter.onClientRemove(remoteId);
              }
              sessions.delete(remoteId);
              peerConns.delete(remoteId);
              pendingNicknames.delete(remoteId);
              session.onDisconnected?.();
            }
          );

          sessions.set(remoteId, session);
          manager.onConnection?.(session);
        };

        peer.incomingOffer(msg);
        break;
      }
      case "candidate":
        peerConns.get(msg.from)?.incomingCandidate(msg);
        break;
    }
  });

  return manager;
}
