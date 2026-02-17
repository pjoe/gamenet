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

export type WebRTCSendOptions = SendOptions;

export interface WebRTCAdapter extends Adapter {
  sendJSON: (msg: unknown, options?: WebRTCSendOptions) => void;
}

export type ClientWebRTCAdapterSession = ClientAdapterSession<
  WebRTCAdapter,
  Envelope
>;

export interface CreateClientWebRTCAdapterSessionArgs {
  clientId: string;
  serverId: string;
  signalServer?: SignalServer;
}

export interface ServerWebRTCAdapterSession extends ServerAdapterSession {
  remoteId: string;
  adapter: WebRTCAdapter;
  onDisconnected?: () => void;
  onMessage?: (envelope: Envelope) => void;
  sendJSON: (msg: unknown, options?: WebRTCSendOptions) => void;
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

/**
 * Creates a WebRTC adapter that bridges routing messages to/from a PeerConn.
 *
 * Outbound: routing Message -> WebRTC data channel envelope { t, data }
 * - Maps Message.type to envelope.t
 * - Converts Message.data (ArrayBuffer) to base64 string for JSON transport
 * - Selects reliable/unreliable channel based on Message.reliable
 *
 * Inbound: WebRTC envelope -> routing Message
 * - Extracts type from envelope.t
 * - Decodes base64 data back to ArrayBuffer
 * - Routes to local clients via adapter.emitMessage
 *
 * @param id - Local adapter identifier (typically local client/server ID)
 * @param remoteId - Remote peer identifier (typically remote client/server ID)
 * @param peerConn - Established PeerConn instance
 */
export function createWebRTCAdapter(
  id: string,
  remoteId: string,
  sendJSON: (msg: unknown, options?: WebRTCSendOptions) => void
): WebRTCAdapter {
  const adapter: WebRTCAdapter = {
    id,
    sendJSON,
    clientIds: new Set<string>([remoteId]),
    receiveMessage(message: Message) {
      // Handle outbound message from router to remote peer
      if (this.onReceiveMessage) {
        this.onReceiveMessage(message);
      }

      // Convert ArrayBuffer to base64 for JSON transport
      const base64Data = arrayBufferToBase64(message.data);

      // Create envelope compatible with existing { t, data } format
      const envelope = {
        t: message.type,
        data: {
          from: message.from,
          to: message.to,
          payload: base64Data,
        },
      };

      // Send over appropriate channel based on reliability
      sendJSON(envelope, { reliable: message.reliable });
    },
    emitMessage(message: Message) {
      if (this.onEmitMessage) {
        this.onEmitMessage(message);
      }
    },
  };

  return adapter;
}

/**
 * Handles incoming WebRTC messages and converts them to routing Messages.
 * Should be called from data channel onmessage handlers.
 *
 * @param adapter - The WebRTC adapter instance
 * @param envelope - Parsed JSON envelope from data channel
 * @param reliable - Whether message came from reliable channel
 */
export function handleIncomingWebRTCMessage(
  adapter: WebRTCAdapter,
  envelope: Envelope,
  reliable: boolean
) {
  // Check if this is a routing message (has routing-specific structure)
  if (
    envelope.data &&
    typeof envelope.data === "object" &&
    "from" in envelope.data &&
    "to" in envelope.data &&
    "payload" in envelope.data
  ) {
    const data = envelope.data as {
      from: unknown;
      to: unknown;
      payload: unknown;
    };

    // Validate that fields are strings
    if (
      typeof data.from === "string" &&
      typeof data.to === "string" &&
      typeof data.payload === "string"
    ) {
      try {
        // Decode base64 payload back to ArrayBuffer
        const arrayBuffer = base64ToArrayBuffer(data.payload);

        // Create routing Message
        const message: Message = {
          from: data.from,
          to: data.to,
          type: envelope.t,
          data: arrayBuffer,
          reliable,
        };

        // Emit to router for routing to destination
        adapter.emitMessage(message);
      } catch (error) {
        console.warn("Failed to decode routing message:", error);
      }
    }
  }
  // If not a routing message, ignore it (preserves existing non-routing behavior)
}

function bindPeerDataChannels(
  peer: PeerConn,
  onEnvelope: (envelope: Envelope, reliable: boolean) => void,
  onClose: () => void
) {
  const onMsg = (ev: MessageEvent<unknown>) => {
    const dc = ev.target as RTCDataChannel;
    if (ev.data && typeof ev.data === "object" && "t" in ev.data) {
      const isReliable = dc === peer.dcReliable;
      onEnvelope(ev.data as Envelope, isReliable);
      return;
    }

    let data: string | undefined;
    if (typeof ev.data === "string") {
      data = ev.data;
    } else if (ev.data instanceof ArrayBuffer) {
      data = new TextDecoder().decode(new Uint8Array(ev.data));
    } else if (ArrayBuffer.isView(ev.data)) {
      data = new TextDecoder().decode(ev.data);
    }

    if (!data) {
      return;
    }
    try {
      const json = JSON.parse(data) as Envelope;
      const isReliable = dc === peer.dcReliable;
      onEnvelope(json, isReliable);
    } catch {
      return;
    }
  };
  const handleClose = () => onClose();

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
    sendJSON(msg, options) {
      peerConn?.sendJSON(msg, options);
    },
    sendRaw(msg, options) {
      peerConn?.sendRaw(msg, options);
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
            (m, o) => peer.sendJSON(m, o)
          );
          session.adapter = adapter;

          bindPeerDataChannels(
            peer,
            (envelope, reliable) => {
              if (!session.adapter) {
                return;
              }
              handleIncomingWebRTCMessage(session.adapter, envelope, reliable);
              session.onMessage?.(envelope);
            },
            () => {
              cleanupAdapter();
              session.onDisconnected?.();
            }
          );

          peer.sendJSON({ t: "join" }, { reliable: true });
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

  sendSignal(args.serverId, "join");

  return session;
}

export function createServerWebRTCAdapterManager(
  args: CreateServerWebRTCAdapterManagerArgs
): ServerWebRTCAdapterManager {
  const signalServer = args.signalServer ?? getSignalServer();
  const sessions = new Map<string, ServerWebRTCAdapterSession>();
  const peerConns = new Map<string, PeerConn>();
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
    },
  };

  const sendSignal = signalServer.send.bind(null, args.serverId);

  signalServer.subscribe(args.serverId, (message) => {
    if (disposed) {
      return;
    }

    const msg = JSON.parse(message) as SignalMsg;
    switch (msg.t) {
      case "join":
        sendSignal(msg.from, "joined");
        break;
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
            connectedPeer.sendJSON(m, o)
          );

          const session: ServerWebRTCAdapterSession = {
            remoteId,
            adapter,
            sendJSON(message, options) {
              connectedPeer.sendJSON(message, options);
            },
            sendRaw(message, options) {
              connectedPeer.sendRaw(message, options);
            },
            dispose() {
              if (session.adapter.onClientRemove) {
                session.adapter.onClientRemove(remoteId);
              }
              sessions.delete(remoteId);
              peerConns.delete(remoteId);
              connectedPeer.close();
            },
          };

          bindPeerDataChannels(
            connectedPeer,
            (envelope, reliable) => {
              handleIncomingWebRTCMessage(adapter, envelope, reliable);
              session.onMessage?.(envelope);
            },
            () => {
              if (session.adapter.onClientRemove) {
                session.adapter.onClientRemove(remoteId);
              }
              sessions.delete(remoteId);
              peerConns.delete(remoteId);
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

/**
 * Utility: Convert ArrayBuffer to base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility: Convert base64 string to ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
