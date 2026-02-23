import { Adapter } from "./adapter";
import { Client } from "./client";
import { Message } from "./message";

export interface Router {
  id: string;
  // registered adapters
  adapters: Map<string, Adapter>;
  // routing table: id -> client (or adapter)
  routes: Map<string, Client>;
  // default route (e.g. upstream)
  defaultRoute?: Adapter;
  registerAdapter(adapter: Adapter): void;
  registerClient(client: Client): void;
  sendMessage(message: Message): void;
}

export function createRouter(id: string): Router {
  const router: Router = {
    id,
    adapters: new Map(),
    routes: new Map(),
    registerAdapter(adapter: Adapter) {
      adapter.router = router;
      this.adapters.set(adapter.id, adapter);

      // Get existing clients from the adapter
      adapter.clientIds.forEach((clientId) => {
        this.routes.set(clientId, adapter);
      });

      // Listen for new clients added to this adapter
      adapter.onClientAdd = (clientId: string) => {
        this.routes.set(clientId, adapter);
      };

      // Listen for clients removed from this adapter
      adapter.onClientRemove = (clientId: string) => {
        this.routes.delete(clientId);
      };

      // Listen for messages from this adapter
      adapter.onEmitMessage = (message: Message) => {
        this.routes.set(message.from, adapter);
        this.sendMessage(message);
      };
    },
    registerClient(client: Client) {
      this.routes.set(client.id, client);

      // Listen for messages from this client
      client.onEmitMessage = (message: Message) => {
        this.sendMessage(message);
      };
    },
    sendMessage(message: Message) {
      const targetAdapter = this.routes.get(message.to);
      if (targetAdapter) {
        targetAdapter.receiveMessage(message);
      } else {
        // default route
        if (this.defaultRoute) {
          this.defaultRoute.receiveMessage(message);
        } else {
          console.warn(`No route found for message to ${message.to}`);
        }
      }
    },
  };
  return router;
}
