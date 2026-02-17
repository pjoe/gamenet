import { GameServer, hostGame } from "../game_server";
import { Message } from "./message";
import {
  createWorkerServerAdapterManager,
  WorkerPostMessage,
} from "./worker_adapter";

export interface HostServerWorkerScope {
  postMessage: WorkerPostMessage;
  onmessage: ((event: MessageEvent<Message>) => void) | null;
}

export function setupHostServerWorker(
  workerScope: HostServerWorkerScope
): Promise<GameServer> {
  return new Promise<GameServer>((resolve, reject) => {
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

      workerScope.onmessage = (ev: MessageEvent<Message>) => {
        const msg = ev.data;
        if (msg) {
          handleMessage(msg);
        }
      };

      try {
        const server = await hostGame({
          serverId,
          createAdapterManager: () => manager,
        });
        resolve(server);
      } catch (error) {
        reject(error);
      }
    };
  });
}
