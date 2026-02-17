import { Message } from "./message";

console.debug("Host server worker script loaded");

const WORKER_SERVER_ID = "host-worker";
const workerScope = self as unknown as {
  postMessage: (message: Message, transfer: ArrayBuffer[]) => void;
  onmessage: ((event: MessageEvent<Message>) => void) | null;
};

interface ClientsPingListEntry {
  clientId: string;
  pingMs: number | null;
}

interface ClientsPingListPayload {
  ts: number;
  clients: ClientsPingListEntry[];
}

const connectedClientIds = new Set<string>();

function encodePayload(data: unknown): ArrayBuffer {
  return new TextEncoder().encode(JSON.stringify(data)).buffer;
}

function decodePayload<T = unknown>(data: ArrayBuffer): T | undefined {
  try {
    const text = new TextDecoder().decode(new Uint8Array(data));
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

function emitToClient(clientId: string, type: string, data: unknown) {
  const message: Message = {
    from: WORKER_SERVER_ID,
    to: clientId,
    type,
    data: encodePayload(data),
    reliable: true,
  };
  workerScope.postMessage(message, [message.data]);
}

function broadcast(type: string, data: unknown) {
  connectedClientIds.forEach((clientId) => {
    emitToClient(clientId, type, data);
  });
}

workerScope.onmessage = (event: MessageEvent<Message>) => {
  const message = event.data;
  if (!message || message.to !== WORKER_SERVER_ID) {
    return;
  }

  if (message.type === "__client_connected") {
    connectedClientIds.add(message.from);
    emitToClient(message.from, "msg", "Welcome to the server!");
    return;
  }

  if (message.type === "__client_disconnected") {
    connectedClientIds.delete(message.from);
    return;
  }

  if (message.type === "__clients_ping_list") {
    const payload = decodePayload<ClientsPingListPayload>(message.data);
    if (payload) {
      broadcast("clients_ping_list", payload);
    }
    return;
  }
};
