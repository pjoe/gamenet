import { Adapter } from "./adapter";
import { Message } from "./message";
import { PeerConn } from "../peer_conn";

export interface WebRTCAdapter extends Adapter {
  peerConn: PeerConn;
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
  peerConn: PeerConn
): WebRTCAdapter {
  const adapter: WebRTCAdapter = {
    id,
    peerConn,
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
      peerConn.sendJSON(envelope, { reliable: message.reliable });
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
  envelope: { t: string; data?: unknown },
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
