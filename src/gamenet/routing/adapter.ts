import { Client } from "./client";
import { Router } from "./router";

export interface Adapter extends Client {
  router?: Router;
  clientIds: Set<string>;
  onClientAdd?: (clientId: string) => void;
  onClientRemove?: (clientId: string) => void;
}

export interface SendOptions {
  reliable: boolean;
}

export interface MessageEnvelope {
  t: string;
  data?: unknown;
}

export interface ClientAdapterSession<
  TAdapter extends Adapter = Adapter,
  TEnvelope extends MessageEnvelope = MessageEnvelope,
> {
  adapter?: TAdapter;
  onConnected?: (adapter: TAdapter) => void;
  onDisconnected?: () => void;
  onMessage?: (envelope: TEnvelope) => void;
  sendJSON: (msg: unknown, options?: SendOptions) => void;
  sendRaw: (msg: ArrayBuffer, options?: SendOptions) => void;
  dispose: () => void;
}

export interface ServerAdapterSession {
  remoteId: string;
  adapter: Adapter;
  onDisconnected?: () => void;
  onMessage?: (envelope: MessageEnvelope) => void;
  sendJSON: (msg: unknown, options?: SendOptions) => void;
  sendRaw: (msg: ArrayBuffer, options?: SendOptions) => void;
  dispose: () => void;
}

export interface ServerAdapterManager<
  TSession extends ServerAdapterSession = ServerAdapterSession,
> {
  sessions: Map<string, TSession>;
  onConnection?: (session: TSession) => void;
  dispose: () => void;
}

export { createWorkerAdapter, type WorkerAdapter } from "./worker_adapter.ts";
