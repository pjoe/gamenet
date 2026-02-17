import { Channel, hostGame } from "../game_server";
import { Message } from "./message";
import {
  createWorkerServerAdapterManager,
  WorkerPostMessage,
} from "./worker_adapter";

console.debug("Host server worker script loaded");

const workerScope = self as unknown as {
  postMessage: WorkerPostMessage;
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

workerScope.onmessage = async (event: MessageEvent<Message>) => {
  const message = event.data;
  if (!message || message.type !== "__init") {
    return;
  }

  const serverId = message.from;

  const { manager, handleMessage } = createWorkerServerAdapterManager({
    serverId,
    postMessage: (msg, transfer) => workerScope.postMessage(msg, transfer),
  });

  // Replace onmessage to dispatch all subsequent messages to the adapter manager
  workerScope.onmessage = (ev: MessageEvent<Message>) => {
    const msg = ev.data;
    if (msg) {
      handleMessage(msg);
    }
  };

  const server = await hostGame({
    serverId,
    createAdapterManager: () => manager,
  });

  const channels: Channel[] = [];

  server.onConnection((channel) => {
    channels.push(channel);
    channel.emit("msg", "Welcome to the server!");

    channel.onDisconnect((clientId) => {
      const idx = channels.findIndex((c) => c.clientId === clientId);
      if (idx >= 0) {
        channels.splice(idx, 1);
      }
    });
  });

  // Periodically broadcast clients_ping_list to all connected clients and host UI
  setInterval(() => {
    if (channels.length === 0) {
      return;
    }

    const payload: ClientsPingListPayload = {
      ts: Date.now(),
      clients: channels.map((ch) => ({
        clientId: ch.clientId,
        pingMs: ch.latency < 0 ? null : Number(ch.latency.toFixed(2)),
      })),
    };

    channels.forEach((ch) => {
      ch.emit("clients_ping_list", payload, { reliable: true });
    });
  }, 500);
};
