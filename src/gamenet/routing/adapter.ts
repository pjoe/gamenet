import { Client } from "./client";
import { Router } from "./router";

export interface Adapter extends Client {
  router?: Router;
  clientIds: Set<string>;
  onClientAdd?: (clientId: string) => void;
  onClientRemove?: (clientId: string) => void;
}

export { createWorkerAdapter, type WorkerAdapter } from "./worker_adapter.ts";
