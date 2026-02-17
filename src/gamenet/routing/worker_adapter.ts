import type { Adapter } from "./adapter";
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
      if (this.onReceiveMessage) {
        // post to the worker
        this.worker.postMessage(message, [message.data]);
      }
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
