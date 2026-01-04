import { Message } from "./message";

export interface Client {
  id: string;
  receiveMessage(message: Message): void;
  onReceiveMessage?: (message: Message) => void;
  emitMessage(message: Message): void;
  onEmitMessage?: (message: Message) => void;
}

export function createClient(id: string): Client {
  const client: Client = {
    id,
    receiveMessage(message: Message) {
      if (this.onReceiveMessage) {
        this.onReceiveMessage(message);
      }
    },
    emitMessage(message: Message) {
      if (this.onEmitMessage) {
        this.onEmitMessage(message);
      }
    },
  };
  return client;
}
