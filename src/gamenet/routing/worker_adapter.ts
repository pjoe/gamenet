import type {
  Adapter,
  MessageEnvelope,
  SendOptions,
  ServerAdapterManager,
  ServerAdapterSession,
} from "./adapter";
import type { Message } from "./message";

export interface WorkerAdapter extends Adapter {
  worker: Worker;
}

// create adapter that handles clients in a web worker
export function createWorkerAdapter(id: string, worker: Worker): Adapter {
  const adapter: WorkerAdapter = {
    id,
    worker,
    clientIds: new Set<string>(),
    receiveMessage(message) {
      // handle message from router
      this.onReceiveMessage?.(message);
      // post to the worker
      this.worker.postMessage(message, [message.data]);
    },
    emitMessage(message) {
      if (this.onEmitMessage) {
        this.onEmitMessage(message);
      }
    },
  };
  worker.onmessage = (event) => {
    const message: Message = event.data;
    // handle message from worker
    adapter.emitMessage(message);
  };
  return adapter;
}

// --- Worker-side (runs inside a Web Worker) ---

export type WorkerPostMessage = (
  message: Message,
  transfer: Transferable[]
) => void;

export interface WorkerServerAdapterManagerArgs {
  serverId: string;
  postMessage: WorkerPostMessage;
}

export interface WorkerServerAdapterManagerResult {
  manager: ServerAdapterManager;
  handleMessage: (message: Message) => void;
}

function encodePayload(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer as ArrayBuffer;
}

function decodePayload<T = unknown>(data: ArrayBuffer): T | undefined {
  try {
    const text = new TextDecoder().decode(new Uint8Array(data));
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

/**
 * Creates a ServerAdapterManager that runs inside a Web Worker.
 * The main thread sends control messages (__client_connected, __client_disconnected)
 * and game messages through postMessage. Each client gets a ServerAdapterSession
 * whose sendJSON/sendRaw post Messages back to the main thread.
 */
export function createWorkerServerAdapterManager(
  args: WorkerServerAdapterManagerArgs
): WorkerServerAdapterManagerResult {
  const { serverId, postMessage } = args;
  const sessions = new Map<string, ServerAdapterSession>();

  const manager: ServerAdapterManager = {
    sessions,
    dispose() {
      for (const session of sessions.values()) {
        session.dispose();
      }
      sessions.clear();
    },
  };

  function createSession(clientId: string): ServerAdapterSession {
    const adapter: Adapter = {
      id: `${serverId}:${clientId}`,
      clientIds: new Set<string>([clientId]),
      receiveMessage(_message: Message) {
        // no-op: messages go through postMessage, not the adapter
      },
      emitMessage(_message: Message) {
        // no-op: inbound messages are dispatched via handleMessage
      },
    };

    const session: ServerAdapterSession = {
      remoteId: clientId,
      adapter,
      sendJSON(msg: unknown, options?: SendOptions) {
        const envelope = msg as MessageEnvelope;
        const message: Message = {
          from: serverId,
          to: clientId,
          type: envelope.t,
          data: encodePayload(envelope.data),
          reliable: options?.reliable ?? true,
        };
        postMessage(message, [message.data]);
      },
      sendRaw(data: ArrayBuffer, options?: SendOptions) {
        const message: Message = {
          from: serverId,
          to: clientId,
          type: "raw",
          data,
          reliable: options?.reliable ?? true,
        };
        postMessage(message, [message.data]);
      },
      dispose() {
        sessions.delete(clientId);
      },
    };

    return session;
  }

  function handleMessage(message: Message) {
    if (message.type === "__client_connected") {
      const clientId = message.from;
      if (sessions.has(clientId)) {
        return;
      }
      const session = createSession(clientId);
      sessions.set(clientId, session);
      manager.onConnection?.(session);
      return;
    }

    if (message.type === "__client_disconnected") {
      const clientId = message.from;
      const session = sessions.get(clientId);
      if (session) {
        session.onDisconnected?.();
        sessions.delete(clientId);
      }
      return;
    }

    // Regular game message — dispatch to the appropriate session
    const session = sessions.get(message.from);
    if (session) {
      const decoded = decodePayload(message.data);
      session.onMessage?.({ t: message.type, data: decoded });
    }
  }

  return { manager, handleMessage };
}
